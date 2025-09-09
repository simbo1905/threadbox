import { test, expect } from "bun:test";

test("basic math", () => {
  expect(2 + 2).toBe(4);
});

test("string concatenation", () => {
  expect("hello" + " " + "world").toBe("hello world");
});

test("array operations", () => {
  const arr = [1, 2, 3];
  expect(arr.length).toBe(3);
  expect(arr.includes(2)).toBe(true);
});