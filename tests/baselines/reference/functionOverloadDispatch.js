//// [tests/cases/compiler/functionOverloadDispatch.ts] ////

//// [functionOverloadDispatch.ts]
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


//// [functionOverloadDispatch.js]
// Test automatic function overload dispatch transformation
function processValue$s(value) {
    return "String: " + value;
}
function processValue$n(value) {
    return "Number: " + value;
}
function processValue$b(value) {
    return "Boolean: " + value;
}
function handleArray$As(items) {
    return "Strings: " + items.join(", ");
}
function handleArray$An(items) {
    return "Numbers: " + items.map(function (n) { return n.toString(); }).join(", ");
}
function handleArray$Ab(items) {
    return "Booleans: " + items.map(function (b) { return b.toString(); }).join(", ");
}
function transform$OUser(obj) {
    return "User: ".concat(obj.name);
}
function transform$OProduct(obj) {
    return "Product #".concat(obj.id, ": $").concat(obj.price);
}
// Class method overloads
var DataProcessor = /** @class */ (function () {
    function DataProcessor(prefix) {
        this.prefix = prefix;
    }
    DataProcessor.prototype.process$s = function (value) {
        return this.prefix + "String: " + value;
    };
    DataProcessor.prototype.process$n = function (value) {
        return this.prefix + "Number: " + value;
    };
    DataProcessor.prototype.process$b = function (value) {
        return this.prefix + "Boolean: " + value;
    };
    return DataProcessor;
}());
function convert$s(value) {
    return value.length;
}
function convert$n(value) {
    return value.toString();
}
function convert$b(value) {
    return value ? 1 : 0;
}
// Usage examples - should be automatically dispatched to specific implementations
var result1 = processValue$s("hello");
var result2 = processValue$n(42);
var result3 = processValue$b(true);
var arrayResult1 = handleArray$As(["a", "b", "c"]);
var arrayResult2 = handleArray$An([1, 2, 3]);
var arrayResult3 = handleArray$Ab([true, false, true]);
var user = { name: "Alice" };
var product = { id: 123, price: 99.99 };
var userResult = transform$OUser(user);
var productResult = transform$OProduct(product);
var processor = new DataProcessor("Processed: ");
var methodResult1 = processor.process$s("test");
var methodResult2 = processor.process$n(100);
var methodResult3 = processor.process$b(false);
var converted1 = convert$s("typescript");
var converted2 = convert$n(42);
var converted3 = convert$b(true);
