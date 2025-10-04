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

// Example 2: Array overloads

function handle(items: any[]): string {
    return "Numbers: " + items.map(n => n.toString()).join(", ");
}

function handle(items: string[]): string {
    return "Strings: " + items.join(", ");
}

// Usage - should be automatically dispatched!
console.log("=== Natural TypeScript Overload Dispatch ===");
console.log(func("hello"));        // Should become process$string("hello")
console.log(func(42));             // Should become process$number(42)
console.log(func(true));           // Should become process$boolean(true)

console.log("\n=== Array Dispatch ===");
console.log(handle(["a", "b", "c"])); // Should become handle$Array_string(["a", "b", "c"])
console.log(handle([1, 2, 3]));       // Should become handle$Array_number([1, 2, 3])