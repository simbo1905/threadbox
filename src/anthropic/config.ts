import * as fs from 'node:fs';
import * as path from 'node:path';
import * as toml from 'toml';

export interface AnthropicConfig {
  api_key: string;
  model: string;
  max_tokens: number;
  base_url: string;
  timeout: number;
}

export class ConfigLoader {
  private static expandEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || '';
    });
  }

  static loadFromToml(configPath: string = 'config.toml'): AnthropicConfig {
    const fullPath = path.resolve(configPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Configuration file not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const parsed = toml.parse(content);

    // Expand environment variables
    const config: AnthropicConfig = {
      api_key: this.expandEnvVars(parsed.api_key || ''),
      model: parsed.model || 'claude-sonnet-4-20250514',
      max_tokens: parsed.max_tokens || 4096,
      base_url: parsed.base_url || 'https://api.anthropic.com/v1/',
      timeout: parsed.timeout || 60000,
    };

    return config;
  }

  static loadWithEnvOverrides(configPath?: string): AnthropicConfig {
    const config = this.loadFromToml(configPath);

    // Environment variable overrides
    if (process.env.ANTHROPIC_API_KEY) {
      config.api_key = process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.ANTHROPIC_MODEL) {
      config.model = process.env.ANTHROPIC_MODEL;
    }
    if (process.env.ANTHROPIC_MAX_TOKENS) {
      config.max_tokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10);
    }
    if (process.env.ANTHROPIC_BASE_URL) {
      config.base_url = process.env.ANTHROPIC_BASE_URL;
    }
    if (process.env.ANTHROPIC_TIMEOUT) {
      config.timeout = parseInt(process.env.ANTHROPIC_TIMEOUT, 10);
    }

    return config;
  }
}