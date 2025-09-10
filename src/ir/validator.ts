/**
 * IR Validation utilities
 * 
 * Validates IR nodes for type consistency, dependency resolution, etc.
 */

import { 
  IRPipeline, 
  IRExpression, 
  IRError, 
  IRWarning, 
  ValidationResult,
  TypeContext,
  IRType,
  IRStep
} from './types';

export class IRValidator {
  
  static validatePipeline(pipeline: IRPipeline): ValidationResult {
    const errors: IRError[] = [];
    const warnings: IRWarning[] = [];
    
    // Build type context from inputs
    const context: TypeContext = {
      variables: new Map(),
      functions: new Map(),
      steps: new Map()
    };
    
    // Add inputs to context
    pipeline.inputs.forEach(input => {
      context.variables.set(input.name, input.type);
    });
    
    // Validate steps in dependency order
    const validated = new Set<string>();
    const visiting = new Set<string>();
    
    const validateStep = (step: IRStep): void => {
      if (validated.has(step.name)) return;
      if (visiting.has(step.name)) {
        errors.push({
          message: `Circular dependency detected involving step: ${step.name}`,
          location: step.location,
          code: 'CIRCULAR_DEPENDENCY',
          severity: 'error'
        });
        return;
      }
      
      visiting.add(step.name);
      
      // Validate dependencies first
      step.dependencies.forEach(dep => {
        const depStep = pipeline.steps.find(s => s.name === dep);
        if (!depStep) {
          errors.push({
            message: `Unknown dependency: ${dep}`,
            location: step.location,
            code: 'UNKNOWN_DEPENDENCY',
            severity: 'error'
          });
        } else {
          validateStep(depStep);
        }
      });
      
      // Validate the step expression
      const expressionResult = this.validateExpression(step.expression, context);
      errors.push(...expressionResult.errors);
      warnings.push(...expressionResult.warnings);
      
      // Add step output to context
      const outputType = this.inferExpressionType(step.expression, context);
      context.steps.set(step.name, outputType);
      
      visiting.delete(step.name);
      validated.add(step.name);
    };
    
    pipeline.steps.forEach(validateStep);
    
    // Validate outputs
    pipeline.outputs.forEach(output => {
      if (!context.steps.has(output.stepName)) {
        errors.push({
          message: `Output references unknown step: ${output.stepName}`,
          location: output.location,
          code: 'UNKNOWN_STEP',
          severity: 'error'
        });
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  static validateExpression(expr: IRExpression, context: TypeContext): ValidationResult {
    const errors: IRError[] = [];
    const warnings: IRWarning[] = [];
    
    switch (expr.type) {
      case 'literal':
        // Literals are always valid
        break;
        
      case 'variable':
        if (!context.variables.has(expr.name) && !context.steps.has(expr.name)) {
          errors.push({
            message: `Unknown variable: ${expr.name}`,
            location: expr.location,
            code: 'UNKNOWN_VARIABLE',
            severity: 'error'
          });
        }
        break;
        
      case 'operation':
        // Validate operation inputs
        expr.inputs.forEach(input => {
          const inputResult = this.validateExpression(input, context);
          errors.push(...inputResult.errors);
          warnings.push(...inputResult.warnings);
        });
        
        // Validate operation-specific logic
        this.validateOperation(expr, context, errors, warnings);
        break;
        
      case 'tool':
        // Validate tool configuration
        if (!expr.toolName) {
          errors.push({
            message: 'Tool name is required',
            location: expr.location,
            code: 'MISSING_TOOL_NAME',
            severity: 'error'
          });
        }
        break;
        
      default:
        warnings.push({
          message: `Unknown expression type: ${expr.type}`,
          location: expr.location,
          code: 'UNKNOWN_EXPRESSION_TYPE',
          severity: 'warning'
        });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  private static validateOperation(
    expr: IRExpression & { type: 'operation' },
    context: TypeContext,
    errors: IRError[],
    warnings: IRWarning[]
  ): void {
    const { operator, inputs } = expr;
    
    switch (operator) {
      case 'map':
      case 'flatMap':
        if (inputs.length !== 2) {
          errors.push({
            message: `${operator} requires exactly 2 inputs, got ${inputs.length}`,
            location: expr.location,
            code: 'INVALID_ARITY',
            severity: 'error'
          });
        }
        break;
        
      case 'filter':
        if (inputs.length !== 2) {
          errors.push({
            message: `filter requires exactly 2 inputs, got ${inputs.length}`,
            location: expr.location,
            code: 'INVALID_ARITY',
            severity: 'error'
          });
        }
        break;
        
      case 'zip':
        if (inputs.length !== 2) {
          errors.push({
            message: `zip requires exactly 2 inputs, got ${inputs.length}`,
            location: expr.location,
            code: 'INVALID_ARITY',
            severity: 'error'
          });
        }
        break;
    }
  }
  
  static inferExpressionType(expr: IRExpression, context: TypeContext): IRType {
    switch (expr.type) {
      case 'literal':
        return expr.valueType;
        
      case 'variable':
        return context.variables.get(expr.name) || 
               context.steps.get(expr.name) || 
               'any';
        
      case 'operation':
        return expr.outputType;
        
      case 'tool':
        return expr.outputType;
        
      default:
        return 'any';
    }
  }
}