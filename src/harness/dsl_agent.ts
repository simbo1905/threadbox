/**
 * DSL Agent Executor - wraps the agent-dsl program as an AgentExecutor
 * compatible with A2A Express patterns.
 */

import { Observable, lastValueFrom } from 'rxjs';
import { RxRuntime, type Runtime, type Ctx, type Tools } from '../runtime/index.js';

// A2A-style interfaces (minimal implementation for PoC)
export interface Message {
  id?: string;
  content: string;
  role?: 'user' | 'assistant';
  timestamp?: number;
}

export interface Task {
  id: string;
  status: 'submitted' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface RequestContext {
  contextId: string;
  taskId?: string;
  message: Message;
}

export interface ExecutionEventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: (data: any) => void): void;
}

export interface AgentExecutor {
  execute(ctx: RequestContext, bus: ExecutionEventBus): Promise<void>;
}

/**
 * Simple in-memory event bus implementation
 */
class SimpleEventBus implements ExecutionEventBus {
  private handlers = new Map<string, Array<(data: any) => void>>();

  emit(event: string, data: any): void {
    const eventHandlers = this.handlers.get(event) || [];
    for (const handler of eventHandlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }
}

/**
 * DSL Agent Executor that runs agent-dsl programs
 */
export class DSLAgentExecutor implements AgentExecutor {
  constructor(
    private runtime: Runtime = RxRuntime,
    private tools?: Tools
  ) {}

  async execute(ctx: RequestContext, bus: ExecutionEventBus): Promise<void> {
    try {
      // Create a simple echo/summarize agent for PoC
      const result = await this.runSimpleAgent(ctx.message, ctx);
      
      // Emit the result as a message
      const responseMessage: Message = {
        id: `response-${Date.now()}`,
        content: result,
        role: 'assistant',
        timestamp: Date.now()
      };

      bus.emit('message', responseMessage);

    } catch (error) {
      console.error('[DSLAgentExecutor] Error executing agent:', error);
      
      // Emit error as a failed task
      const task: Task = {
        id: ctx.taskId || `task-${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };

      bus.emit('task', task);
    }
  }

  /**
   * Simple agent implementation for PoC - echoes/summarizes the input
   */
  private async runSimpleAgent(message: Message, ctx: RequestContext): Promise<string> {
    const input = message.content || '';
    
    // Simple logic: if input is short, echo it; if long, summarize
    if (input.length <= 50) {
      return `Echo: ${input}`;
    } else {
      const wordCount = input.split(/\s+/).length;
      const charCount = input.length;
      return `Summary: Received ${wordCount} words (${charCount} characters). Content starts with: "${input.substring(0, 100)}${input.length > 100 ? '...' : ''}"`;
    }
  }

  /**
   * Run a real DSL program (for future enhancement)
   */
  private async runDSLProgram(program: any, ctx: RequestContext): Promise<any> {
    // This would transpile and execute a real DSL program
    // For now, we'll use the simple agent above
    
    const tools: Tools = this.tools || {
      runShell: (cmd: string) => {
        console.log(`[Mock] runShell: ${cmd}`);
        return new Observable(subscriber => {
          subscriber.next(Buffer.from(`Mock output for: ${cmd}`));
          subscriber.complete();
        });
      },
      callApi: (name: string, payload?: unknown) => {
        console.log(`[Mock] callApi: ${name}`, payload);
        return new Observable(subscriber => {
          subscriber.next({ mockResponse: `API ${name} called`, payload });
          subscriber.complete();
        });
      },
      log: (input: any) => {
        console.log('[DSL Log]', input);
        return new Observable(subscriber => {
          subscriber.next(void 0);
          subscriber.complete();
        });
      }
    };

    const dslCtx: Ctx = {
      tools,
      log: (x: unknown) => console.log('[DSL Context Log]', x)
    };

    // Import and run the generated main function
    // const { main } = await import(generatedProgramPath);
    // const result$ = await main(this.runtime, dslCtx);
    // return await lastValueFrom(result$);
    
    // For PoC, return mock result
    return { result: 'DSL program executed successfully' };
  }
}

/**
 * Create a simple event bus for testing
 */
export function createEventBus(): ExecutionEventBus {
  return new SimpleEventBus();
}