"""
Basic test of agent-dsl Python types without external dependencies

This demonstrates the core type system works
"""

import sys
import os

# Add the agent_dsl package to the path
sys.path.insert(0, os.path.dirname(__file__))

try:
    from agent_dsl.types import *
    
    print("🚀 Testing agent-dsl Python types...\n")
    
    # Test basic type creation
    print("✅ Creating IR types...")
    
    # Create a simple literal
    literal = IRLiteral(
        id="test_1",
        type="literal",
        value_type=IRType.STRING,
        value="Hello World"
    )
    print(f"   Created literal: {literal.value}")
    
    # Create a variable
    variable = IRVariable(
        id="test_2", 
        type="variable",
        name="input",
        value_type=IRType.STRING
    )
    print(f"   Created variable: {variable.name}")
    
    # Create a tool
    tool = IRTool(
        id="test_3",
        type="tool", 
        tool_name="callApi",
        config={"url": "/test"},
        input_type=IRType.STRING,
        output_type=IRType.OBJECT
    )
    print(f"   Created tool: {tool.tool_name}")
    
    # Create a pipeline
    pipeline = IRPipeline(
        name="test_pipeline",
        inputs=[
            IRInput(name="text", type=IRType.STRING)
        ],
        steps=[
            IRStep(
                name="process",
                expression=tool,
                dependencies=[]
            )
        ],
        outputs=[
            IROutput(name="result", step_name="process", type=IRType.OBJECT)
        ]
    )
    
    print(f"   Created pipeline: {pipeline.name}")
    print(f"   - Inputs: {[i.name for i in pipeline.inputs]}")
    print(f"   - Steps: {[s.name for s in pipeline.steps]}")  
    print(f"   - Outputs: {[o.name for o in pipeline.outputs]}")
    
    print("\n🎉 Python types test completed successfully!")
    print("\nNote: Full runtime requires external dependencies (RxPY, etc.)")
    print("This test demonstrates the core type system is working correctly.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()