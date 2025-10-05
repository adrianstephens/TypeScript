import {
    BinaryExpression,
    Expression,
    factory,
    Node,
    SourceFile,
    Bundle,
    SyntaxKind,
    TransformationContext,
    Transformer,
    TypeChecker,
    TypeFlags,
    visitEachChild,
    isAssignmentOperator,
    Type,
    BinaryOperator,
    PrefixUnaryExpression,
    PrefixUnaryOperator,
    PostfixUnaryOperator,
    PostfixUnaryExpression,
    isMethodDeclaration,
    Identifier,
    Signature,
    isIdentifier,
    setOriginalNode,
} from "../_namespaces/ts.js";

const PrefixUnaryOperatorMethodMap: Record<PrefixUnaryOperator, string> = {
    [SyntaxKind.PlusPlusToken]: "inc",
    [SyntaxKind.MinusMinusToken]: "dec",
    [SyntaxKind.PlusToken]: "pos",
    [SyntaxKind.MinusToken]: "neg",
    [SyntaxKind.TildeToken]: "inv",
    [SyntaxKind.ExclamationToken]: "not",
};

const PostfixUnaryOperatorMethodMap: Record<PostfixUnaryOperator, string> = {
    [SyntaxKind.PlusPlusToken]: "inc",
    [SyntaxKind.MinusMinusToken]: "dec",
};

