/**
 * A2A Express Server with telemetry integration.
 * Minimal Express server that wraps the DSL agent and logs interactions to Azure.
 */

import express from 'express';
import { DSLAgentExecutor, createEventBus, type Message, type Task, type RequestContext } from './dsl_agent.js';
import { createTelemetry, createInboundLine, createOutboundLine, type TelemetrySystem } from '../telemetry/index.js';

export interface AgentCard {
  name: string;
  description: string;
  version: string;
}

export interface TaskStore {
  create(task: Partial<Task>): Promise<Task>;
  get(id: string): Promise<Task | null>;
  update(id: string, updates: Partial<Task>): Promise<Task>;
}

/**
 * Simple in-memory task store
 */
class InMemoryTaskStore implements TaskStore {
  private tasks = new Map<string, Task>();

  async create(task: Partial<Task>): Promise<Task> {
    const fullTask: Task = {
      id: task.id || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: task.status || 'submitted',
      result: task.result,
      error: task.error
    };
    
    this.tasks.set(fullTask.id, fullTask);
    return fullTask;
  }

  async get(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const updated = { ...existing, ...updates };
    this.tasks.set(id, updated);
    return updated;
  }
}

/**
 * Default request handler that processes messages and tasks
 */
export class DefaultRequestHandler {
  constructor(
    private agentCard: AgentCard,
    private taskStore: TaskStore,
    private executor: DSLAgentExecutor
  ) {}

  async sendMessage(params: { message: Message; contextId?: string }): Promise<Message | Task> {
    const contextId = params.contextId || `ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bus = createEventBus();
    
    let result: Message | Task | null = null;
    
    // Listen for results
    bus.on('message', (message: Message) => {
      result = message;
    });

    bus.on('task', (task: Task) => {
      result = task;
    });

    // Create request context
    const requestContext: RequestContext = {
      contextId,
      message: params.message
    };

    // Execute the agent
    await this.executor.execute(requestContext, bus);

    // Return the result or create a completed task
    if (result) {
      return result;
    } else {
      // Fallback: create a completed task
      return await this.taskStore.create({
        status: 'completed',
        result: { message: 'No response generated' }
      });
    }
  }
}

/**
 * A2A Express App that sets up routes and middleware
 */
export class A2AExpressApp {
  private app: express.Application;

  constructor(private handler: DefaultRequestHandler, private telemetry?: TelemetrySystem) {
    this.app = express();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    // Basic CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });
  }

  setupRoutes(app?: express.Application): express.Application {
    const router = app || this.app;
    
    // Ensure JSON middleware is applied to the router
    if (app) {
      app.use(express.json());
      
      // Basic CORS for development
      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
          return;
        }
        next();
      });
    }
    
    // Attach telemetry to router for use in handlers
    if (this.telemetry) {
      (router as any).telemetry = this.telemetry;
    }

    // Health check endpoint
    router.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Message send endpoint
    router.post('/message/send', async (req, res) => {
      const startTime = Date.now();
      let telemetryContextId: string;
      
      try {
        const { message, contextId } = req.body || {};
        telemetryContextId = contextId || `ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        
        // Log inbound telemetry
        if ((router as any).telemetry) {
          (router as any).telemetry.emit(createInboundLine(telemetryContextId, {
            path: req.path,
            method: req.method,
            body: req.body
          }, startTime));
        }
        
        if (!message || typeof message.content !== 'string') {
          const errorResponse = { 
            error: 'Invalid message format. Expected { message: { content: string } }' 
          };
          
          // Log outbound telemetry for error
          if ((router as any).telemetry) {
            (router as any).telemetry.emit(createOutboundLine(telemetryContextId, {
              statusCode: 400,
              body: errorResponse
            }, Date.now()));
          }
          
          return res.status(400).json(errorResponse);
        }

        const result = await this.handler.sendMessage({ message, contextId: telemetryContextId });
        
        // Log outbound telemetry for success
        if ((router as any).telemetry) {
          (router as any).telemetry.emit(createOutboundLine(telemetryContextId, {
            statusCode: 200,
            body: result
          }, Date.now()));
        }
        
        res.json(result);
      } catch (error) {
        console.error('[A2AExpressApp] Error in message/send:', error);
        const errorResponse = { 
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        };
        
        // Log outbound telemetry for error
        if ((router as any).telemetry) {
          (router as any).telemetry.emit(createOutboundLine(telemetryContextId!, {
            statusCode: 500,
            body: errorResponse
          }, Date.now()));
        }
        
        res.status(500).json(errorResponse);
      }
    });

    return router;
  }

  getApp(): express.Application {
    return this.app;
  }
}

/**
 * Create and configure the A2A server with telemetry
 */
export function createA2AServer(port = 3000): {
  app: express.Application;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  telemetry: TelemetrySystem;
} {
  // Create telemetry system
  const telemetry = createTelemetry();

  // Create components
  const agentCard: AgentCard = {
    name: 'DSL Demo Agent',
    description: 'A simple agent that echoes short messages and summarizes long ones',
    version: '0.1.0'
  };

  const taskStore = new InMemoryTaskStore();
  const executor = new DSLAgentExecutor();
  const handler = new DefaultRequestHandler(agentCard, taskStore, executor);
  const a2aApp = new A2AExpressApp(handler, telemetry);
  
  const app = express();
  
  // Setup A2A routes (this includes JSON parsing middleware and telemetry)
  a2aApp.setupRoutes(app);

  let server: any = null;

  async function start(): Promise<void> {
    return new Promise((resolve, reject) => {
      server = app.listen(port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(`[A2A Server] Started on port ${port}`);
          resolve();
        }
      });
    });
  }

  async function stop(): Promise<void> {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    await telemetry.stop();
    console.log('[A2A Server] Stopped');
  }

  return { app, start, stop, telemetry };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || '3000');
  const { start, stop } = createA2AServer(port);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[A2A Server] Received SIGINT, shutting down gracefully...');
    await stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[A2A Server] Received SIGTERM, shutting down gracefully...');
    await stop();
    process.exit(0);
  });

  start().catch(error => {
    console.error('[A2A Server] Failed to start:', error);
    process.exit(1);
  });
}