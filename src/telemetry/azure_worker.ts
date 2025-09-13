/**
 * Bun Worker for Azure Append Blob operations.
 * Receives batched NDJSON chunks and appends them to Azure Append Blob storage.
 */

import { BlobServiceClient, AppendBlobClient } from '@azure/storage-blob';

interface WorkerMessage {
  type: 'append' | 'close';
  u8?: Uint8Array;
}

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
const containerName = process.env.A2A_POC_CONTAINER || 'a2a-poc';

let blobServiceClient: BlobServiceClient | null = null;
let containerClient: any = null;
let currentBlobClient: AppendBlobClient | null = null;
let currentBlobName: string | null = null;

async function ensureContainer() {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();
  }
}

function generateBlobName(contextId?: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = Date.now();
  const suffix = contextId || `msg-${timestamp}`;
  return `${date}/context-${suffix}.ndjson`;
}

async function appendToBlob(data: Uint8Array, contextId?: string) {
  await ensureContainer();
  
  // For PoC simplicity, create a new blob for each batch
  // In production, you might want to reuse blobs per context/session
  const blobName = generateBlobName(contextId);
  const appendBlobClient = containerClient!.getAppendBlobClient(blobName);
  
  try {
    // Create the append blob if it doesn't exist
    await appendBlobClient.createIfNotExists();
    
    // Append the data block
    await appendBlobClient.appendBlock(data, data.length);
    
    console.log(`[Worker] Appended ${data.length} bytes to blob: ${blobName}`);
  } catch (error) {
    console.error(`[Worker] Failed to append to blob ${blobName}:`, error);
    
    // Fallback: if append blob operations fail, try using block blob with put
    try {
      const blockBlobClient = containerClient!.getBlockBlobClient(blobName);
      await blockBlobClient.upload(data, data.length, {
        overwrite: true
      });
      console.log(`[Worker] Fallback: Uploaded ${data.length} bytes as block blob: ${blobName}`);
    } catch (fallbackError) {
      console.error(`[Worker] Fallback also failed for blob ${blobName}:`, fallbackError);
      throw fallbackError;
    }
  }
}

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  const message: WorkerMessage = event.data;
  
  try {
    switch (message.type) {
      case 'append':
        if (message.u8) {
          await appendToBlob(message.u8);
        }
        break;
        
      case 'close':
        console.log('[Worker] Received close signal, shutting down...');
        // Flush any remaining operations if needed
        self.close();
        break;
        
      default:
        console.warn(`[Worker] Unknown message type: ${message.type}`);
    }
  } catch (error) {
    console.error('[Worker] Error processing message:', error);
  }
});

console.log('[Worker] Azure worker started, ready to receive messages');