// Test natural TypeScript function overload dispatch

// Example 1: Basic overloads with natural syntax

function func(value: string): string {
    return "String: " + value;
}

function func(value: number): string {
    return "Number: " + value;
}

function func(value: boolean): string {
    return "Boolean: " + value;
}
/*
function func(value: string): string;
function func(value: number): string;
function func(value: boolean): string;
function func(value: string|number|boolean): string {
    if (typeof value === "string") {
        return "String: " + value;
    } else if (typeof value === "number") {
        return "Number: " + value;
    } else if (typeof value === "boolean") {
        return "Boolean: " + value;
    }
}
*/
// Example 2: Array overloads

function handle(items: any[]): string {
    return "Numbers: " + items.map(n => n.toString()).join(", ");
}

function handle(items: string[]): string {
    return "Strings: " + items.join(", ");
}

// Example 3: Method overloads

class Processor {
    constructor(public begin: string) {}
    process(value: string): string {
        return this.begin + "String: " + value;
    }

    process(value: number): string {
        return "Number: " + value;
    }

    process(value: boolean): string {
        return "Boolean: " + value;
    }
}
// Usage - should be automatically dispatched!
console.log("=== Natural TypeScript Overload Dispatch ===");
console.log(func("hello"));        // Should become process$s("hello")
console.log(func(42));             // Should become process$n(42)
console.log(func(true));           // Should become process$b(true)

console.log("\n=== Array Dispatch ===");
console.log(handle(["a", "b", "c"])); // Should become handle$As(["a", "b", "c"])
console.log(handle([1, 2, 3]));       // Should become handle$Aa([1, 2, 3])

const processor = new Processor("!");
console.log(processor.process("hello"));        // Should become process$s("hello")
console.log(processor.process(42));             // Should become process$n(42)
console.log(processor.process(true));           // Should become process$b(true)
