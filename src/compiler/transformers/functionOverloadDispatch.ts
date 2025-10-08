import {
    Bundle,
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
    TransformationContext,
    Transformer,
    TypeChecker,
    visitEachChild,
    visitNode,
    MethodDeclaration,
    isMethodDeclaration,
    PropertyName,
    ParameterDeclaration,
    NodeArray,
    getTextOfPropertyName,
    isPropertyAccessExpression,
    Expression,
    SignatureKind,
    getJSDocTags,
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
    return (node: SourceFile | Bundle) => visitNode(node, visitor) as SourceFile;

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
            if (type.flags & flag)
                return name;
        }
        
        // Handle object types
        if (type.flags & TypeFlags.Object) {
            const objectType = type as ObjectType;
            const args = objectType.objectFlags & ObjectFlags.Reference ? typeChecker.getTypeArguments(type as TypeReference) : [];
            
            // Array types
            if (typeChecker.isArrayType(type))
                return `A${AndType(typeChecker.getElementTypeOfArrayType(type))}`;
            
            // Tuple types
            if (typeChecker.isTupleType(type))
                return `T${Types(args)}`;

            const sig = typeChecker.getSignaturesOfType(type, SignatureKind.Call);
            if (sig.length > 0)
                return `F${Types(sig[0].parameters.map(param => typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!)))}`;

            // Class/Interface types with symbol name
            if (type.symbol?.escapedName) {
                const baseName = type.symbol.escapedName as string;
                return `O${baseName}${args.map(arg => getTypeNameFromType(arg)).join("")}`;
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
    function generateMangledName(name: PropertyName, params: NodeArray<ParameterDeclaration> | ParameterDeclaration[]): string {
        const baseName = getTextOfPropertyName(name).toString();
        return [baseName, ...params.map(param => getTypeNameFromType(typeChecker.getTypeAtLocation(param.name)))].join('$');
    }

    function getImplementations(node: Node) {
        const symbol = typeChecker.getSymbolAtLocation(node);
        return (symbol?.declarations ?? []).filter(decl => ((isFunctionDeclaration(decl) || isMethodDeclaration(decl)) && decl.body) || getJSDocTags(decl).some(tag => tag.tagName.escapedText === "functionOverloadDispatch")) as (FunctionDeclaration | MethodDeclaration)[];
    }

    // Find the appropriate implementation function for a call expression based on matching the arguments to available function signatures
    function findImplementationForCall(implementations: (FunctionDeclaration|MethodDeclaration)[], args0: NodeArray<Expression> | Expression[]) {
        if (implementations.length < 2)
            return undefined;

        // Get all argument types
        const args = args0.map(arg => typeChecker.getTypeAtLocation(arg));
        
        // Filter to function declarations with bodies and matching parameters
        const candidates = implementations.filter(decl =>
            decl.parameters.length === args.length
            && !args.some((arg, i) => !typeChecker.isTypeAssignableTo(arg, typeChecker.getTypeAtLocation(decl.parameters[i].name)))
        );

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
    
    function visitor(node: Node): Node {
        node = visitEachChild(node, visitor, context);

        if (isFunctionDeclaration(node)) {
            const implementations = getImplementations(node.name!);
            if (implementations.length > 1) { // More than one implementation
                const mangledName = generateMangledName(node.name!, node.parameters);
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
        }
        
        if (isCallExpression(node)) {
            // Only handle calls to identifiers (simple function calls)
            if (isIdentifier(node.expression)) {
                const decl = findImplementationForCall(getImplementations(node.expression), node.arguments);
                if (decl) {
                    const mangledName = generateMangledName(decl.name!, decl.parameters);
                    const newExpression = factory.createIdentifier(mangledName);
                    return factory.createCallExpression(
                        newExpression,
                        node.typeArguments,
                        node.arguments
                    );
                }

            } else if (isPropertyAccessExpression(node.expression)) {
                const decl = findImplementationForCall(getImplementations(node.expression.name), node.arguments);//.slice(1));
                if (decl) {
                    const mangledName = generateMangledName(decl.name!, decl.parameters);//.slice(1));
                    const newExpression = factory.createPropertyAccessExpression(node.expression.expression, factory.createIdentifier(mangledName));
                    return factory.createCallExpression(
                        newExpression,
                        node.typeArguments,
                        node.arguments
                    );
                }
            }
        }

        if (isMethodDeclaration(node)) {
            const implementations = getImplementations(node.name);
            if (implementations.length > 1) { // More than one implementation
                const mangledName = generateMangledName(node.name, node.parameters);
                return factory.createMethodDeclaration(
                    node.modifiers,
                    node.asteriskToken,
                    factory.createIdentifier(mangledName),
                    node.questionToken,
                    node.typeParameters,
                    node.parameters,
                    node.type,
                    node.body
                );
            }
        }

        return node;
    }
        
}
