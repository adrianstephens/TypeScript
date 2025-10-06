// @functionOverloadDispatch: true

// Test automatic function overload dispatch transformation

// Basic function overloads with primitive types
function processValue(value: string): string {
    return "String: " + value;
}

function processValue(value: number): string {
    return "Number: " + value;
}

function processValue(value: boolean): string {
    return "Boolean: " + value;
}

// Array type overloads
function handleArray(items: string[]): string {
    return "Strings: " + items.join(", ");
}

function handleArray(items: number[]): string {
    return "Numbers: " + items.map(n => n.toString()).join(", ");
}

function handleArray(items: boolean[]): string {
    return "Booleans: " + items.map(b => b.toString()).join(", ");
}

// Interface-based overloads
interface User {
    name: string;
}

interface Product {
    id: number;
    price: number;
}

function transform(obj: User): string {
    return `User: ${obj.name}`;
}

function transform(obj: Product): string {
    return `Product #${obj.id}: $${obj.price}`;
}

// Class method overloads
class DataProcessor {
    constructor(public prefix: string) {}
    
    process(value: string): string {
        return this.prefix + "String: " + value;
    }

    process(value: number): string {
        return this.prefix + "Number: " + value;
    }

    process(value: boolean): string {
        return this.prefix + "Boolean: " + value;
    }
}

// Generic function overloads
function convert(value: string): number {
    return value.length;
}

function convert(value: number): string {
    return value.toString();
}

function convert(value: boolean): number {
    return value ? 1 : 0;
}

// Usage examples - should be automatically dispatched to specific implementations
const result1 = processValue("hello");
const result2 = processValue(42);
const result3 = processValue(true);

const arrayResult1 = handleArray(["a", "b", "c"]);
const arrayResult2 = handleArray([1, 2, 3]);
const arrayResult3 = handleArray([true, false, true]);

const user: User = { name: "Alice" };
const product: Product = { id: 123, price: 99.99 };
const userResult = transform(user);
const productResult = transform(product);

const processor = new DataProcessor("Processed: ");
const methodResult1 = processor.process("test");
const methodResult2 = processor.process(100);
const methodResult3 = processor.process(false);

const converted1 = convert("typescript");
const converted2 = convert(42);
const converted3 = convert(true);
