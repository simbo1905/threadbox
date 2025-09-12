import AnthropicSDK from '@anthropic-ai/sdk';
import { ConfigLoader, AnthropicConfig } from './config';

export class AnthropicClient {
  private client: AnthropicSDK;
  private config: AnthropicConfig;

  constructor(config: AnthropicConfig) {
    this.config = config;
    this.client = new AnthropicSDK({
      apiKey: config.api_key,
      baseURL: config.base_url,
      timeout: config.timeout,
    });
  }

  get messages() {
    return this.client.messages;
  }

  getConfig(): AnthropicConfig {
    return { ...this.config };
  }

}

export class AnthropicClientBuilder {
  private config: Partial<AnthropicConfig> = {};

  withDefaults(configPath?: string): this {
    const defaultConfig = ConfigLoader.loadFromToml(configPath);
    this.config = { ...this.config, ...defaultConfig };
    return this;
  }

  withEnv(configPath?: string): this {
    const envConfig = ConfigLoader.loadWithEnvOverrides(configPath);
    this.config = { ...this.config, ...envConfig };
    return this;
  }

  model(modelName: string): this {
    this.config.model = modelName;
    return this;
  }

  apiKey(key: string): this {
    this.config.api_key = key;
    return this;
  }

  maxTokens(tokens: number): this {
    this.config.max_tokens = tokens;
    return this;
  }

  baseUrl(url: string): this {
    this.config.base_url = url;
    return this;
  }

  timeout(ms: number): this {
    this.config.timeout = ms;
    return this;
  }

  build(): AnthropicClient {
    // Validate required fields
    if (!this.config.api_key) {
      throw new Error('API key is required');
    }
    if (!this.config.model) {
      throw new Error('Model is required');
    }
    if (!this.config.max_tokens) {
      throw new Error('Max tokens is required');
    }
    if (!this.config.base_url) {
      throw new Error('Base URL is required');
    }
    if (!this.config.timeout) {
      throw new Error('Timeout is required');
    }

    return new AnthropicClient(this.config as AnthropicConfig);
  }
}

// Factory function for convenient usage
export class AnthropicFactory {
  static client(): AnthropicClientBuilder {
    return new AnthropicClientBuilder();
  }
}

// Export for convenience
export const Anthropic = AnthropicFactory;