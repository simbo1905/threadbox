"""
Python RxPY runtime for agent-dsl

Executes compiled agent-dsl pipelines using RxPY observables
"""

from typing import Any, Dict, List, Optional, Callable
import json
from rx import Observable, empty, throw, combine_latest, merge, concat
from rx.operators import map, flat_map, filter, catch, retry, timeout, debounce, throttle_first
from rx.subject import Subject

from .types import (
    IRPipeline, IRStep, IRExpression, IROperation, IRTool, 
    IRLiteral, IRVariable, IRError, OperatorType
)
from .tools import default_tools, ToolRegistry


class RuntimeContext:
    """Runtime execution context"""
    
    def __init__(self, tools: Optional[ToolRegistry] = None):
        self.variables: Dict[str, Observable] = {}
        self.steps: Dict[str, Observable] = {}
        self.tools = tools or default_tools


class ExecutionOptions:
    """Pipeline execution options"""
    
    def __init__(self, timeout_ms: Optional[int] = None, retries: int = 0, debug: bool = False):
        self.timeout_ms = timeout_ms
        self.retries = retries
        self.debug = debug


class RxPyRuntime:
    """RxPY-based runtime for agent-dsl"""
    
    def __init__(self, tools: Optional[ToolRegistry] = None):
        self.tools = tools or default_tools
    
    def compile(self, pipeline: IRPipeline) -> 'CompiledPipeline':
        """Compile a pipeline to RxPY observables"""
        context = RuntimeContext(self.tools)
        
        # Create observables for each step
        step_observables: Dict[str, Observable] = {}
        
        # Topologically sort steps based on dependencies
        sorted_steps = self._topological_sort(pipeline.steps)
        
        for step in sorted_steps:
            observable = self._compile_expression(step.expression, context)
            step_observables[step.name] = observable
            context.steps[step.name] = observable
        
        return CompiledPipeline(pipeline, step_observables, context)
    
    def register_tool(self, name: str, tool_fn: Callable) -> None:
        """Register a custom tool function"""
        self.tools.register(name, tool_fn)
    
    def _compile_expression(self, expr: IRExpression, context: RuntimeContext) -> Observable:
        """Compile an IR expression to an observable"""
        
        if expr.type == "literal":
            literal = expr  # Type: IRLiteral
            return Observable.just(literal.value)
        
        elif expr.type == "variable":
            variable = expr  # Type: IRVariable
            observable = context.variables.get(variable.name) or context.steps.get(variable.name)
            if not observable:
                return throw(Exception(f"Unknown variable: {variable.name}"))
            return observable
        
        elif expr.type == "operation":
            return self._compile_operation(expr, context)
        
        elif expr.type == "tool":
            return self._compile_tool(expr, context)
        
        else:
            return throw(Exception(f"Unknown expression type: {expr.type}"))
    
    def _compile_operation(self, op: IROperation, context: RuntimeContext) -> Observable:
        """Compile an operation to an observable"""
        inputs = [self._compile_expression(input_expr, context) for input_expr in op.inputs]
        
        if op.operator == OperatorType.MAP:
            if len(inputs) != 2:
                return throw(Exception("map requires exactly 2 inputs"))
            return inputs[0].pipe(
                flat_map(lambda value: self._apply_function(inputs[1], value))
            )
        
        elif op.operator == OperatorType.FLAT_MAP:
            if len(inputs) != 2:
                return throw(Exception("flatMap requires exactly 2 inputs"))
            return inputs[0].pipe(
                flat_map(lambda value: self._apply_function(inputs[1], value))
            )
        
        elif op.operator == OperatorType.FILTER:
            if len(inputs) != 2:
                return throw(Exception("filter requires exactly 2 inputs"))
            return inputs[0].pipe(
                flat_map(lambda value: 
                    self._apply_function(inputs[1], value).pipe(
                        flat_map(lambda result: Observable.just(value) if result else empty())
                    )
                )
            )
        
        elif op.operator == OperatorType.ZIP:
            if len(inputs) != 2:
                return throw(Exception("zip requires exactly 2 inputs"))
            return combine_latest(inputs[0], inputs[1])
        
        elif op.operator == OperatorType.MERGE:
            return merge(*inputs)
        
        elif op.operator == OperatorType.CONCAT:
            return concat(*inputs)
        
        elif op.operator == OperatorType.ON_ERROR:
            if len(inputs) != 2:
                return throw(Exception("onError requires exactly 2 inputs"))
            return inputs[0].pipe(
                catch(lambda error: self._apply_function(inputs[1], error))
            )
        
        elif op.operator == OperatorType.RETRY:
            retry_count = 3
            if len(inputs) > 1:
                # Get retry count from second input
                pass  # Simplified for now
            return inputs[0].pipe(retry(retry_count))
        
        elif op.operator == OperatorType.TIMEOUT:
            timeout_ms = 5000
            if len(inputs) > 1:
                # Get timeout from second input
                pass  # Simplified for now
            return inputs[0].pipe(timeout(timeout_ms / 1000.0))
        
        else:
            return throw(Exception(f"Unknown operator: {op.operator}"))
    
    def _compile_tool(self, tool: IRTool, context: RuntimeContext) -> Observable:
        """Compile a tool call to an observable"""
        tool_fn = context.tools.get(tool.tool_name)
        if not tool_fn:
            return throw(Exception(f"Unknown tool: {tool.tool_name}"))
        
        # For now, tools operate on static input
        return tool_fn(None, tool.config)
    
    def _apply_function(self, fn_expr: Observable, input_value: Any) -> Observable:
        """Apply a function expression to an input value"""
        # Simplified implementation - in full version would compile and execute function
        return fn_expr.pipe(map(lambda _: input_value))
    
    def _topological_sort(self, steps: List[IRStep]) -> List[IRStep]:
        """Topologically sort steps based on dependencies"""
        visited = set()
        visiting = set()
        result = []
        step_map = {step.name: step for step in steps}
        
        def visit(step_name: str):
            if step_name in visited:
                return
            if step_name in visiting:
                raise Exception(f"Circular dependency detected: {step_name}")
            
            visiting.add(step_name)
            step = step_map.get(step_name)
            if step:
                for dep in step.dependencies:
                    visit(dep)
                result.append(step)
                visited.add(step_name)
            visiting.remove(step_name)
        
        for step in steps:
            visit(step.name)
        
        return result


