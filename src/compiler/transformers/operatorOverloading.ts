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
    setTextRange,
	Mutable,
    visitNode,
	isPrefixUnaryExpression,
	isPostfixUnaryExpression,
	isBinaryExpression,
	SignatureKind,
	NodeFlags
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
function inverseMethods(operator: BinaryOperator) {
    const invOp = inverseOperator(operator);
    return invOp ? BinaryOperatorMethodMap[invOp] : undefined;
}

function reverseOperator(operator: BinaryOperator): BinaryOperator | undefined {
    switch (operator) {
        case SyntaxKind.LessThanToken: return SyntaxKind.GreaterThanToken;
        case SyntaxKind.LessThanEqualsToken: return SyntaxKind.GreaterThanEqualsToken;
        case SyntaxKind.GreaterThanToken: return SyntaxKind.LessThanToken;
        case SyntaxKind.GreaterThanEqualsToken: return SyntaxKind.LessThanEqualsToken;
        default: return undefined;
    }
}

function checkOperatorOverload(checker: TypeChecker, methodName: string, left: Type, right?: Type): Signature | undefined {
    if (!methodName)
        return undefined;

    // Check if left operand has the operator method
    const symbol = checker.getPropertyOfType(left, methodName);
    if (!symbol)
        return undefined;

    const signatures = checker.getSignaturesOfType(checker.getTypeOfSymbol(symbol), SignatureKind.Call);
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
                if (parameterType && checker.isTypeAssignableTo(right, parameterType))
                    return signature;
            }

        } else {
            if (signature.parameters.length === 0)
                return signature;
        }
    }
    
    return undefined;
}

function checkOperatorOverloadReturn(checker: TypeChecker, methodName: string, left: Type, right?: Type): Type | undefined {
    const sig = checkOperatorOverload(checker, methodName, left, right);
    if (sig)
		return checker.getReturnTypeOfSignature(sig);
}

function checkOperatorOverloadReturn2(methodNames: string[]|undefined, left: Type, right: Type, checker: TypeChecker): Type | undefined {
    if (methodNames)
		return checkOperatorOverloadReturn(checker, methodNames[0], left, right)
			|| checkOperatorOverloadReturn(checker, methodNames[1], right, left);
}

export function checkPrefixUnaryOperatorOverload(operator: PrefixUnaryOperator, operand: Type, checker: TypeChecker): Type | undefined {
    return checkOperatorOverloadReturn(checker, PrefixUnaryOperatorMethodMap[operator], operand);
}

export function checkPostfixUnaryOperatorOverload(operator: PostfixUnaryOperator, operand: Type, checker: TypeChecker): Type | undefined {
    return checkOperatorOverloadReturn(checker, PostfixUnaryOperatorMethodMap[operator], operand);
}

export function checkBinaryOperatorOverload(operator: BinaryOperator, left: Type, right: Type, checker: TypeChecker): Type | undefined {
    return checkOperatorOverloadReturn2(BinaryOperatorMethodMap[operator], left, right, checker);
}

export function checkComparisonOperatorOverload(operator: BinaryOperator, left: Type, right: Type, checker: TypeChecker): Type | undefined {
    return checkOperatorOverloadReturn2(BinaryOperatorMethodMap[operator], left, right, checker)
        ?? checkOperatorOverloadReturn2(inverseMethods(operator), left, right, checker)
        ?? checkOperatorOverloadReturn2(["cmp","cmp"], left, right, checker);
}

function signatureIdentifier(signature: Signature): Identifier | undefined {
    if (signature.declaration && isMethodDeclaration(signature.declaration) && isIdentifier(signature.declaration.name))
        return factory.cloneNode(signature.declaration.name);
}

function notSynthetic<T extends Node>(newNode: Mutable<T>, node: Node): T {
	newNode.flags &= ~NodeFlags.Synthesized;
	newNode.parent = node.parent;
	return newNode;
}

function makeMethodCall(identifier: Identifier, left: Expression, args: Expression[]): Expression {
	const access = factory.createPropertyAccessExpression(left, identifier);
	const call = factory.createCallExpression(
		access,
		/*typeArguments*/ undefined,
		args,
	);
	(access as Mutable<Node>).parent = call;
	return call;
}

export function transformOperatorOverloading(context: TransformationContext, typeChecker: TypeChecker): Transformer<SourceFile | Bundle> {
    return (node: SourceFile | Bundle) => visitNode(node, visitor) as SourceFile;

    function visitor(node: Node): Node {
        node = visitEachChild(node, visitor, context);

        if (isBinaryExpression(node))
            return transformBinaryExpression(node);

        if (isPrefixUnaryExpression(node))
	        return transformUnaryExpression(node, PrefixUnaryOperatorMethodMap[node.operator]);

        if (isPostfixUnaryExpression(node))
            return transformUnaryExpression(node, PostfixUnaryOperatorMethodMap[node.operator]);

        return node;
    }

    function transformBinaryExpression(node: BinaryExpression): Expression {
        const operator      = node.operatorToken.kind;
        const methodNames   = BinaryOperatorMethodMap[operator];
        if (!methodNames)
            return node;

        const leftType	= typeChecker.getTypeAtLocation(node.left);
        const rightType = typeChecker.getTypeAtLocation(node.right);
        
	  	// Transform X + Y into X.add(Y)
        function try1way(methodName: string, leftType: Type, rightType: Type, left: Expression, right: Expression): Expression|undefined {
            const signature = checkOperatorOverload(typeChecker, methodName, leftType, rightType);
            if (signature)
				return notSynthetic(makeMethodCall(signatureIdentifier(signature)!, left, [right]), node);;
        }

        function try2ways(methodNames: string[], leftType: Type, rightType: Type, left:Expression, right:Expression): Expression|undefined {
			return try1way(methodNames[0], leftType, rightType, left, right)
				|| try1way(methodNames[1], rightType, leftType, right, left);
        }

		// Transform X < Y into X.cmp(Y) < 0
        function tryCmp(operator: BinaryOperator|undefined, leftType: Type, rightType: Type, left:Expression, right:Expression): Expression|undefined {
			if (operator) {
				const compNode = try1way("cmp", leftType, rightType, left, right);
				if (compNode) {
					return factory.createBinaryExpression(
						compNode,
						operator,
						factory.createNumericLiteral("0")
					);
				}
			}
        }

        const newNode = try2ways(methodNames, leftType, rightType, node.left, node.right);
        if (newNode) {
            if (isAssignmentOperator(operator))
                return factory.createAssignment(node.left, newNode);
            return newNode;
        }

        // If relational operator, try inverse and negate result
        const invOp = inverseOperator(operator);
        if (invOp) {
			const notNode = try2ways(BinaryOperatorMethodMap[invOp], leftType, rightType, node.left, node.right);
			if (notNode)
				return factory.createLogicalNot(notNode);
            
            // Try cmp method if available, e.g. X < Y => X.cmp(Y) < 0, then try reversing operator and operands, e.g. X < Y => Y.cmp(X) > 0
            const compNode = tryCmp(operator, leftType, rightType, node.left, node.right)
						|| 	 tryCmp(reverseOperator(operator), rightType, leftType, node.right, node.left);

            if (compNode)
                return compNode;
        }

        return node;
    }

    function transformUnaryExpression(node: PrefixUnaryExpression|PostfixUnaryExpression, methodName: string): Expression {
		const signature = checkOperatorOverload(typeChecker, methodName, typeChecker.getTypeAtLocation(node.operand));
		if (signature)
			// Transform -X into X.neg()
			return notSynthetic(makeMethodCall(signatureIdentifier(signature)!, node.operand, []), node);
		return node;
	}
}