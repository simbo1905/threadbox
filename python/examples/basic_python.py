"""
Basic Python example for agent-dsl

Demonstrates running agent-dsl pipelines from Python using RxPY
"""

import json
from agent_dsl import RxPyRuntime, ExecutionOptions
from agent_dsl.types import *


def create_sample_pipeline():
    """Create a sample pipeline programmatically"""
    
    # Define inputs
    inputs = [
        IRInput(name="text", type=IRType.STRING)
    ]
    
    # Define steps
    steps = [
        IRStep(
            name="step1",
            expression=IRTool(
                id="tool_1",
                type="tool",
                tool_name="callApi",
                config={"url": "/process", "method": "POST"},
                input_type=IRType.STRING,
                output_type=IRType.OBJECT
            ),
            dependencies=[]
        ),
        IRStep(
            name="step2", 
            expression=IROperation(
                id="op_1",
                type="operation",
                operator=OperatorType.MAP,
                inputs=[
                    IRVariable(id="var_1", type="variable", name="step1", value_type=IRType.OBJECT),
                    IRLiteral(id="lit_1", type="literal", value_type=IRType.STRING, value="result.message")
                ],
                output_type=IRType.STRING
            ),
            dependencies=["step1"]
        )
    ]
    
    # Define outputs
    outputs = [
        IROutput(name="result", step_name="step2", type=IRType.STRING)
    ]
    
    return IRPipeline(
        name="sample_pipeline",
        inputs=inputs,
        steps=steps,
        outputs=outputs
    )


def run_basic_example():
    """Run the basic Python example"""
    print("🚀 Running basic agent-dsl Python example...\n")
    
    try:
        # Create pipeline
        pipeline = create_sample_pipeline()
        print("📊 Created sample pipeline:")
        print(f"   Inputs: {[i.name for i in pipeline.inputs]}")
        print(f"   Steps: {[s.name for s in pipeline.steps]}")
        print(f"   Outputs: {[o.name for o in pipeline.outputs]}")
        print()
        
        # Create runtime and compile
        runtime = RxPyRuntime()
        compiled = runtime.compile(pipeline)
        print("✅ Compiled pipeline successfully")
        print()
        
        # Execute pipeline
        inputs = {"text": "Hello from Python!"}
        options = ExecutionOptions(debug=True, timeout_ms=5000)
        
        print("⚡ Executing pipeline...")
        print(f"   Inputs: {inputs}")
        
        def on_next(result):
            print("\n✅ Pipeline completed")
            print(f"   Result: {result}")
        
        def on_error(error):
            print(f"\n❌ Pipeline failed: {error}")
        
        def on_completed():
            print("\n🎉 Basic Python example completed!")
        
        # Subscribe and run
        observable = compiled.run(inputs, options)
        observable.subscribe(on_next, on_error, on_completed)
        
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    run_basic_example()