const BinaryOperatorMethodMap: Record<number, [string, string]> = {
    [SyntaxKind.PlusToken]:                                    ["add", "add"],
    [SyntaxKind.PlusEqualsToken]:                              ["add", "add"],
    [SyntaxKind.AsteriskToken]:                                ["mul", "mul"],
    [SyntaxKind.AsteriskEqualsToken]:                          ["mul", "mul"],
    [SyntaxKind.AsteriskAsteriskToken]:                        ["pow", "rpow"],
    [SyntaxKind.AsteriskAsteriskEqualsToken]:                  ["pow", "rpow"],
    [SyntaxKind.SlashToken]:                                   ["div", "rdiv"],
    [SyntaxKind.SlashEqualsToken]:                             ["div", "rdiv"],
    [SyntaxKind.PercentToken]:                                 ["mod", "rmod"],
    [SyntaxKind.PercentEqualsToken]:                           ["mod", "rmod"],
    [SyntaxKind.MinusToken]:                                   ["sub", "rsub"],
    [SyntaxKind.MinusEqualsToken]:                             ["sub", "rsub"],
    [SyntaxKind.LessThanLessThanToken]:                        ["shl",  ""],
    [SyntaxKind.LessThanLessThanEqualsToken]:                  ["shl",  ""],
    [SyntaxKind.GreaterThanGreaterThanToken]:                  ["shr",  ""],
    [SyntaxKind.GreaterThanGreaterThanEqualsToken]:            ["shr",  ""],
    [SyntaxKind.GreaterThanGreaterThanGreaterThanToken]:       ["asr",  ""],
    [SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: ["asr",  ""],
    [SyntaxKind.BarToken]:                                     ["or",  "or"],
    [SyntaxKind.BarEqualsToken]:                               ["or",  "or"],
    [SyntaxKind.CaretToken]:                                   ["xor", "xor"],
    [SyntaxKind.CaretEqualsToken]:                             ["xor", "xor"],
    [SyntaxKind.AmpersandToken]:                               ["and", "and"],
    [SyntaxKind.AmpersandEqualsToken]:                         ["and", "and"],
    [SyntaxKind.LessThanToken]:                                ["lt",  "gt"],
    [SyntaxKind.LessThanEqualsToken]:                          ["le",  "ge"],
    [SyntaxKind.GreaterThanToken]:                             ["gt",  "lt"],
    [SyntaxKind.GreaterThanEqualsToken]:                       ["ge",  "le"],
    [SyntaxKind.EqualsEqualsToken]:                            ["eq",  "eq"],
    [SyntaxKind.ExclamationEqualsToken]:                       ["ne",  "ne"],
};

function inverseOperator(operator: BinaryOperator): BinaryOperator | undefined {
    switch (operator) {
        case SyntaxKind.LessThanToken: return SyntaxKind.GreaterThanEqualsToken;
        case SyntaxKind.LessThanEqualsToken: return SyntaxKind.GreaterThanToken;
        case SyntaxKind.GreaterThanToken: return SyntaxKind.LessThanEqualsToken;
        case SyntaxKind.GreaterThanEqualsToken: return SyntaxKind.LessThanToken;
        case SyntaxKind.EqualsEqualsToken: return SyntaxKind.ExclamationEqualsToken;
        case SyntaxKind.ExclamationEqualsToken: return SyntaxKind.EqualsEqualsToken;
        default: return undefined;
    }
}
function flipOperator(operator: BinaryOperator): BinaryOperator | undefined {
    switch (operator) {
        case SyntaxKind.LessThanToken: return SyntaxKind.GreaterThanToken;
        case SyntaxKind.LessThanEqualsToken: return SyntaxKind.GreaterThanEqualsToken;
        case SyntaxKind.GreaterThanToken: return SyntaxKind.LessThanToken;
        case SyntaxKind.GreaterThanEqualsToken: return SyntaxKind.LessThanEqualsToken;
        default: return undefined;
    }
}

function checkOperatorOverload(checker: TypeChecker, methodName: string, left: Type, right?: Type): Signature | undefined {

    // Check if left operand has the operator method
    const symbol = checker.getPropertyOfType(left, methodName);
    if (!symbol || !symbol.valueDeclaration || !isMethodDeclaration(symbol.valueDeclaration))
        return undefined;

    const methodType = checker.getTypeOfSymbol(symbol);
    const signatures = checker.getSignaturesOfType(methodType, 0 /* SignatureKind.Call */);

    if (!signatures)
        return undefined;


    // Validate signature has correct parameters
    for (const signature of signatures) {
        if (right) {
            if (signature.parameters.length === 1) {
                // Get the parameter type
                const parameterSymbol = signature.parameters[0];
                const parameterType = checker.getTypeOfSymbol(parameterSymbol);
                
                // Check if the right operand is assignable to the parameter type
                if (parameterType && checker.isTypeAssignableTo(right, parameterType)) {
                    return signature;
                }
            }

        } else {
            if (signature.parameters.length === 0) {
                return signature;
            }
        }
    }
    
    return undefined;
}

function checkOperatorOverload2(checker: TypeChecker, methodName: string, left: Type, right?: Type): Type | undefined {
    if (methodName) {
        const sig = checkOperatorOverload(checker, methodName, left, right);
        if (sig)
            return checker.getReturnTypeOfSignature(sig);
    }  
}

function signatureIdentifier(signature: Signature): Identifier | undefined {
    return signature.declaration && isMethodDeclaration(signature.declaration) && isIdentifier(signature.declaration.name) ? signature.declaration.name : undefined;
}

export function checkPrefixUnaryOperatorOverload(operator: PrefixUnaryOperator, operand: Type, typeChecker: TypeChecker): Type | undefined {
    return checkOperatorOverload2(typeChecker, PrefixUnaryOperatorMethodMap[operator], operand);
}

export function checkPostfixUnaryOperatorOverload(operator: PostfixUnaryOperator, operand: Type, typeChecker: TypeChecker): Type | undefined {
    return checkOperatorOverload2(typeChecker, PostfixUnaryOperatorMethodMap[operator], operand);
}

export function checkBinaryOperatorOverload(operator: BinaryOperator, left: Type, right: Type, typeChecker: TypeChecker): Type | undefined {
    const methodNames = BinaryOperatorMethodMap[operator];
    if (methodNames)
        return (
            ((left.flags & TypeFlags.Object) && checkOperatorOverload2(typeChecker, methodNames[0], left, right))
            || (methodNames[1] && (right.flags & TypeFlags.Object) && checkOperatorOverload2(typeChecker, methodNames[1], right, left))
            || undefined
        );
}


/**
 * Transform operator overloading expressions.
 * Transforms X + Y into X.add(Y) for non-primitive types.
 */
export function transformOperatorOverloading(context: TransformationContext, typeChecker: TypeChecker): Transformer<SourceFile | Bundle> {
    function visitor(node: Node): Node {
        const node2 = visitEachChild(node, visitor, context);

        if (node2.kind === SyntaxKind.BinaryExpression)
            return visitBinaryExpression(node2 as BinaryExpression);

        if (node2.kind === SyntaxKind.PrefixUnaryExpression)
            return visitPrefixUnaryExpression(node2 as PrefixUnaryExpression);
        
        if (node2.kind === SyntaxKind.PostfixUnaryExpression)
            return visitPostfixUnaryExpression(node2 as PostfixUnaryExpression);
        
        return node2;
    }

    function visitBinaryExpression(node: BinaryExpression): Expression {
        const operator      = node.operatorToken.kind;
        const methodNames   = BinaryOperatorMethodMap[operator];
        if (!methodNames)
            return node;

        // Get types of operands - type checker preserves original type info
        const leftType = typeChecker.getTypeAtLocation(node.left);
        const rightType = typeChecker.getTypeAtLocation(node.right);
        
        function try1way(methodName: string, leftType: Type, rightType: Type, left:Expression, right:Expression): Expression|undefined {
            if (leftType.flags & TypeFlags.Object) {
                const signature = checkOperatorOverload(typeChecker, methodName, leftType, rightType);
                if (signature) {  // Transform X + Y into X.add(Y)
                    return setOriginalNode(factory.createMethodCall(
                        left,
                        signatureIdentifier(signature)!,
                        [right]
                    ), node);
                }
            }
        }
        function tryCmp(operator: BinaryOperator, leftType: Type, rightType: Type, left:Expression, right:Expression): Expression|undefined {
            const compNode = try1way("cmp", leftType, rightType, left, right);
            if (compNode) {
                // Transform X < Y into X.cmp(Y) < 0
                return setOriginalNode(factory.createBinaryExpression(
                    compNode,
                    operator,
                    factory.createNumericLiteral("0")
                ), node);
            }
        }

        function try2ways(methodNames: string[]): Expression|undefined {
            return try1way(methodNames[0], leftType, rightType, node.left, node.right)
                ?? ((methodNames[1] && try1way(methodNames[1], rightType, leftType, node.right, node.left)) || undefined);
        }

        const newNode = try2ways(methodNames);
        if (newNode) {
            // Successfully transformed
            if (isAssignmentOperator(operator))
                return setOriginalNode(factory.createAssignment(node.left, newNode), node);
            return newNode;
        }

        // If relational operator, try inverse and negate result
        const invOp = inverseOperator(operator);
        if (invOp) {
            const invMethodNames = BinaryOperatorMethodMap[invOp];
            if (invMethodNames) {
                const notValue = try2ways(invMethodNames);
                if (notValue)
                    return setOriginalNode(factory.createLogicalNot(notValue), node);
            }
            
            // Try cmp method if available
            const compNode1 = tryCmp(operator, leftType, rightType, node.left, node.right);
            if (compNode1)
                return compNode1;

            // If not found, try flipping operator and operands, e.g. X < Y into Y > X
            const flipOp = flipOperator(operator);
            if (flipOp) {
                // Try flipping operator and operands, e.g. X < Y into Y > X
                const compNode2 = tryCmp(flipOp, rightType, leftType, node.right, node.left);
                if (compNode2)
                    return compNode2;}
        }

        return node;
    }

    function visitPrefixUnaryExpression(node: PrefixUnaryExpression): Expression {
        const methodName = PrefixUnaryOperatorMethodMap[node.operator];
        const type = typeChecker.getTypeAtLocation(node.operand);

        if (methodName && (type.flags & TypeFlags.Object)) {
            const signature = checkOperatorOverload(typeChecker, methodName, type);
            if (signature) {
                // Transform -X into X.neg()
                return setOriginalNode(factory.createMethodCall(
                    node.operand,
                    signatureIdentifier(signature)!,
                    []
                ), node);
            }
        }

        return node;
    }
    function visitPostfixUnaryExpression(node: PostfixUnaryExpression): Expression {
        const methodName = PostfixUnaryOperatorMethodMap[node.operator];
        const type = typeChecker.getTypeAtLocation(node.operand);

        if (methodName && (type.flags & TypeFlags.Object)) {
            const signature = checkOperatorOverload(typeChecker, methodName, type);
            if (signature) {
                // Transform X++ into X.inc()
                return setOriginalNode(factory.createMethodCall(
                    node.operand,
                    signatureIdentifier(signature)!,
                    []
                ), node);
            }
        }
        
        return node;
    }
    return visitor as any as Transformer<SourceFile | Bundle>;
}