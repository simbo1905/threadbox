/**
 * RxJS backend for agent-dsl runtime
 * 
 * Compiles IR to RxJS observables and provides execution environment
 */

import { Observable, of, throwError, EMPTY, combineLatest, merge, concat } from 'rxjs';
import { 
  map, 
  switchMap, 
  catchError, 
  filter, 
  debounceTime, 
  throttleTime,
  retry,
  timeout,
  mergeMap
} from 'rxjs/operators';

import { 
  IRPipeline, 
  IRStep, 
  IRExpression, 
  IROperation, 
  IRTool, 
  IRLiteral, 
  IRVariable,
  IRType 
} from '../ir/types';

export interface RuntimeContext {
  variables: Map<string, Observable<any>>;
  steps: Map<string, Observable<any>>;
  tools: Map<string, ToolFunction>;
}

export type ToolFunction = (input: any, config: Record<string, any>) => Observable<any>;

export interface ExecutionOptions {
  timeout?: number;
  retries?: number;
  debug?: boolean;
}

export class RxJSBackend {
  private tools: Map<string, ToolFunction> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Compile a pipeline to RxJS observables
   */
  compile(pipeline: IRPipeline): CompiledPipeline {
    const context: RuntimeContext = {
      variables: new Map(),
      steps: new Map(),
      tools: this.tools
    };

    // Create observables for each step
    const stepObservables = new Map<string, Observable<any>>();
    
    // Topologically sort steps based on dependencies
    const sortedSteps = this.topologicalSort(pipeline.steps);
    
    for (const step of sortedSteps) {
      const observable = this.compileExpression(step.expression, context);
      stepObservables.set(step.name, observable);
      context.steps.set(step.name, observable);
    }

    return new CompiledPipeline(pipeline, stepObservables, context);
  }

  /**
   * Register a custom tool function
   */
  registerTool(name: string, toolFn: ToolFunction): void {
    this.tools.set(name, toolFn);
  }

  private compileExpression(expr: IRExpression, context: RuntimeContext): Observable<any> {
    switch (expr.type) {
      case 'literal':
        return of((expr as IRLiteral).value);
        
      case 'variable':
        const variable = expr as IRVariable;
        const observable = context.variables.get(variable.name) || context.steps.get(variable.name);
        if (!observable) {
          return throwError(new Error(`Unknown variable: ${variable.name}`));
        }
        return observable;
        
      case 'operation':
        return this.compileOperation(expr as IROperation, context);
        
      case 'tool':
        return this.compileTool(expr as IRTool, context);
        
      default:
        return throwError(new Error(`Unknown expression type: ${expr.type}`));
    }
  }

  private compileOperation(op: IROperation, context: RuntimeContext): Observable<any> {
    const inputs = op.inputs.map(input => this.compileExpression(input, context));
    
    switch (op.operator) {
      case 'map':
        if (inputs.length !== 2) {
          return throwError(new Error('map requires exactly 2 inputs'));
        }
        return inputs[0].pipe(
          switchMap(value => {
            // For simplicity, assume second input is a function expression
            // In a full implementation, this would compile the function
            return this.applyFunction(inputs[1], value);
          })
        );
        
      case 'flatMap':
        if (inputs.length !== 2) {
          return throwError(new Error('flatMap requires exactly 2 inputs'));
        }
        return inputs[0].pipe(
          mergeMap(value => this.applyFunction(inputs[1], value))
        );
        
      case 'filter':
        if (inputs.length !== 2) {
          return throwError(new Error('filter requires exactly 2 inputs'));
        }
        return inputs[0].pipe(
          switchMap(value => 
            this.applyFunction(inputs[1], value).pipe(
              switchMap(result => result ? of(value) : EMPTY)
            )
          )
        );
        
      case 'zip':
        if (inputs.length !== 2) {
          return throwError(new Error('zip requires exactly 2 inputs'));
        }
        return combineLatest([inputs[0], inputs[1]]);
        
      case 'merge':
        return merge(...inputs);
        
      case 'concat':
        return concat(...inputs);
        
      case 'debounce':
        if (inputs.length < 2) {
          return throwError(new Error('debounce requires at least 2 inputs'));
        }
        return inputs[0].pipe(
          switchMap(value => 
            inputs[1].pipe(
              switchMap(time => of(value).pipe(debounceTime(Number(time))))
            )
          )
        );
        
      case 'throttle':
        if (inputs.length < 2) {
          return throwError(new Error('throttle requires at least 2 inputs'));
        }
        return inputs[0].pipe(
          switchMap(value => 
            inputs[1].pipe(
              switchMap(time => of(value).pipe(throttleTime(Number(time))))
            )
          )
        );
        
      case 'onError':
        if (inputs.length !== 2) {
          return throwError(new Error('onError requires exactly 2 inputs'));
        }
        return inputs[0].pipe(
          catchError(error => this.applyFunction(inputs[1], error))
        );
        
      case 'retry':
        const retryCount = inputs.length > 1 ? inputs[1] : of(3);
        return inputs[0].pipe(
          switchMap(value => 
            retryCount.pipe(
              switchMap(count => of(value).pipe(retry(Number(count))))
            )
          )
        );
        
      case 'timeout':
        const timeoutMs = inputs.length > 1 ? inputs[1] : of(5000);
        return inputs[0].pipe(
          switchMap(value => 
            timeoutMs.pipe(
              switchMap(ms => of(value).pipe(timeout(Number(ms))))
            )
          )
        );
        
      default:
        return throwError(new Error(`Unknown operator: ${op.operator}`));
    }
  }

