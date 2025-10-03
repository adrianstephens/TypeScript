import {
    BinaryExpression,
    Debug,
    Expression,
    factory,
    isExpression,
    Node,
    SourceFile,
    Bundle,
    SyntaxKind,
    TransformationContext,
    Transformer,
    TypeChecker,
    TypeFlags,
    visitEachChild,
    visitNode,
    isAssignmentOperator,
    Type,
    BinaryOperator,
    PrefixUnaryExpression,
    PrefixUnaryOperator,
    PostfixUnaryOperator,
    PostfixUnaryExpression,
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

const operatorMethodMap: Record<number, [string, string]> = {
    [SyntaxKind.PlusToken]: ["add", "add"],
    [SyntaxKind.PlusEqualsToken]: ["add", "add"],
    [SyntaxKind.AsteriskToken]: ["mul", "mul"],
    [SyntaxKind.AsteriskEqualsToken]: ["mul", "mul"],
    [SyntaxKind.AsteriskAsteriskToken]: ["pow", "rpow"],
    [SyntaxKind.AsteriskAsteriskEqualsToken]: ["pow", "rpow"],
    [SyntaxKind.SlashToken]: ["div", "rdiv"],
    [SyntaxKind.SlashEqualsToken]: ["div", "rdiv"],
    [SyntaxKind.PercentToken]: ["mod", "rmod"],
    [SyntaxKind.PercentEqualsToken]: ["mod", "rmod"],
    [SyntaxKind.MinusToken]: ["sub", "rsub"],
    [SyntaxKind.MinusEqualsToken]: ["sub", "rsub"],
    [SyntaxKind.LessThanLessThanToken]: ["shl", ""],
    [SyntaxKind.LessThanLessThanEqualsToken]: ["shl", ""],
    [SyntaxKind.GreaterThanGreaterThanToken]: ["shr", ""],
    [SyntaxKind.GreaterThanGreaterThanEqualsToken]: ["shr", ""],
    [SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: ["asr", ""],
    [SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: ["asr", ""],
    [SyntaxKind.BarToken]: ["or", "or"],
    [SyntaxKind.BarEqualsToken]: ["or", "or"],
    [SyntaxKind.CaretToken]: ["xor", "xor"],
    [SyntaxKind.CaretEqualsToken]: ["xor", "xor"],
    [SyntaxKind.AmpersandToken]: ["and", "and"],
    [SyntaxKind.AmpersandEqualsToken]: ["and", "and"],
};

function checkOperatorOverload1(methodName: string, left: Type, right?: Type): Type | undefined {
    const typeChecker = left.checker
    // Check if left operand has the operator method
    const symbol = typeChecker.getPropertyOfType(left, methodName);
    if (!symbol || !symbol.valueDeclaration)
        return undefined;

    const methodType = typeChecker.getTypeOfSymbol(symbol);
    const signatures = typeChecker.getSignaturesOfType(methodType, 0 /* SignatureKind.Call */);

    if (!signatures)
        return undefined;

    // Validate signature has correct parameters
    for (const signature of signatures) {
        if (right) {
            if (signature.parameters.length === 1) {
                // Get the parameter type
                const parameterSymbol = signature.parameters[0];
                const parameterType = typeChecker.getTypeOfSymbol(parameterSymbol);
                
                // Check if the right operand is assignable to the parameter type
                if (parameterType && typeChecker.isTypeAssignableTo(right, parameterType))
                    return typeChecker.getReturnTypeOfSignature(signature);
            }

        } else {
            if (signature.parameters.length === 0)
                return typeChecker.getReturnTypeOfSignature(signature);
        }
    }
    
    return undefined;
}

export function checkPrefixUnaryOperatorOverload(operator: PrefixUnaryOperator, operand: Type): Type | undefined {
    const methodName = PrefixUnaryOperatorMethodMap[operator];
    if (!methodName)
        return undefined;

    return checkOperatorOverload1(methodName, operand);
}

export function checkPostfixUnaryOperatorOverload(operator: PostfixUnaryOperator, operand: Type): Type | undefined {
    const methodName = PostfixUnaryOperatorMethodMap[operator];
    if (!methodName)
        return undefined;

    return checkOperatorOverload1(methodName, operand);
}

export function checkBinaryOperatorOverload(operator: BinaryOperator, left: Type, right: Type): Type | undefined {
    const methodNames = operatorMethodMap[operator];
    if (!methodNames)
        return undefined;

    return ((left.flags & TypeFlags.Object)  && checkOperatorOverload1(methodNames[0], left, right))
        || (methodNames[1] && (right.flags & TypeFlags.Object) && checkOperatorOverload1(methodNames[1], right, left))
        || undefined;
}   

/**
 * Transform operator overloading expressions.
 * Transforms X + Y into X.add(Y) for non-primitive types.
 */
export function transformOperatorOverloading(context: TransformationContext, typeChecker: TypeChecker): Transformer<SourceFile | Bundle> {
    
    function visitor(node: Node): Node {
        if (node.kind === SyntaxKind.BinaryExpression)
            return visitBinaryExpression(node as BinaryExpression);
        else if (node.kind === SyntaxKind.PrefixUnaryExpression)
            return visitPrefixUnaryExpression(node as PrefixUnaryExpression);
        else if (node.kind === SyntaxKind.PostfixUnaryExpression) {
            return visitPostfixUnaryExpression(node as PostfixUnaryExpression);
        }
        return visitEachChild(node, visitor, context);
    }

    function visitBinaryExpression(node: BinaryExpression): Expression {
        const operator = node.operatorToken.kind;
        const methodNames = operatorMethodMap[operator];
        if (!methodNames) {
            // Not a supported operator, return as is
            return visitEachChild(node, visitor, context);
        }

        // Get types of operands
        const leftType = typeChecker.getTypeAtLocation(node.left);
        const rightType = typeChecker.getTypeAtLocation(node.right);
        
        let returnValue: Expression;

        if ((leftType.flags & TypeFlags.Object) && checkOperatorOverload1(methodNames[0], leftType, rightType)) {
            // Transform X + Y into X.add(Y)
            returnValue = factory.createMethodCall(
                Debug.checkDefined(visitNode(node.left, visitor, isExpression)),
                methodNames[0],
                [Debug.checkDefined(visitNode(node.right, visitor, isExpression))]
            );

        } else if (methodNames[1] && (rightType.flags & TypeFlags.Object) && checkOperatorOverload1(methodNames[1], rightType, leftType)) {
            // Transform X - Y into Y.rsub(X)
            returnValue = factory.createMethodCall(
                Debug.checkDefined(visitNode(node.right, visitor, isExpression)),
                methodNames[1],
                [Debug.checkDefined(visitNode(node.left, visitor, isExpression))]
            );

        } else {
            return visitEachChild(node, visitor, context);
        }

        if (isAssignmentOperator(operator)) {
            return factory.createAssignment(
                Debug.checkDefined(visitNode(node.left, visitor, isExpression)),
                returnValue
            );
        }
        return returnValue;
    }

    function visitPrefixUnaryExpression(node: PrefixUnaryExpression): Expression {
        const operator = node.operator;
        const methodName = PrefixUnaryOperatorMethodMap[operator];
        const type = typeChecker.getTypeAtLocation(node.operand);

        if (methodName && (type.flags & TypeFlags.Object) && checkOperatorOverload1(methodName, type)) {
            // Transform -X into X.neg()
            return factory.createMethodCall(
                Debug.checkDefined(visitNode(node.operand, visitor, isExpression)),
                methodName,
                []
            );
        }

        return visitEachChild(node, visitor, context);
    }
    function visitPostfixUnaryExpression(node: PostfixUnaryExpression): Expression {
        const operator = node.operator;
        const methodName = PostfixUnaryOperatorMethodMap[operator];
        const type = typeChecker.getTypeAtLocation(node.operand);

        if (methodName && (type.flags & TypeFlags.Object) && checkOperatorOverload1(methodName, type)) {
            // Transform -X into X.neg()
            return factory.createMethodCall(
                Debug.checkDefined(visitNode(node.operand, visitor, isExpression)),
                methodName,
                []
            );
        }
        return visitEachChild(node, visitor, context);
    }
    return visitor as any as Transformer<SourceFile | Bundle>;
}