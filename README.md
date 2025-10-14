# Typescript extensions

This document describes the experimental operator overloading and function overload dispatch features added to this TypeScript fork.


## Operator Overloading

Operator overloading in this TypeScript fork allows user-defined types to provide custom behavior for operators such as `+`, `-`, `*`, `/`, comparison, and bitwise operators. The implementation works by transforming operator expressions into method calls on the operand types, if those methods exist.

This feature is enabled with the compiler option `operatorOverloading`.


### Operator-to-Method Mappings

The following mappings are used to resolve operator overloads:

**Binary Operators:**

| Operator | Left Method | Right Method |
|----------|-------------|--------------|
| `+`      | `add`       | `add`        |
| `-`      | `sub`       | `rsub`       |
| `*`      | `mul`       | `mul`        |
| `/`      | `div`       | `rdiv`       |
| `%`      | `mod`       | `rmod`       |
| `**`     | `pow`       | `rpow`       |
| `&`      | `and`       | `and`        |
| `\|`      | `or`        | `or`         |
| `^`      | `xor`       | `xor`        |
| `<<`     | `shl`       |              |
| `>>`     | `shr`       |              |
| `>>>`    | `asr`       |              |
| `<`      | `lt`        | `gt`         |
| `<=`     | `le`        | `ge`         |
| `>`      | `gt`        | `lt`         |
| `>=`     | `ge`        | `le`         |
| `==`     | `eq`        | `eq`         |
| `!=`     | `ne`        | `ne`         |

**Unary Operators:**

| Operator | Method |
|----------|--------|
| `++`     | `inc`  |
| `--`     | `dec`  |
| `+`      | `pos`  |
| `-`      | `neg`  |
| `~`      | `inv`  |
| `!`      | `not`  |

For comparison, the method `cmp` may be used, with the result compared to zero (e.g., `a.cmp(b) < 0`).

### How Operator Methods Are Found

When the compiler encounters an operator expression (like `a + b`), it:

1. Uses the above mapping to determine the method name(s) to check.
2. Checks if the left operand's type has a method with that name (using the type checker).
3. If found, verifies the method signature matches the expected operand types.
4. If valid, rewrites the operator expression as a method call (e.g., `a.add(b)`).
5. For some operators, also checks the right operand for a corresponding method (e.g., `rsub` for right-side subtraction).
6. For comparison operators, may also check for a `cmp` method and rewrite as a comparison against zero (e.g., `a.cmp(b) < 0`).
7. If no suitable method is found, the operator behaves as usual.

### Example
```typescript
class Point {
    x: number;
    y: number;

    add(other: Point): Point {
        return new Point(this.x + other.x, this.y + other.y);
    }
}

const p1 = new Point(1, 2);
const p2 = new Point(3, 4);
const p3 = p1 + p2; // Transformed to p1.add(p2) if 'add' exists
```

### Notes
- Operator overloads are resolved at compile time by checking for matching methods on operand types.
- Only supported operators (see implementation mapping) can be overloaded.
- If no matching method is found, the operator behaves as in standard TypeScript.



## Function Overload Dispatch

Function overload dispatch in this fork enables selection of function implementations based on argument types. It works by generating mangled function names for each overloaded *implementation*, and rewriting calls to use the correct implementation. Functions (or methods) with multiple signatures but only a single implementation work as before.

This feature is enabled with the compiler option `functionOverloadDispatch`.

### How Name Mangling Works

For each overloaded function or method, a mangled name is generated using the base name and a suffix encoding the parameter types:

- `n` for number
- `s` for string
- `b` for boolean
- `i` for bigint
- `u` for undefined
- `0` for null
- `v` for void
- `a` for any
- `x` for unknown
- `A...` for array types
- `T...` for tuple types
- `F...` for function types
- `O...` for object types (with class/interface name if available)
- `U...` for union types
- `I...` for intersection types

For example, `foo(x: number)` becomes `foo$n`, and `foo(x: string, y: number[])` becomes `foo$sAn`.

At call sites, the compiler determines the argument types and rewrites the call to the correct mangled function name.

### Example
```typescript
function foo(x: number): number { /* ... */ }
function foo(x: string): string { /* ... */ }

foo(42);    // Transformed to foo$n(42)
foo("hi"); // Transformed to foo$s("hi")
```

### Notes
- Overload resolution is performed at compile time using type information.
- Function and method implementations are renamed to unique mangled names.
- See `src/compiler/transformers/functionOverloadDispatch.ts` for implementation details.
## Using Both Features Together

When both operator overloading and function overload dispatch are enabled, operator methods themselves can be overloaded and mangled. For example, you can provide multiple overloads for an operator method such as `add`, and the correct overload will be selected and mangled based on the operand types.

**Example:**
```typescript
class Point {
    x: number;
    y: number;

    add(other: Point): Point { /* ... */ }
    add(other: number): Point { /* ... */ }
}

const p = new Point(1, 2);
p + p;      // Transformed to p.add$OPoint(p)
p + 5;      // Transformed to p.add$n(5)
```

This allows for highly flexible operator overloading, with dispatch based on operand types.

## Feedback
Please report issues or suggestions via the repository's issue tracker.

---
# For general TypeScript documentation and usage, see the official README:

[View the original TypeScript README on GitHub](https://github.com/microsoft/TypeScript/blob/main/README.md)


# TypeScript

[![CI](https://github.com/microsoft/TypeScript/actions/workflows/ci.yml/badge.svg)](https://github.com/microsoft/TypeScript/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/typescript.svg)](https://www.npmjs.com/package/typescript)
[![Downloads](https://img.shields.io/npm/dm/typescript.svg)](https://www.npmjs.com/package/typescript)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/microsoft/TypeScript/badge)](https://securityscorecards.dev/viewer/?uri=github.com/microsoft/TypeScript)


[TypeScript](https://www.typescriptlang.org/) is a language for application-scale JavaScript. TypeScript adds optional types to JavaScript that support tools for large-scale JavaScript applications for any browser, for any host, on any OS. TypeScript compiles to readable, standards-based JavaScript. Try it out at the [playground](https://www.typescriptlang.org/play/), and stay up to date via [our blog](https://blogs.msdn.microsoft.com/typescript) and [Twitter account](https://twitter.com/typescript).

Find others who are using TypeScript at [our community page](https://www.typescriptlang.org/community/).

## Installing

For the latest stable version:

```bash
npm install -D typescript
```

For our nightly builds:

```bash
npm install -D typescript@next
```

## Contribute

There are many ways to [contribute](https://github.com/microsoft/TypeScript/blob/main/CONTRIBUTING.md) to TypeScript.
* [Submit bugs](https://github.com/microsoft/TypeScript/issues) and help us verify fixes as they are checked in.
* Review the [source code changes](https://github.com/microsoft/TypeScript/pulls).
* Engage with other TypeScript users and developers on [StackOverflow](https://stackoverflow.com/questions/tagged/typescript).
* Help each other in the [TypeScript Community Discord](https://discord.gg/typescript).
* Join the [#typescript](https://twitter.com/search?q=%23TypeScript) discussion on Twitter.
* [Contribute bug fixes](https://github.com/microsoft/TypeScript/blob/main/CONTRIBUTING.md).

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see
the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com)
with any additional questions or comments.

## Documentation

*  [TypeScript in 5 minutes](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)
*  [Programming handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
*  [Homepage](https://www.typescriptlang.org/)

## Roadmap

For details on our planned features and future direction, please refer to our [roadmap](https://github.com/microsoft/TypeScript/wiki/Roadmap).
