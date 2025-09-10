"""
Python types for agent-dsl IR

These mirror the TypeScript IR types for cross-language compatibility
"""

from typing import Any, Dict, List, Optional, Union, Literal
from pydantic import BaseModel, Field
from enum import Enum


class IRType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    OBJECT = "object"
    ARRAY = "array"
    ANY = "any"


class SourceLocation(BaseModel):
    line: int = Field(ge=1)
    column: int = Field(ge=1)
    file: Optional[str] = None


class IRNode(BaseModel):
    id: str
    type: str
    location: Optional[SourceLocation] = None


class IRLiteral(IRNode):
    type: Literal["literal"] = "literal"
    value_type: IRType
    value: Any


class IRVariable(IRNode):
    type: Literal["variable"] = "variable"
    name: str
    value_type: IRType


class IRParameter(BaseModel):
    name: str
    type: IRType
    optional: bool = False


class OperatorType(str, Enum):
    # Core reactive operators
    MAP = "map"
    FLAT_MAP = "flatMap"
    FILTER = "filter"
    ZIP = "zip"
    MERGE = "merge"
    CONCAT = "concat"
    SWITCH_MAP = "switchMap"
    DEBOUNCE = "debounce"
    THROTTLE = "throttle"
    
    # Error handling
    ON_ERROR = "onError"
    RETRY = "retry"
    TIMEOUT = "timeout"
    
    # Tool operations
    TOOL = "tool"
    RUN_SHELL = "runShell"
    CALL_API = "callApi"
    USE_MCP = "useMCP"
    READ_FILE = "readFile"
    WRITE_FILE = "writeFile"


class IROperation(IRNode):
    type: Literal["operation"] = "operation"
    operator: OperatorType
    inputs: List["IRExpression"]
    output_type: IRType


class IRTool(IRNode):
    type: Literal["tool"] = "tool"
    tool_name: str
    config: Dict[str, Any]
    input_type: IRType
    output_type: IRType


class IRConditional(IRNode):
    type: Literal["conditional"] = "conditional"
    condition: "IRExpression"
    then_branch: "IRExpression"
    else_branch: Optional["IRExpression"] = None
    output_type: IRType


class IRLoop(IRNode):
    type: Literal["loop"] = "loop"
    iterable: "IRExpression"
    variable: str
    body: "IRExpression"
    output_type: IRType


class IRFunction(IRNode):
    type: Literal["function"] = "function"
    name: str
    params: List[IRParameter]
    body: "IRExpression"
    return_type: IRType


# Union type for all expressions
IRExpression = Union[
    IRLiteral,
    IRVariable,
    IRFunction,
    IROperation,
    IRTool,
    IRConditional,
    IRLoop
]

# Update forward references
IROperation.model_rebuild()
IRConditional.model_rebuild()
IRLoop.model_rebuild()
IRFunction.model_rebuild()


class IRStep(BaseModel):
    name: str = Field(pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$")
    expression: IRExpression
    dependencies: List[str] = Field(default_factory=list)
    location: Optional[SourceLocation] = None


class IRInput(BaseModel):
    name: str = Field(pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$")
    type: IRType
    optional: bool = False
    default_value: Any = None
    location: Optional[SourceLocation] = None


class IROutput(BaseModel):
    name: str = Field(pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$")
    step_name: str
    type: IRType
    location: Optional[SourceLocation] = None


class IRPipelineMetadata(BaseModel):
    version: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class IRPipeline(BaseModel):
    name: Optional[str] = None
    inputs: List[IRInput]
    steps: List[IRStep]
    outputs: List[IROutput]
    metadata: Optional[IRPipelineMetadata] = None


class IRError(BaseModel):
    message: str
    location: Optional[SourceLocation] = None
    code: str
    severity: Literal["error"] = "error"


class IRWarning(BaseModel):
    message: str
    location: Optional[SourceLocation] = None
    code: str
    severity: Literal["warning"] = "warning"


class IRProgram(BaseModel):
    pipelines: List[IRPipeline]
    errors: List[IRError]
    warnings: List[IRWarning]


class ValidationResult(BaseModel):
    valid: bool
    errors: List[IRError]
    warnings: List[IRWarning]