/**
 * Node.js fallback for telemetry when Web Workers are not available.
 * Uses direct Azure blob operations instead of worker threads.
 */

import { BlobServiceClient, AppendBlobClient } from '@azure/storage-blob';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
const containerName = process.env.A2A_POC_CONTAINER || 'a2a-poc';

let blobServiceClient: BlobServiceClient | null = null;
let containerClient: any = null;

async function ensureContainer() {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);
    try {
      await containerClient.createIfNotExists();
    } catch (error) {
      console.warn('[Telemetry] Failed to create container (might be Azurite not running):', error instanceof Error ? error.message : String(error));
    }
  }
}

function generateBlobName(contextId?: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = Date.now();
  const suffix = contextId || `msg-${timestamp}`;
  return `${date}/context-${suffix}.ndjson`;
}

export async function appendToBlob(data: Uint8Array, contextId?: string): Promise<void> {
  try {
    await ensureContainer();
    
    if (!containerClient) {
      console.warn('[Telemetry] Container client not initialized, skipping blob write');
      return;
    }
    
    const blobName = generateBlobName(contextId);
    const appendBlobClient = containerClient.getAppendBlobClient(blobName);
    
    try {
      // Create the append blob if it doesn't exist
      await appendBlobClient.createIfNotExists();
      
      // Append the data block
      await appendBlobClient.appendBlock(data, data.length);
      
      console.log(`[Telemetry] Appended ${data.length} bytes to blob: ${blobName}`);
    } catch (error) {
      console.warn(`[Telemetry] Failed to append to blob ${blobName}, trying fallback:`, error instanceof Error ? error.message : String(error));
      
      // Fallback: if append blob operations fail, try using block blob with put
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.upload(data, data.length, {
          overwrite: true
        });
        console.log(`[Telemetry] Fallback: Uploaded ${data.length} bytes as block blob: ${blobName}`);
      } catch (fallbackError) {
        console.warn(`[Telemetry] Both append and fallback failed for blob ${blobName}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      }
    }
  } catch (error) {
    console.warn('[Telemetry] Error in appendToBlob:', error instanceof Error ? error.message : String(error));
  }
}