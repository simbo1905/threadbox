/**
 * Unit tests for AzureAppendClient API surface.
 * Validates ensureAppendBlob, append, readAll operations.
 */
import { test, expect } from "bun:test";
import { AzureAppendClient } from "../src/index";
import { BlobServiceClient } from "@azure/storage-blob";

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING || "UseDevelopmentStorage=true";
const SKIP = !!process.env.POC_AGENT_DSL;

function unique(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now()}${rand}`.toLowerCase();
}

async function cleanupContainer(containerName: string) {
  const svc = BlobServiceClient.fromConnectionString(CONN);
  const cc = svc.getContainerClient(containerName);
  try {
    await cc.deleteIfExists();
  } catch {}
}

test("ensureAppendBlob creates container and blob idempotently", async () => {
  if (SKIP) return;
  const client = new AzureAppendClient({ connectionString: CONN });
  const container = unique("c-");
  const blob = unique("b-");

  try {
    await client.ensureAppendBlob(container, blob);
    // idempotent
    await client.ensureAppendBlob(container, blob);

    const svc = BlobServiceClient.fromConnectionString(CONN);
    const cc = svc.getContainerClient(container);
    const props = await cc.getProperties();
    expect(props).toBeDefined();
  } finally {
    await cleanupContainer(container);
  }
});

test("append then readAll returns concatenated content", async () => {
  if (SKIP) return;
  const client = new AzureAppendClient({ connectionString: CONN });
  const container = unique("c-");
  const blob = unique("b-");

  try {
    await client.ensureAppendBlob(container, blob);
    await client.append(container, blob, "Hello ");
    await client.append(container, blob, "World");
    const bytes = await client.readAll(container, blob);
    expect(Buffer.from(bytes).toString()).toBe("Hello World");
  } finally {
    await cleanupContainer(container);
  }
});

test("readAll on empty append blob returns empty buffer", async () => {
  if (SKIP) return;
  const client = new AzureAppendClient({ connectionString: CONN });
  const container = unique("c-");
  const blob = unique("b-");
  try {
    await client.ensureAppendBlob(container, blob);
    const bytes = await client.readAll(container, blob);
    expect(bytes.byteLength).toBe(0);
  } finally {
    await cleanupContainer(container);
  }
});
