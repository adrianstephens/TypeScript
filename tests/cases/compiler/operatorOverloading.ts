// @operatorOverloading: true

// Test operator overloading transformation

// Interface for addable types
interface Addable<T> {
    add(other: T): T;
}

// Point class with comprehensive operator overloads
class Point implements Addable<Point> {
    constructor(public x: number, public y: number) {}
    
    // Addition overloads
    add(other: number): Point {
        return new Point(this.x + other, this.y + other);
    }
    
    add(other: Point): Point {
        return new Point(this.x + other.x, this.y + other.y);
    }
    
    // Subtraction overloads
    sub(other: Point): Point {
        return new Point(this.x - other.x, this.y - other.y);
    }
    
    sub(other: number): Point {
        return new Point(this.x - other, this.y - other);
    }
    
    // Right-hand subtraction (for when Point is on right side)
    rsub(other: number): Point {
        return new Point(other - this.x, other - this.y);
    }
    
    // Multiplication overloads
    mul(other: Point): Point {
        return new Point(this.x * other.x, this.y * other.y);
    }
    
    mul(other: number): Point {
        return new Point(this.x * other, this.y * other);
    }
    
    // Division overloads
    div(other: Point): Point {
        return new Point(this.x / other.x, this.y / other.y);
    }
    
    div(other: number): Point {
        return new Point(this.x / other, this.y / other);
    }
    
    // Modulus overload
    mod(other: Point): Point {
        return new Point(this.x % other.x, this.y % other.y);
    }
    
    // Logical NOT overload
    not(): Point {
        return new Point(this.x === 0 ? 1 : 0, this.y === 0 ? 1 : 0);
    }
    
    // Comparison overloads
    cmp(other: Point): number {
        return this.x === other.x ? (this.y - other.y) : (this.x - other.x);
    }
    
    eq(other: Point): boolean {
        return this.x === other.x && this.y === other.y;
    }
    
    ne(other: Point): boolean {
        return this.x !== other.x || this.y !== other.y;
    }
    
    lt(other: Point): boolean {
        return this.x < other.x && this.y < other.y;
    }
    
    le(other: Point): boolean {
        return this.x <= other.x && this.y <= other.y;
    }
    
    gt(other: Point): boolean {
        return this.x > other.x && this.y > other.y;
    }
    
    ge(other: Point): boolean {
        return this.x >= other.x && this.y >= other.y;
    }
}

// Vector class for additional testing
class Vector {
    constructor(public values: number[]) {}
    
    add(other: Vector): Vector {
        return new Vector(this.values.map((v, i) => v + other.values[i]));
    }
    
    mul(scalar: number): Vector {
        return new Vector(this.values.map(v => v * scalar));
    }
    
    eq(other: Vector): boolean {
        return this.values.every((v, i) => v === other.values[i]);
    }
}

// Usage examples - should be transformed to method calls
const p1 = new Point(1, 2);
const p2 = new Point(3, 4);

// Binary arithmetic operators
const p3 = p1 + p2;        // Should become: p1.add(p2)
const p4 = p1 - p2;        // Should become: p1.sub(p2)
const p5 = p1 * p2;        // Should become: p1.mul(p2)
const p6 = p1 / p2;        // Should become: p1.div(p2)
const p7 = p1 % p2;        // Should become: p1.mod(p2)

// Mixed type operations
const p8 = p1 + 5;         // Should become: p1.add(5)
const p9 = p1 * 2;         // Should become: p1.mul(2)
const p10 = 10 - p1;       // Should become: p1.rsub(10)

// Unary operators
const p11 = !p1;           // Should become: p1.not()

// Comparison operators
const isEqual = p1 == p2;   // Should become: p1.eq(p2)
const isNotEqual = p1 != p2; // Should become: p1.ne(p2)
const isLess = p1 < p2;     // Should become: p1.lt(p2)
const isLessEq = p1 <= p2;  // Should become: p1.le(p2)
const isGreater = p1 > p2;  // Should become: p1.gt(p2)
const isGreaterEq = p1 >= p2; // Should become: p1.ge(p2)

// Compound assignment operators
let p12 = new Point(0, 0);
p12 += p1;                 // Should become: p12 = p12.add(p1)
p12 -= p2;                 // Should become: p12 = p12.sub(p2)
p12 *= 3;                  // Should become: p12 = p12.mul(3)
p12 /= 2;                  // Should become: p12 = p12.div(2)

// Vector operations
const v1 = new Vector([1, 2, 3]);
const v2 = new Vector([4, 5, 6]);
const v3 = v1 + v2;        // Should become: v1.add(v2)
const v4 = v1 * 2;         // Should become: v1.mul(2)
const vectorsEqual = v1 == v2; // Should become: v1.eq(v2)