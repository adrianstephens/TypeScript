// Test function overload dispatch using naming conventions

// Example 1: Multiple implementations with naming convention
// Implementation functions follow pattern: functionName$<typeSignature>

function processValue$string(value: string): string {
    return "String: " + value;
}

function processValue$number(value: number): string {
    return "Number: " + value;
}

function processValue$boolean(value: boolean): string {
    return "Boolean: " + value;
}

// Function declarations and default implementation
function processValue(value: string): string;
function processValue(value: number): string;
function processValue(value: boolean): string;
function processValue(value: any): string {
    // Default implementation - should be replaced by transformer
    throw new Error("No implementation found for type");
}

// Usage examples - should be transformed to call specific implementations
const result1 = processValue("hello");     // should become processValue$string("hello")
const result2 = processValue(42);          // should become processValue$number(42)
const result3 = processValue(true);        // should become processValue$boolean(true)

// Example 2: More complex types
interface User {
    name: string;
}

interface Product {
    price: number;
}

function transform$User(obj: User): string {
    return `User: ${obj.name}`;
}

function transform$Product(obj: Product): string {
    return `Product: $${obj.price}`;
}

function transform(obj: User): string;
function transform(obj: Product): string;
function transform(obj: any): string {
    throw new Error("No implementation found for type");
}

const user: User = { name: "Alice" };
const product: Product = { price: 99.99 };

const userResult = transform(user);       // should become transform$User(user)
const productResult = transform(product); // should become transform$Product(product)

// Example 3: Generic dispatch with array types
function handle$Array_string(items: string[]): number {
    return items.length;
}

function handle$Array_number(items: number[]): number {
    return items.reduce((a, b) => a + b, 0);
}

function handle(items: string[]): number;
function handle(items: number[]): number;
function handle(items: any[]): number {
    throw new Error("No implementation found for array type");
}

const stringCount = handle(["a", "b", "c"]);  // should become handle$Array_string(["a", "b", "c"])
const numberSum = handle([1, 2, 3]);          // should become handle$Array_number([1, 2, 3])