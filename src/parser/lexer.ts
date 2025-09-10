/**
 * Simple lexer for agent-dsl
 * 
 * Tokenizes DSL source code into a stream of tokens
 */

export enum TokenType {
  // Literals
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  
  // Identifiers and keywords
  IDENTIFIER = 'IDENTIFIER',
  TYPE = 'TYPE',
  
  // Operators
  ASSIGN = 'ASSIGN',          // =
  ARROW = 'ARROW',            // =>
  PIPE = 'PIPE',              // |
  
  // Delimiters
  LPAREN = 'LPAREN',          // (
  RPAREN = 'RPAREN',          // )
  LBRACE = 'LBRACE',          // {
  RBRACE = 'RBRACE',          // }
  LBRACKET = 'LBRACKET',      // [
  RBRACKET = 'RBRACKET',      // ]
  
  // Punctuation
  COMMA = 'COMMA',            // ,
  COLON = 'COLON',            // :
  SEMICOLON = 'SEMICOLON',    // ;
  DOT = 'DOT',                // .
  
  // Special
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
  WHITESPACE = 'WHITESPACE',
  COMMENT = 'COMMENT'
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

export interface LexerError {
  message: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

export class Lexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  private errors: LexerError[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): { tokens: Token[], errors: LexerError[] } {
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
    this.errors = [];

    while (this.position < this.input.length) {
      this.scanToken();
    }

    this.addToken(TokenType.EOF, '');
    
    return {
      tokens: this.tokens.filter(t => t.type !== TokenType.WHITESPACE && t.type !== TokenType.COMMENT),
      errors: this.errors
    };
  }

  private scanToken(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    const c = this.advance();

    switch (c) {
      case ' ':
      case '\r':
      case '\t':
        this.addToken(TokenType.WHITESPACE, c, start, startLine, startColumn);
        break;
        
      case '\n':
        this.addToken(TokenType.NEWLINE, c, start, startLine, startColumn);
        this.line++;
        this.column = 1;
        break;
        
      case '(':
        this.addToken(TokenType.LPAREN, c, start, startLine, startColumn);
        break;
      case ')':
        this.addToken(TokenType.RPAREN, c, start, startLine, startColumn);
        break;
      case '{':
        this.addToken(TokenType.LBRACE, c, start, startLine, startColumn);
        break;
      case '}':
        this.addToken(TokenType.RBRACE, c, start, startLine, startColumn);
        break;
      case '[':
        this.addToken(TokenType.LBRACKET, c, start, startLine, startColumn);
        break;
      case ']':
        this.addToken(TokenType.RBRACKET, c, start, startLine, startColumn);
        break;
      case ',':
        this.addToken(TokenType.COMMA, c, start, startLine, startColumn);
        break;
      case ':':
        this.addToken(TokenType.COLON, c, start, startLine, startColumn);
        break;
      case ';':
        this.addToken(TokenType.SEMICOLON, c, start, startLine, startColumn);
        break;
      case '.':
        this.addToken(TokenType.DOT, c, start, startLine, startColumn);
        break;
      case '|':
        this.addToken(TokenType.PIPE, c, start, startLine, startColumn);
        break;
        
      case '=':
        if (this.match('>')) {
          this.addToken(TokenType.ARROW, '=>', start, startLine, startColumn);
        } else {
          this.addToken(TokenType.ASSIGN, c, start, startLine, startColumn);
        }
        break;
        
      case '/':
        if (this.match('/')) {
          // Line comment
          while (this.peek() !== '\n' && !this.isAtEnd()) {
            this.advance();
          }
          const comment = this.input.substring(start, this.position);
          this.addToken(TokenType.COMMENT, comment, start, startLine, startColumn);
        } else {
          this.addError(`Unexpected character: ${c}`, startLine, startColumn, start, this.position);
        }
        break;
        
      case '"':
      case "'":
        this.scanString(c, start, startLine, startColumn);
        break;
        
      default:
        if (this.isDigit(c)) {
          this.scanNumber(start, startLine, startColumn);
        } else if (this.isAlpha(c)) {
          this.scanIdentifier(start, startLine, startColumn);
        } else {
          this.addError(`Unexpected character: ${c}`, startLine, startColumn, start, this.position);
        }
        break;
    }
  }

  private scanString(quote: string, start: number, startLine: number, startColumn: number): void {
    while (this.peek() !== quote && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      this.addError('Unterminated string', startLine, startColumn, start, this.position);
      return;
    }

    // Consume closing quote
    this.advance();
    
    const value = this.input.substring(start + 1, this.position - 1);
    this.addToken(TokenType.STRING, value, start, startLine, startColumn);
  }

  private scanNumber(start: number, startLine: number, startColumn: number): void {
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Look for decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume '.'
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const value = this.input.substring(start, this.position);
    this.addToken(TokenType.NUMBER, value, start, startLine, startColumn);
  }

  private scanIdentifier(start: number, startLine: number, startColumn: number): void {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const value = this.input.substring(start, this.position);
    
    // Check for keywords/types
    const tokenType = this.getIdentifierType(value);
    this.addToken(tokenType, value, start, startLine, startColumn);
  }

  private getIdentifierType(text: string): TokenType {
    // Boolean literals
    if (text === 'true' || text === 'false') {
      return TokenType.BOOLEAN;
    }
    
    // Type keywords
    if (['string', 'number', 'boolean', 'object', 'array', 'any'].includes(text)) {
      return TokenType.TYPE;
    }
    
    return TokenType.IDENTIFIER;
  }

  private addToken(type: TokenType, value: string, start?: number, line?: number, column?: number): void {
    this.tokens.push({
      type,
      value,
      line: line || this.line,
      column: column || this.column,
      start: start || this.position - value.length,
      end: this.position
    });
  }

  private addError(message: string, line: number, column: number, start: number, end: number): void {
    this.errors.push({
      message,
      line,
      column,
      start,
      end
    });
  }

  private advance(): string {
    const c = this.input.charAt(this.position++);
    this.column++;
    return c;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.input.charAt(this.position) !== expected) return false;
    this.position++;
    this.column++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.input.charAt(this.position);
  }

  private peekNext(): string {
    if (this.position + 1 >= this.input.length) return '\0';
    return this.input.charAt(this.position + 1);
  }

  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }
}