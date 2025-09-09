import { BlobServiceClient, AppendBlobClient, ContainerClient } from "@azure/storage-blob";

export type AppendData = string | Uint8Array | Buffer;

export class AzureAppendClient {
  private service: BlobServiceClient;

  constructor(opts: { connectionString: string }) {
    this.service = BlobServiceClient.fromConnectionString(opts.connectionString);
  }

  private container(container: string): ContainerClient {
    return this.service.getContainerClient(container);
  }

  private appendBlob(container: string, blob: string): AppendBlobClient {
    return this.container(container).getAppendBlobClient(blob);
  }

  async ensureAppendBlob(container: string, blob: string): Promise<void> {
    const cc = this.container(container);
    await cc.createIfNotExists();
    const abc = cc.getAppendBlobClient(blob);
    await abc.createIfNotExists();
  }

  async append(container: string, blob: string, data: AppendData): Promise<void> {
    const abc = this.appendBlob(container, blob);
    const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    await abc.appendBlock(buf, buf.length);
  }

  async readAll(container: string, blob: string): Promise<Uint8Array> {
    const abc = this.appendBlob(container, blob);
    const buf = await abc.downloadToBuffer();
    return new Uint8Array(buf);
  }
}

