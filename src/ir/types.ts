/**
 * Intermediate Representation (IR) types for agent-dsl
 * 
 * These types represent the compiled form of DSL programs after parsing
 * and before lowering to the reactive runtime.
 */

// Base types
export type IRType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';

export interface SourceLocation {
  line: number;
  column: number;
  file?: string;
}

export interface IRNode {
  id: string;
  type: string;
  location?: SourceLocation;
}

// Value expressions
export interface IRLiteral extends IRNode {
  type: 'literal';
  valueType: IRType;
  value: any;
}

export interface IRVariable extends IRNode {
  type: 'variable';
  name: string;
  valueType: IRType;
}

export interface IRFunction extends IRNode {
  type: 'function';
  name: string;
  params: IRParameter[];
  body: IRExpression;
  returnType: IRType;
}

export interface IRParameter {
  name: string;
  type: IRType;
  optional?: boolean;
}

// Operations
export interface IROperation extends IRNode {
  type: 'operation';
  operator: OperatorType;
  inputs: IRExpression[];
  outputType: IRType;
}

export type OperatorType = 
  // Core reactive operators
  | 'map'
  | 'flatMap' 
  | 'filter'
  | 'zip'
  | 'merge'
  | 'concat'
  | 'switchMap'
  | 'debounce'
  | 'throttle'
  
  // Error handling
  | 'onError'
  | 'retry'
  | 'timeout'
  
  // Tool operations (all lower to canonical 'tool' op)
  | 'tool'
  | 'runShell'
  | 'callApi'
  | 'useMCP'
  | 'readFile'
  | 'writeFile';

// Tool operation (canonical form)
export interface IRTool extends IRNode {
  type: 'tool';
  toolName: string;
  config: Record<string, any>;
  inputType: IRType;
  outputType: IRType;
}

// Control flow
export interface IRConditional extends IRNode {
  type: 'conditional';
  condition: IRExpression;
  thenBranch: IRExpression;
  elseBranch?: IRExpression;
  outputType: IRType;
}

export interface IRLoop extends IRNode {
  type: 'loop';
  iterable: IRExpression;
  variable: string;
  body: IRExpression;
  outputType: IRType;
}

// Expressions (union of all expression types)
export type IRExpression = 
  | IRLiteral
  | IRVariable
  | IRFunction
  | IROperation
  | IRTool
  | IRConditional
  | IRLoop;

// Pipeline definition
export interface IRStep {
  name: string;
  expression: IRExpression;
  dependencies: string[]; // Names of other steps this depends on
  location?: SourceLocation;
}

export interface IRInput {
  name: string;
  type: IRType;
  optional?: boolean;
  defaultValue?: any;
  location?: SourceLocation;
}

export interface IROutput {
  name: string;
  stepName: string; // Which step produces this output
  type: IRType;
  location?: SourceLocation;
}

export interface IRPipeline {
  name?: string;
  inputs: IRInput[];
  steps: IRStep[];
  outputs: IROutput[];
  metadata?: {
    version?: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
}

// Compilation result
export interface IRProgram {
  pipelines: IRPipeline[];
  errors: IRError[];
  warnings: IRWarning[];
}

export interface IRError {
  message: string;
  location?: SourceLocation;
  code: string;
  severity: 'error';
}

export interface IRWarning {
  message: string;
  location?: SourceLocation;
  code: string;
  severity: 'warning';
}

// Type utilities
export interface TypeContext {
  variables: Map<string, IRType>;
  functions: Map<string, IRFunction>;
  steps: Map<string, IRType>;
}

export interface ValidationResult {
  valid: boolean;
  errors: IRError[];
  warnings: IRWarning[];
}