// Test case for operator overloading
// Should be placed in tests/cases/compiler/operatorOverloading.ts

interface Iaddable<T> {
    add(other: T): T;
}

class Point implements Iaddable<Point> {
    constructor(public x: number, public y: number) {}
    
    add(other: number): Point {
        return new Point(this.x + other, this.y + other);
    }
    add(other: Point): Point {
        return new Point(this.x + other.x, this.y + other.y);
    }
    sub(other: Point): Point {
        return new Point(this.x - other.x, this.y - other.y);
    }
    rsub(other: number): Point {
        return new Point(other - this.x, other - this.y);
    }
    mul(other: Point): Point {
        return new Point(this.x * other.x, this.y * other.y);
    }
    div(other: Point): Point {
        return new Point(this.x / other.x, this.y / other.y);
    }
    mod(other: Point): Point {
        return new Point(this.x % other.x, this.y % other.y);
    }
    not(): Point {
        return new Point(this.x === 0 ? 1 : 0, this.y === 0 ? 1 : 0);
    }
    cmp(other: Point): number {
        return this.x === other.x ? (this.y - other.y) : (this.x - other.x);
    }

    //lt(other: Point): boolean {
    //    return this.x < other.x && this.y < other.y;
    //}
    eq(other: Point): boolean {
        return this.x === other.x && this.y === other.y;
    }
    /*
    le(other: Point): boolean {
        return this.x <= other.x && this.y <= other.y;
    }
    gt(other: Point): boolean {
        return this.x > other.x && this.y > other.y;
    }
    ge(other: Point): boolean {
        return this.x >= other.x && this.y >= other.y;
    }
    eq(other: Point): boolean {
        return this.x === other.x && this.y === other.y;
    }
    ne(other: Point): boolean {
        return this.x !== other.x || this.y !== other.y;
    }
    */
}

// This should compile and transform
const p1 = new Point(1, 2);
const p2 = new Point(3, 4);

console.log(1 < 2);
const t = p1 < 1;

// With operator overloading enabled:
let p3 = p1 + p2;
p3 = 1 - p3;
p3 += !p2; // Testing += operator as well
p3 *= p1;
// Should become: const p3 = p1.add(p2);

// Expected result: Point(4, 6)