/**
 * Simple recursive descent parser for agent-dsl
 * 
 * Parses tokenized DSL source into IR (Intermediate Representation)
 */

import { Token, TokenType, Lexer, LexerError } from './lexer';
import { IRPipeline, IRStep, IRInput, IROutput, IRExpression, IRError, IRProgram, SourceLocation } from '../ir/types';
import { IRBuilder } from '../ir/builder';

export interface ParseResult {
  program: IRProgram;
  success: boolean;
}

export class Parser {
  private tokens: Token[] = [];
  private current: number = 0;
  private errors: IRError[] = [];

  parse(input: string): ParseResult {
    const lexer = new Lexer(input);
    const { tokens, errors: lexErrors } = lexer.tokenize();
    
    this.tokens = tokens;
    this.current = 0;
    this.errors = [];
    
    // Convert lexer errors to IR errors
    lexErrors.forEach(lexError => {
      this.errors.push({
        message: lexError.message,
        location: {
          line: lexError.line,
          column: lexError.column
        },
        code: 'LEXER_ERROR',
        severity: 'error'
      });
    });

    const pipelines: IRPipeline[] = [];
    
    try {
      // Parse pipeline(s) - for now, assume single pipeline per file
      const pipeline = this.parsePipeline();
      if (pipeline) {
        pipelines.push(pipeline);
      }
    } catch (error) {
      this.addError(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      program: {
        pipelines,
        errors: this.errors,
        warnings: []
      },
      success: this.errors.length === 0
    };
  }

  private parsePipeline(): IRPipeline | null {
    const inputs: IRInput[] = [];
    const steps: IRStep[] = [];
    const outputs: IROutput[] = [];

    while (!this.isAtEnd()) {
      if (this.check(TokenType.IDENTIFIER)) {
        const identifier = this.peek().value;
        
        // Check if this is an input declaration (identifier: type)
        if (this.checkNext(TokenType.COLON) && this.checkNextNext(TokenType.TYPE)) {
          const input = this.parseInput();
          if (input) inputs.push(input);
        }
        // Check if this is a step assignment (identifier = expression)
        else if (this.checkNext(TokenType.ASSIGN)) {
          const step = this.parseStep();
          if (step) steps.push(step);
        }
        // Check if this is an output declaration (output: stepName)
        else if (identifier === 'output' && this.checkNext(TokenType.COLON)) {
          const output = this.parseOutput();
          if (output) outputs.push(output);
        }
        else {
          this.addError(`Unexpected identifier: ${identifier}`);
          this.advance(); // Skip problematic token
        }
      } else {
        this.advance(); // Skip unexpected tokens
      }
    }

    if (inputs.length === 0 && steps.length === 0 && outputs.length === 0) {
      return null;
    }

    return IRBuilder.pipeline(inputs, steps, outputs);
  }

  private parseInput(): IRInput | null {
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected input name');
    if (!nameToken) return null;

    this.consume(TokenType.COLON, 'Expected \':\' after input name');
    
    const typeToken = this.consume(TokenType.TYPE, 'Expected type annotation');
    if (!typeToken) return null;

    return {
      name: nameToken.value,
      type: typeToken.value as any,
      location: this.tokenToLocation(nameToken)
    };
  }

  private parseStep(): IRStep | null {
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected step name');
    if (!nameToken) return null;

    this.consume(TokenType.ASSIGN, 'Expected \'=\' after step name');
    
    const expression = this.parseExpression();
    if (!expression) return null;

    // For now, dependencies are inferred from variable references
    const dependencies = this.extractDependencies(expression);

    return IRBuilder.step(
      nameToken.value,
      expression,
      dependencies,
      this.tokenToLocation(nameToken)
    );
  }

  private parseOutput(): IROutput | null {
    this.consume(TokenType.IDENTIFIER, 'Expected \'output\''); // consume 'output'
    this.consume(TokenType.COLON, 'Expected \':\' after output');
    
    const stepToken = this.consume(TokenType.IDENTIFIER, 'Expected step name for output');
    if (!stepToken) return null;

    return {
      name: 'result', // Default output name
      stepName: stepToken.value,
      type: 'any', // Type will be inferred during validation
      location: this.tokenToLocation(stepToken)
    };
  }

  private parseExpression(): IRExpression | null {
    return this.parseCallExpression();
  }

  private parseCallExpression(): IRExpression | null {
    if (this.check(TokenType.IDENTIFIER)) {
      const nameToken = this.advance();
      
      // Check if this is a function call
      if (this.check(TokenType.LPAREN)) {
        return this.parseFunctionCall(nameToken);
      } else {
        // Variable reference
        return IRBuilder.variable(nameToken.value, 'any', this.tokenToLocation(nameToken));
      }
    }
    
    return this.parsePrimary();
  }

  private parseFunctionCall(nameToken: Token): IRExpression | null {
    this.consume(TokenType.LPAREN, 'Expected \'(\' after function name');
    
    const args: IRExpression[] = [];
    
    if (!this.check(TokenType.RPAREN)) {
      do {
        const arg = this.parseExpression();
        if (arg) args.push(arg);
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RPAREN, 'Expected \')\' after arguments');
    
    const functionName = nameToken.value;
    
    // Map function calls to operations or tools
    switch (functionName) {
      case 'map':
      case 'flatMap':
      case 'filter':
      case 'zip':
      case 'onError':
        return IRBuilder.operation(functionName as any, args, 'any', this.tokenToLocation(nameToken));
      
      case 'callApi':
        if (args.length >= 1) {
          const urlArg = args[0];
          const url = urlArg.type === 'literal' ? urlArg.value : '';
          return IRBuilder.callApi(url, {});
        }
        break;
        
      case 'runShell':
        if (args.length >= 1) {
          const cmdArg = args[0];
          const command = cmdArg.type === 'literal' ? cmdArg.value : '';
          return IRBuilder.runShell(command, {});
        }
        break;
        
      case 'useMCP':
        if (args.length >= 1) {
          const serviceArg = args[0];
          const service = serviceArg.type === 'literal' ? serviceArg.value : '';
          return IRBuilder.useMCP(service, {});
        }
        break;
    }
    
    this.addError(`Unknown function: ${functionName}`);
    return null;
  }

  private parsePrimary(): IRExpression | null {
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      return IRBuilder.literal(token.value, 'string', this.tokenToLocation(token));
    }
    
    if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      const value = parseFloat(token.value);
      return IRBuilder.literal(value, 'number', this.tokenToLocation(token));
    }
    
    if (this.match(TokenType.BOOLEAN)) {
      const token = this.previous();
      const value = token.value === 'true';
      return IRBuilder.literal(value, 'boolean', this.tokenToLocation(token));
    }
    
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, 'Expected \')\' after expression');
      return expr;
    }
    
    this.addError('Expected expression');
    return null;
  }

  private extractDependencies(expr: IRExpression): string[] {
    const deps: string[] = [];
    
    const traverse = (node: IRExpression) => {
      if (node.type === 'variable') {
        deps.push(node.name);
      } else if (node.type === 'operation') {
        node.inputs.forEach(traverse);
      }
    };
    
    traverse(expr);
    return [...new Set(deps)]; // Remove duplicates
  }

  // Utility methods
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private checkNext(type: TokenType): boolean {
    if (this.current + 1 >= this.tokens.length) return false;
    return this.tokens[this.current + 1].type === type;
  }

  private checkNextNext(type: TokenType): boolean {
    if (this.current + 2 >= this.tokens.length) return false;
    return this.tokens[this.current + 2].type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token | null {
    if (this.check(type)) return this.advance();
    
    this.addError(message);
    return null;
  }

  private addError(message: string, location?: SourceLocation): void {
    const currentToken = this.peek();
    this.errors.push({
      message,
      location: location || this.tokenToLocation(currentToken),
      code: 'PARSE_ERROR',
      severity: 'error'
    });
  }

  private tokenToLocation(token: Token): SourceLocation {
    return {
      line: token.line,
      column: token.column
    };
  }
}