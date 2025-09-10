/**
 * Zod validation schemas for agent-dsl
 * 
 * These schemas validate DSL syntax and structure at parse time
 */

import { z } from 'zod';

// Base schemas
export const IRTypeSchema = z.enum(['string', 'number', 'boolean', 'object', 'array', 'any']);

export const SourceLocationSchema = z.object({
  line: z.number().int().min(1),
  column: z.number().int().min(1),
  file: z.string().optional()
});

export const IRNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  location: SourceLocationSchema.optional()
});

// Expression schemas
export const IRLiteralSchema = IRNodeSchema.extend({
  type: z.literal('literal'),
  valueType: IRTypeSchema,
  value: z.any()
});

export const IRVariableSchema = IRNodeSchema.extend({
  type: z.literal('variable'),
  name: z.string().min(1),
  valueType: IRTypeSchema
});

export const IRParameterSchema = z.object({
  name: z.string().min(1),
  type: IRTypeSchema,
  optional: z.boolean().optional()
});

export const OperatorTypeSchema = z.enum([
  // Core reactive operators
  'map', 'flatMap', 'filter', 'zip', 'merge', 'concat', 
  'switchMap', 'debounce', 'throttle',
  // Error handling
  'onError', 'retry', 'timeout',
  // Tool operations
  'tool', 'runShell', 'callApi', 'useMCP', 'readFile', 'writeFile'
]);

// Forward declare for recursive types
export const IRExpressionSchema: z.ZodType<any> = z.lazy(() => z.union([
  IRLiteralSchema,
  IRVariableSchema,
  IRFunctionSchema,
  IROperationSchema,
  IRToolSchema,
  IRConditionalSchema,
  IRLoopSchema
]));

export const IRFunctionSchema = IRNodeSchema.extend({
  type: z.literal('function'),
  name: z.string().min(1),
  params: z.array(IRParameterSchema),
  body: IRExpressionSchema,
  returnType: IRTypeSchema
});

export const IROperationSchema = IRNodeSchema.extend({
  type: z.literal('operation'),
  operator: OperatorTypeSchema,
  inputs: z.array(IRExpressionSchema),
  outputType: IRTypeSchema
});

export const IRToolSchema = IRNodeSchema.extend({
  type: z.literal('tool'),
  toolName: z.string().min(1),
  config: z.record(z.any()),
  inputType: IRTypeSchema,
  outputType: IRTypeSchema
});

export const IRConditionalSchema = IRNodeSchema.extend({
  type: z.literal('conditional'),
  condition: IRExpressionSchema,
  thenBranch: IRExpressionSchema,
  elseBranch: IRExpressionSchema.optional(),
  outputType: IRTypeSchema
});

export const IRLoopSchema = IRNodeSchema.extend({
  type: z.literal('loop'),
  iterable: IRExpressionSchema,
  variable: z.string().min(1),
  body: IRExpressionSchema,
  outputType: IRTypeSchema
});

// Pipeline schemas
export const IRStepSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid step name'),
  expression: IRExpressionSchema,
  dependencies: z.array(z.string()),
  location: SourceLocationSchema.optional()
});

export const IRInputSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid input name'),
  type: IRTypeSchema,
  optional: z.boolean().optional(),
  defaultValue: z.any().optional(),
  location: SourceLocationSchema.optional()
});

export const IROutputSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid output name'),
  stepName: z.string().min(1),
  type: IRTypeSchema,
  location: SourceLocationSchema.optional()
});

export const IRPipelineMetadataSchema = z.object({
  version: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export const IRPipelineSchema = z.object({
  name: z.string().optional(),
  inputs: z.array(IRInputSchema),
  steps: z.array(IRStepSchema),
  outputs: z.array(IROutputSchema),
  metadata: IRPipelineMetadataSchema.optional()
});

export const IRErrorSchema = z.object({
  message: z.string(),
  location: SourceLocationSchema.optional(),
  code: z.string(),
  severity: z.literal('error')
});

export const IRWarningSchema = z.object({
  message: z.string(),
  location: SourceLocationSchema.optional(),
  code: z.string(),
  severity: z.literal('warning')
});

export const IRProgramSchema = z.object({
  pipelines: z.array(IRPipelineSchema),
  errors: z.array(IRErrorSchema),
  warnings: z.array(IRWarningSchema)
});

// DSL syntax validation schemas
export const DSLIdentifierSchema = z.string().regex(
  /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  'Identifier must start with letter or underscore, followed by letters, numbers, or underscores'
);

export const DSLTypeAnnotationSchema = z.string().regex(
  /^(string|number|boolean|object|array|any)(\[\])?$/,
  'Type must be one of: string, number, boolean, object, array, any (with optional [] for arrays)'
);

// Tool configuration schemas
export const CallApiConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('POST'),
  headers: z.record(z.string()).optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().int().min(0).optional()
});

export const RunShellConfigSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeout: z.number().positive().optional(),
  shell: z.string().optional()
});

export const UseMCPConfigSchema = z.object({
  service: z.string().min(1),
  method: z.string().min(1),
  params: z.record(z.any()).optional(),
  timeout: z.number().positive().optional()
});

export const ReadFileConfigSchema = z.object({
  path: z.string().min(1),
  encoding: z.string().default('utf8'),
  maxSize: z.number().positive().optional()
});

export const WriteFileConfigSchema = z.object({
  path: z.string().min(1),
  encoding: z.string().default('utf8'),
  mode: z.number().optional(),
  createDirs: z.boolean().default(false)
});

// Validation utilities
export function validatePipeline(data: unknown) {
  return IRPipelineSchema.safeParse(data);
}

export function validateProgram(data: unknown) {
  return IRProgramSchema.safeParse(data);
}

export function validateToolConfig(toolName: string, config: unknown) {
  switch (toolName) {
    case 'callApi':
      return CallApiConfigSchema.safeParse(config);
    case 'runShell':
      return RunShellConfigSchema.safeParse(config);
    case 'useMCP':
      return UseMCPConfigSchema.safeParse(config);
    case 'readFile':
      return ReadFileConfigSchema.safeParse(config);
    case 'writeFile':
      return WriteFileConfigSchema.safeParse(config);
    default:
      return { success: true, data: config };
  }
}