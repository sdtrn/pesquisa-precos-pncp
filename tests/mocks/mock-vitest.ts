import { describe as nodeDescribe, it as nodeIt, test as nodeTest } from "node:test";
import assert from "node:assert/strict";

export const describe = nodeDescribe;
export const it = nodeIt;
export const test = nodeTest;
export const suite = nodeDescribe;

function createMatcher(actual: any, isNot = false): any {
  const check = (condition: boolean, msg?: string) => {
    if (isNot ? condition : !condition) {
      assert.fail(msg || "Expectation failed");
    }
  };

  return {
    get not() {
      return createMatcher(actual, !isNot);
    },
    toBe(expected: any) {
      if (isNot) {
        assert.notStrictEqual(actual, expected);
      } else {
        assert.strictEqual(actual, expected);
      }
    },
    toEqual(expected: any) {
      if (isNot) {
        assert.notDeepStrictEqual(actual, expected);
      } else {
        assert.deepStrictEqual(actual, expected);
      }
    },
    toStrictEqual(expected: any) {
      if (isNot) {
        assert.notDeepStrictEqual(actual, expected);
      } else {
        assert.deepStrictEqual(actual, expected);
      }
    },
    toBeDefined() {
      check(actual !== undefined, `Expected ${actual} to be defined`);
    },
    toBeUndefined() {
      check(actual === undefined, `Expected ${actual} to be undefined`);
    },
    toBeNull() {
      check(actual === null, `Expected ${actual} to be null`);
    },
    toBeTruthy() {
      check(Boolean(actual), `Expected ${actual} to be truthy`);
    },
    toBeFalsy() {
      check(!actual, `Expected ${actual} to be falsy`);
    },
    toBeGreaterThan(expected: number) {
      check(actual > expected, `Expected ${actual} > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected: number) {
      check(actual >= expected, `Expected ${actual} >= ${expected}`);
    },
    toBeLessThan(expected: number) {
      check(actual < expected, `Expected ${actual} < ${expected}`);
    },
    toBeLessThanOrEqual(expected: number) {
      check(actual <= expected, `Expected ${actual} <= ${expected}`);
    },
    toContain(expected: any) {
      if (typeof actual === "string" || Array.isArray(actual)) {
        check(actual.includes(expected), `Expected ${actual} to contain ${expected}`);
      } else if (actual instanceof Set || actual instanceof Map) {
        check(actual.has(expected), `Expected ${actual} to contain ${expected}`);
      } else {
        assert.fail("toContain target is not iterable");
      }
    },
    toHaveLength(expected: number) {
      check(actual?.length === expected, `Expected length ${expected}, got ${actual?.length}`);
    },
    toMatch(pattern: RegExp | string) {
      if (isNot) {
        assert.doesNotMatch(String(actual), pattern instanceof RegExp ? pattern : new RegExp(pattern));
      } else {
        assert.match(String(actual), pattern instanceof RegExp ? pattern : new RegExp(pattern));
      }
    },
    toBeCloseTo(expected: number, precision = 2) {
      const diff = Math.abs(actual - expected);
      const tolerance = Math.pow(10, -precision) / 2;
      check(diff < tolerance, `Expected ${actual} to be close to ${expected}`);
    },
    toThrow(expected?: any) {
      if (typeof actual === "function") {
        if (isNot) {
          assert.doesNotThrow(actual);
        } else {
          assert.throws(actual, expected);
        }
      }
    },
  };
}

export function expect(actual: any) {
  return createMatcher(actual);
}

export const vi = {
  fn: () => () => {},
  spyOn: () => () => {},
};

export const beforeEach = () => {};
export const afterEach = () => {};
export const beforeAll = () => {};
export const afterAll = () => {};
