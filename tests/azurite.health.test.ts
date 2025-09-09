import { test, expect } from "bun:test";

const HEALTH_URL = "http://127.0.0.1:10000/devstoreaccount1?comp=list";

test("azurite health responds on 10000", async () => {
  const res = await fetch(HEALTH_URL, { method: "GET" });
  // Azurite may return 401 without auth; we only care it's reachable (not a network error)
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(600);
});

