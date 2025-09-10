/**
 * agent-dsl main entry point
 * 
 * Provides the primary API for parsing, compiling, and executing DSL programs
 */

export * from './ir';
export * from './parser';
export * from './runtime';
export * from './schemas';

import { Parser } from './parser';
import { RxJSBackend } from './runtime';
import { IRValidator } from './ir';
import { validateProgram } from './schemas';

/**
 * Main DSL compiler and runtime
 */
export class AgentDSL {
  private parser: Parser;
  private backend: RxJSBackend;

  constructor() {
    this.parser = new Parser();
    this.backend = new RxJSBackend();
  }

  /**
   * Parse DSL source code into IR
   */
  parse(source: string) {
    return this.parser.parse(source);
  }

  /**
   * Compile IR to executable pipeline
   */
  compile(program: any) {
    // Validate the program structure
    const validation = validateProgram(program);
    if (!validation.success) {
      throw new Error(`Invalid program: ${validation.error?.message}`);
    }

    if (program.pipelines.length === 0) {
      throw new Error('No pipelines found in program');
    }

    // For now, compile the first pipeline
    const pipeline = program.pipelines[0];
    
    // Validate pipeline semantics
    const validationResult = IRValidator.validatePipeline(pipeline);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.map(e => e.message).join(', ');
      throw new Error(`Pipeline validation failed: ${errorMessages}`);
    }

    return this.backend.compile(pipeline);
  }

  /**
   * Parse and compile DSL source in one step
   */
  compileSource(source: string) {
    const parseResult = this.parse(source);
    if (!parseResult.success) {
      const errorMessages = parseResult.program.errors.map(e => e.message).join(', ');
      throw new Error(`Parse failed: ${errorMessages}`);
    }
    
    return this.compile(parseResult.program);
  }

  /**
   * Register a custom tool
   */
  registerTool(name: string, toolFn: any) {
    this.backend.registerTool(name, toolFn);
  }
}

/**
 * Convenience function for quick DSL execution
 */
export function dsl(source: string) {
  const compiler = new AgentDSL();
  return compiler.compileSource(source);
}

/**
 * Template literal tag for DSL syntax
 */
export function dslTemplate(strings: TemplateStringsArray, ...values: any[]) {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += String(values[i]) + strings[i + 1];
  }
  return dsl(result);
}

// Export default instance
export default new AgentDSL();