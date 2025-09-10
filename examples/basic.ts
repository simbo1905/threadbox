/**
 * Basic agent-dsl example
 * 
 * Demonstrates simple pipeline with map operations and API calls
 */

import { AgentDSL } from '../src';

async function runBasicExample() {
  console.log('🚀 Running basic agent-dsl example...\n');

  const dsl = new AgentDSL();

  // Define a simple pipeline
  const source = `
    input: string
    
    step1 = map(input, "Hello " + input)
    step2 = callApi("/echo", { message: step1 })
    step3 = map(step2, response => response.data.message)
    
    output: step3
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
        console.log('\n🎉 Example completed!');
      }
    });

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run the example
if (require.main === module) {
  runBasicExample().catch(console.error);
}