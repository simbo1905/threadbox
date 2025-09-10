/**
 * IR Builder utilities for constructing IR nodes programmatically
 */

import { 
  IRExpression, 
  IRLiteral, 
  IRVariable, 
  IROperation, 
  IRTool, 
  IRStep, 
  IRPipeline,
  IRType,
  OperatorType,
  SourceLocation
} from './types';

let nodeIdCounter = 0;

function generateId(): string {
  return `node_${++nodeIdCounter}`;
}

export class IRBuilder {
  
  static literal(value: any, valueType: IRType, location?: SourceLocation): IRLiteral {
    return {
      id: generateId(),
      type: 'literal',
      valueType,
      value,
      location
    };
  }

  static variable(name: string, valueType: IRType, location?: SourceLocation): IRVariable {
    return {
      id: generateId(),
      type: 'variable',
      name,
      valueType,
      location
    };
  }

  static operation(
    operator: OperatorType,
    inputs: IRExpression[],
    outputType: IRType,
    location?: SourceLocation
  ): IROperation {
    return {
      id: generateId(),
      type: 'operation',
      operator,
      inputs,
      outputType,
      location
    };
  }

  static tool(
    toolName: string,
    config: Record<string, any>,
    inputType: IRType,
    outputType: IRType,
    location?: SourceLocation
  ): IRTool {
    return {
      id: generateId(),
      type: 'tool',
      toolName,
      config,
      inputType,
      outputType,
      location
    };
  }

  static step(
    name: string,
    expression: IRExpression,
    dependencies: string[] = [],
    location?: SourceLocation
  ): IRStep {
    return {
      name,
      expression,
      dependencies,
      location
    };
  }

  static pipeline(
    inputs: IRPipeline['inputs'],
    steps: IRStep[],
    outputs: IRPipeline['outputs'],
    name?: string
  ): IRPipeline {
    return {
      name,
      inputs,
      steps,
      outputs
    };
  }

  // Convenience methods for common operations
  static map(input: IRExpression, fn: IRExpression, outputType: IRType): IROperation {
    return this.operation('map', [input, fn], outputType);
  }

  static flatMap(input: IRExpression, fn: IRExpression, outputType: IRType): IROperation {
    return this.operation('flatMap', [input, fn], outputType);
  }

  static filter(input: IRExpression, predicate: IRExpression): IROperation {
    return this.operation('filter', [input, predicate], input.type === 'variable' ? (input as IRVariable).valueType : 'any');
  }

  static zip(left: IRExpression, right: IRExpression): IROperation {
    return this.operation('zip', [left, right], 'array');
  }

  static onError(input: IRExpression, handler: IRExpression, outputType: IRType): IROperation {
    return this.operation('onError', [input, handler], outputType);
  }

  // Tool operation builders
  static callApi(url: string, config: Record<string, any> = {}): IRTool {
    return this.tool('callApi', { url, ...config }, 'object', 'object');
  }

  static runShell(command: string, config: Record<string, any> = {}): IRTool {
    return this.tool('runShell', { command, ...config }, 'string', 'string');
  }

  static useMCP(service: string, config: Record<string, any> = {}): IRTool {
    return this.tool('useMCP', { service, ...config }, 'object', 'object');
  }
}