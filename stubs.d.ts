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
    every(callback: (value: T, index: number, array: T[]) => boolean): boolean;
    some(callback: (value: T, index: number, array: T[]) => boolean): boolean;
    forEach(callback: (value: T, index: number, array: T[]) => void): void;
    filter(callback: (value: T, index: number, array: T[]) => boolean): T[];
}
declare class Function extends Object {}
declare class RegExp extends Object {}
declare class IArguments extends Object {}

