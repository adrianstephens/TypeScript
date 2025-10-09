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
    Declaration,
    isMethodDeclaration,
    PropertyName,
    ParameterDeclaration,
    NodeArray,
    getTextOfPropertyName,
    isPropertyAccessExpression,
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


// Generate a mangled name for a function implementation based on its parameter types
function generateMangledName(typeChecker: TypeChecker, name: PropertyName, params: NodeArray<ParameterDeclaration> | ParameterDeclaration[]): string {
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

    const baseName = getTextOfPropertyName(name).toString();
    return [baseName, ...params.map(param => getTypeNameFromType(typeChecker.getTypeAtLocation(param.name)))].join('$');
}

function getImplementations(declarations: Declaration[]) {
    return declarations.filter(decl => ((isFunctionDeclaration(decl) || isMethodDeclaration(decl)) && decl.body) || getJSDocTags(decl).some(tag => tag.tagName.escapedText === "functionOverloadDispatch")) as (FunctionDeclaration | MethodDeclaration)[];
}

export function transformFunctionOverloadDispatch(context: TransformationContext, checker: TypeChecker): Transformer<SourceFile | Bundle> {
    return (node: SourceFile | Bundle) => visitNode(node, visitor) as SourceFile;

    function isOverloaded(node: Node): boolean {
        const symbol = checker.getSymbolAtLocation(node);
        if (symbol) {
            const type = checker.getTypeOfSymbolAtLocation(symbol, node);
            const signatures = checker.getSignaturesOfType(type, SignatureKind.Call);
            return getImplementations(signatures.map(sig => sig.declaration!)).length > 1;
        }
        return false;
    }

    function visitor(node: Node): Node {
        node = visitEachChild(node, visitor, context);

        if (isFunctionDeclaration(node)) {
            if (isOverloaded(node.name!)) {
                const mangledName = generateMangledName(checker, node.name!, node.parameters);
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
        
        if (isMethodDeclaration(node)) {
            if (isOverloaded(node.name)) {
                const mangledName = generateMangledName(checker, node.name, node.parameters);
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

        if (isCallExpression(node) && (isIdentifier(node.expression) || isPropertyAccessExpression(node.expression))) {
            const id = isIdentifier(node.expression) ? node.expression : node.expression.name;
            if (isOverloaded(id)) {
                const sig = checker.getResolvedSignature(node);
                if (sig && sig.declaration && (isFunctionDeclaration(sig.declaration) || isMethodDeclaration(sig.declaration))) {
                    const mangledIdentifier = factory.createIdentifier(generateMangledName(checker, sig.declaration.name!, sig.declaration.parameters));
                    return factory.createCallExpression(
                        isIdentifier(node.expression) ? mangledIdentifier : factory.createPropertyAccessExpression(node.expression.expression, mangledIdentifier),
                        node.typeArguments,
                        node.arguments
                    );
                }
            }
        }

        return node;
    }
        
}
