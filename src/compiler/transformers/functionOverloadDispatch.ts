import {
    Bundle,
    CallExpression,
    factory,
    FunctionDeclaration,
    IntersectionType,
    ObjectFlags,
    ObjectType,
    Type,
    TypeFlags,
    TypeParameter,
    TypeReference,
    UnionType,
    isCallExpression,
    isFunctionDeclaration,
    isIdentifier,
    Node,
    SourceFile,
    SyntaxKind,
    TransformationContext,
    Transformer,
    TypeChecker,
    visitEachChild,
    visitNode,
} from "../_namespaces/ts.js";

const simpleNames: [TypeFlags, string][] = [
    [TypeFlags.StringLike,  "s"],
    [TypeFlags.NumberLike,  "n"],
    [TypeFlags.BooleanLike, "b"],
    [TypeFlags.BigIntLike,  "i"],
    [TypeFlags.Undefined,   "u"],
    [TypeFlags.Null,        "0"],
    [TypeFlags.Void,        "v"],
    [TypeFlags.Any,         "a"],
    [TypeFlags.Unknown,     "x"],
    [TypeFlags.Never,       "-"],
];
 
export function transformFunctionOverloadDispatch(context: TransformationContext, typeChecker: TypeChecker): Transformer<SourceFile | Bundle> {
    return (node: SourceFile | Bundle) => {
        if (node.kind === SyntaxKind.Bundle) {
            return factory.createBundle(
                node.sourceFiles.map(sourceFile => transformSourceFile(sourceFile))
            );
        }
        return transformSourceFile(node);
    };

    function Types(types: readonly Type[]): string {
        if (types.length === 0)
            return "_";
        return types.map(type => getTypeNameFromType(type)).join("");
    }

    function AndType(type?: Type): string {
        return type ? getTypeNameFromType(type) : '';
    }

    // Extract a type name from a Type for name mangling
    function getTypeNameFromType(type: Type): string {
        // Handle primitive & special types
        for (const [flag, name] of simpleNames) {
            if (type.flags & flag) {
                return name;
            }
        }
        
        // Handle object types
        if (type.flags & TypeFlags.Object) {
            const objectType = type as ObjectType;
            
            // Array types
            if (typeChecker.isArrayType(type))
                return `A${AndType(typeChecker.getElementTypeOfArrayType(type))}`;
            
            // Tuple types
            if (typeChecker.isTupleType(type))
                return `T${Types(typeChecker.getTypeArguments(type as TypeReference))}`;
            
            // Class/Interface types with symbol name
            if (type.symbol?.escapedName) {
                const baseName = type.symbol.escapedName as string;
                
                return `O${baseName}${objectType.objectFlags & ObjectFlags.Reference
                    ? Types(typeChecker.getTypeArguments(objectType as TypeReference))
                    : ""}`;
            }
            
            // Anonymous object types - use a hash or simplified representation
            return "O";
        }
        
        // Handle union types
        if (type.flags & TypeFlags.Union) {
            const unionType = type as UnionType;
            return `U${Types(unionType.types)}`;
        }
        
        // Handle intersection types
        if (type.flags & TypeFlags.Intersection) {
            const intersectionType = type as IntersectionType;
            return `I${Types(intersectionType.types)}`;
        }
        
        // Handle type parameters
        if (type.flags & TypeFlags.TypeParameter) {
            const typeParam = type as TypeParameter;
            return typeParam.symbol?.escapedName || "T";
        }
        
        // Fallback for other types
        return "?";
    }

    // Generate a mangled name for a function implementation based on its parameter types
    function generateMangledName(func: FunctionDeclaration): string {
        const baseName = func.name?.escapedText as string;
        return [baseName, ...func.parameters.map(param => getTypeNameFromType(typeChecker.getTypeAtLocation(param.name)))].join('$');
    }

    // Find the appropriate implementation function for a call expression based on matching the arguments to available function signatures
    function findImplementationForCall(callExpr: CallExpression) {
        const symbol = typeChecker.getSymbolAtLocation(callExpr.expression);
        if ((symbol?.declarations?.length ?? 0) < 2)
            return undefined;

        // Get all argument types
        const args = callExpr.arguments.map(arg => typeChecker.getTypeAtLocation(arg));
        
        // Filter to function declarations with bodies and matching parameters
        const candidates = symbol!.declarations!.filter(decl =>
            isFunctionDeclaration(decl)
            && decl.body && decl.parameters.length === callExpr.arguments.length
            && !args.some((arg, i) => !typeChecker.isTypeAssignableTo(arg, typeChecker.getTypeAtLocation(decl.parameters[i].name)))
        ) as FunctionDeclaration[];

        if (candidates.length) {
            let bestCandidate = candidates[0];

            if (candidates.length > 1) {
                let bestSpecificity = -1;
                for (const candidate of candidates) {
                    const specificity = args.reduce(
                        (total, arg, i) => total + getTypeSpecificity(typeChecker.getTypeAtLocation(candidate.parameters[i].name), arg),
                    0);

                    if (specificity > bestSpecificity) {
                        bestSpecificity = specificity;
                        bestCandidate = candidate;
                    }
                }
            }
            return bestCandidate;
        }
        
        return undefined;
    }
    
    // Calculate how specific a parameter type is relative to an argument type
    // Higher scores = more specific = better match
    function getTypeSpecificity(paramType?: Type, argType?: Type): number {
        if (!paramType || !argType)
            return 0;

        // Exact type match gets highest score
        if (paramType === argType)
            return 1000;
        
        if (paramType.flags & TypeFlags.Any)
            return 10; // 'any' is least specific

        if (paramType.flags & TypeFlags.Unknown)
            return 20; // 'unknown' is slightly more specific than 'any'

        if (paramType.flags & (TypeFlags.String | TypeFlags.Number | TypeFlags.Boolean))
            return 500; // Primitive types are quite specific
        
        if (paramType.flags & TypeFlags.Object) {
            let score = 300; // Object types are moderately specific
            // Array types get bonus points for element type specificity
            if (typeChecker.isArrayType(paramType) && typeChecker.isArrayType(argType))
                score += getTypeSpecificity(typeChecker.getElementTypeOfArrayType(paramType), typeChecker.getElementTypeOfArrayType(argType)) / 10;
            return score;
        }
        if (paramType.flags & TypeFlags.Union) {
            // Narrower unions are more specific than wider unions
            const unionType = paramType as UnionType;
            return 200 - unionType.types.length * 10; // Fewer union members = more specific
        }
        
        return 0;
    }

    function transformSourceFile(sourceFile: SourceFile): SourceFile {
        
        function visitor(node: Node): Node {
            if (isFunctionDeclaration(node))
                return visitFunctionDeclaration(node);
            
            if (isCallExpression(node))
                return visitCallExpression(node);
            
            return visitEachChild(node, visitor, context);
        }
        
        function visitFunctionDeclaration(node: FunctionDeclaration): Node {
            const symbol = typeChecker.getSymbolAtLocation(node.name!);
            if (symbol?.declarations?.length ?? 0 > 1) {
                const mangledName = generateMangledName(node);
                return factory.createFunctionDeclaration(
                    node.modifiers,
                    node.asteriskToken,
                    factory.createIdentifier(mangledName),
                    node.typeParameters,
                    node.parameters,
                    node.type,
                    node.body
                );
            }

            return visitEachChild(node, visitor, context);
        }
        
        function visitCallExpression(node: CallExpression): Node {
            // Only handle calls to identifiers (simple function calls)
            if (isIdentifier(node.expression)) {
                const decl = findImplementationForCall(node);
                if (decl) {
                    const mangledName = generateMangledName(decl);
                    const newExpression = factory.createIdentifier(mangledName);
                    return factory.createCallExpression(
                        newExpression,
                        node.typeArguments,
                        node.arguments
                    );
                }
            }
            return visitEachChild(node, visitor, context);
        }
        
        return visitNode(sourceFile, visitor) as SourceFile;
    }
}