  private compileTool(tool: IRTool, context: RuntimeContext): Observable<any> {
    const toolFn = context.tools.get(tool.toolName);
    if (!toolFn) {
      return throwError(new Error(`Unknown tool: ${tool.toolName}`));
    }
    
    // For now, tools operate on static input
    return toolFn(null, tool.config);
  }

  private applyFunction(fnExpr: Observable<any>, input: any): Observable<any> {
    // This is a simplified implementation
    // In a full implementation, this would compile and execute the function expression
    return fnExpr.pipe(map(() => input));
  }

  private topologicalSort(steps: IRStep[]): IRStep[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: IRStep[] = [];
    const stepMap = new Map(steps.map(s => [s.name, s]));
    
    const visit = (stepName: string): void => {
      if (visited.has(stepName)) return;
      if (visiting.has(stepName)) {
        throw new Error(`Circular dependency detected: ${stepName}`);
      }
      
      visiting.add(stepName);
      const step = stepMap.get(stepName);
      if (step) {
        step.dependencies.forEach(visit);
        result.push(step);
        visited.add(stepName);
      }
      visiting.delete(stepName);
    };
    
    steps.forEach(step => visit(step.name));
    return result;
  }

  private registerDefaultTools(): void {
    // Mock HTTP API tool
    this.registerTool('callApi', (input: any, config: Record<string, any>) => {
      const { url, method = 'POST', timeout = 5000 } = config;
      
      // Mock implementation - in real version would use fetch/axios
      return of({
        status: 200,
        data: { message: `Mock response from ${url}`, input },
        url,
        method
      }).pipe(
        // Simulate network delay
        switchMap(response => of(response))
      );
    });

    // Mock shell execution tool
    this.registerTool('runShell', (input: any, config: Record<string, any>) => {
      const { command, cwd, timeout = 10000 } = config;
      
      // Mock implementation
      return of({
        stdout: `Mock output from: ${command}`,
        stderr: '',
        exitCode: 0,
        command,
        cwd
      });
    });

    // Mock MCP tool
    this.registerTool('useMCP', (input: any, config: Record<string, any>) => {
      const { service, method, params } = config;
      
      return of({
        result: `Mock MCP result from ${service}.${method}`,
        service,
        method,
        params,
        input
      });
    });

    // File operations
    this.registerTool('readFile', (input: any, config: Record<string, any>) => {
      const { path, encoding = 'utf8' } = config;
      
      return of({
        content: `Mock file content from ${path}`,
        path,
        encoding,
        size: 1024
      });
    });

    this.registerTool('writeFile', (input: any, config: Record<string, any>) => {
      const { path, encoding = 'utf8' } = config;
      
      return of({
        success: true,
        path,
        encoding,
        bytesWritten: input?.toString().length || 0
      });
    });
  }
}

export class CompiledPipeline {
  constructor(
    private pipeline: IRPipeline,
    private stepObservables: Map<string, Observable<any>>,
    private context: RuntimeContext
  ) {}

  /**
   * Execute the pipeline with given inputs
   */
  run(inputs: Record<string, any>, options: ExecutionOptions = {}): Observable<Record<string, any>> {
    // Set up input observables
    this.pipeline.inputs.forEach(input => {
      const value = inputs[input.name] ?? input.defaultValue;
      if (value === undefined && !input.optional) {
        throw new Error(`Required input missing: ${input.name}`);
      }
      this.context.variables.set(input.name, of(value));
    });

    // Collect outputs
    const outputObservables = this.pipeline.outputs.map(output => {
      const stepObservable = this.stepObservables.get(output.stepName);
      if (!stepObservable) {
        throw new Error(`Output references unknown step: ${output.stepName}`);
      }
      return stepObservable.pipe(
        map(value => ({ [output.name]: value }))
      );
    });

    if (outputObservables.length === 0) {
      return of({});
    }

    // Combine all outputs
    let result = combineLatest(outputObservables).pipe(
      map(outputs => Object.assign({}, ...outputs))
    );

    // Apply optional operators
    if (options.timeout) {
      result = result.pipe(timeout(options.timeout));
    }
    
    if (options.retries) {
      result = result.pipe(retry(options.retries));
    }
    
    result = result.pipe(
      catchError(error => {
        if (options.debug) {
          console.error('Pipeline execution error:', error);
        }
        return throwError(error);
      })
    );

    return result;
  }

  /**
   * Get observable for a specific step
   */
  getStep(stepName: string): Observable<any> | undefined {
    return this.stepObservables.get(stepName);
  }

  /**
   * Get all step names
   */
  getStepNames(): string[] {
    return Array.from(this.stepObservables.keys());
  }
}