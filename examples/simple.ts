/**
 * Simple agent-dsl example that works with current parser
 * 
 * Demonstrates basic pipeline with simple operations
 */

import { AgentDSL } from '../src';

async function runSimpleExample() {
  console.log('🚀 Running simple agent-dsl example...\n');

  const dsl = new AgentDSL();

  // Define a very simple pipeline that the parser can handle
  const source = `
    input: string
    
    step1 = callApi("/echo")
    step2 = runShell("echo hello")
    
    output: step2
  `;

  try {
    console.log('📝 DSL Source:');
    console.log(source);
    console.log();

    // Parse the DSL
    console.log('🔍 Parsing...');
    const parseResult = dsl.parse(source);
    
    if (!parseResult.success) {
      console.error('❌ Parse errors:');
      parseResult.program.errors.forEach(error => {
        console.error(`  - ${error.message} (${error.location?.line}:${error.location?.column})`);
      });
      console.log('\n⚠️  Note: The parser is a basic prototype and doesn\'t support complex expressions yet.');
      console.log('   This is expected behavior for the skeleton implementation.');
      return;
    }
    
    console.log('✅ Parsed successfully');
    console.log(`   Found ${parseResult.program.pipelines.length} pipeline(s)`);
    
    const pipeline = parseResult.program.pipelines[0];
    console.log(`   Pipeline has ${pipeline.inputs.length} input(s), ${pipeline.steps.length} step(s), ${pipeline.outputs.length} output(s)`);
    console.log();

    // Compile the pipeline
    console.log('🔧 Compiling...');
    const compiled = dsl.compile(parseResult.program);
    console.log('✅ Compiled successfully');
    console.log(`   Available steps: ${compiled.getStepNames().join(', ')}`);
    console.log();

    // Execute the pipeline
    console.log('⚡ Executing...');
    const inputs = { input: 'World' };
    console.log('   Inputs:', inputs);
    
    compiled.run(inputs).subscribe({
      next: (result) => {
        console.log('✅ Execution completed');
        console.log('   Result:', result);
      },
      error: (error) => {
        console.error('❌ Execution failed:', error.message);
      },
      complete: () => {
        console.log('\n🎉 Simple example completed!');
      }
    });

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run the example
if (require.main === module) {
  runSimpleExample().catch(console.error);
}