class CompiledPipeline:
    """A compiled pipeline ready for execution"""
    
    def __init__(self, pipeline: IRPipeline, step_observables: Dict[str, Observable], context: RuntimeContext):
        self.pipeline = pipeline
        self.step_observables = step_observables
        self.context = context
    
    def run(self, inputs: Dict[str, Any], options: Optional[ExecutionOptions] = None) -> Observable:
        """Execute the pipeline with given inputs"""
        options = options or ExecutionOptions()
        
        # Set up input observables
        for input_def in self.pipeline.inputs:
            value = inputs.get(input_def.name, input_def.default_value)
            if value is None and not input_def.optional:
                raise Exception(f"Required input missing: {input_def.name}")
            self.context.variables[input_def.name] = Observable.just(value)
        
        # Collect outputs
        output_observables = []
        for output_def in self.pipeline.outputs:
            step_observable = self.step_observables.get(output_def.step_name)
            if not step_observable:
                raise Exception(f"Output references unknown step: {output_def.step_name}")
            
            output_obs = step_observable.pipe(
                map(lambda value, name=output_def.name: {name: value})
            )
            output_observables.append(output_obs)
        
        if not output_observables:
            return Observable.just({})
        
        # Combine all outputs
        result = combine_latest(*output_observables).pipe(
            map(lambda outputs: {k: v for output in outputs for k, v in output.items()})
        )
        
        # Apply execution options
        if options.timeout_ms:
            result = result.pipe(timeout(options.timeout_ms / 1000.0))
        
        if options.retries > 0:
            result = result.pipe(retry(options.retries))
        
        if options.debug:
            result = result.pipe(
                map(lambda value: self._debug_log("Pipeline result:", value) or value),
                catch(lambda error: self._debug_log("Pipeline error:", error) or throw(error))
            )
        
        return result
    
    def get_step(self, step_name: str) -> Optional[Observable]:
        """Get observable for a specific step"""
        return self.step_observables.get(step_name)
    
    def get_step_names(self) -> List[str]:
        """Get all step names"""
        return list(self.step_observables.keys())
    
    def _debug_log(self, message: str, value: Any) -> None:
        """Debug logging helper"""
        print(f"[DEBUG] {message} {json.dumps(value, default=str, indent=2)}")


# Convenience function for quick pipeline execution
def run_pipeline_json(pipeline_json: str, inputs: Dict[str, Any], options: Optional[ExecutionOptions] = None) -> Observable:
    """Run a pipeline from JSON representation"""
    try:
        pipeline_data = json.loads(pipeline_json)
        pipeline = IRPipeline.model_validate(pipeline_data)
        
        runtime = RxPyRuntime()
        compiled = runtime.compile(pipeline)
        return compiled.run(inputs, options)
    
    except Exception as e:
        return throw(Exception(f"Failed to run pipeline: {str(e)}"))