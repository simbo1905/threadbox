import { test, expect } from "bun:test";
import { BlobServiceClient } from "@azure/storage-blob";

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING || "UseDevelopmentStorage=true";
const SKIP = !!process.env.POC_AGENT_DSL;

function uniqueName(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now()}${rand}`.toLowerCase();
}

test("append Hello then World and read back", async () => {
  if (SKIP) return;
  const service = BlobServiceClient.fromConnectionString(CONN);
  const containerName = uniqueName("t");
  const blobName = uniqueName("log");

  const container = service.getContainerClient(containerName);
  await container.createIfNotExists();
  const append = container.getAppendBlobClient(blobName);

  try {
    await append.createIfNotExists();
    await append.appendBlock(Buffer.from("Hello "), 6);
    await append.appendBlock(Buffer.from("World"), 5);

    const data = await append.downloadToBuffer();
    expect(data.toString()).toBe("Hello World");
  } finally {
    // cleanup best-effort
    try { await container.deleteIfExists(); } catch {}
  }
});
