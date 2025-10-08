declare class Object {
    toString(): string;
}
declare class Boolean extends Object {}
declare class Number extends Object {}
declare class String extends Object {
    length: number;
}
declare class Array<T> extends Object {
    length: number;
    map<U>(callback: (value: T, index: number, array: T[]) => U): U[];
    join(separator?: string): string;
}
declare class Function extends Object {}
declare class RegExp extends Object {}
declare class IArguments extends Object {}

