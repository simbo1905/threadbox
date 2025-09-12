/**
 * Azurite connectivity test - HTTP GET to local blob endpoint.
 * Prerequisite check before running append tests.
 */
import { test, expect } from "bun:test";

const SKIP = !!process.env.POC_AGENT_DSL;

const HEALTH_URL = "http://127.0.0.1:10000/devstoreaccount1?comp=list";

test("azurite health responds on 10000", async () => {
  if (SKIP) return;
  const res = await fetch(HEALTH_URL, { method: "GET" });
  // Azurite may return 401 without auth; we only care it's reachable (not a network error)
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(600);
});
