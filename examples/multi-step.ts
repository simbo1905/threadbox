/**
 * Multi-step pipeline example
 * 
 * Demonstrates complex pipeline with dependencies, parallel execution, and tools
 */

import { AgentDSL } from '../src';

async function runMultiStepExample() {
  console.log('🚀 Running multi-step pipeline example...\n');

  const dsl = new AgentDSL();

  // Define a complex pipeline
  const source = `
    input: string
    
    # Parallel data gathering
    step1 = callApi("/analyze", { text: input })
    step2 = runShell("wc -w", { input: input })
    step3 = useMCP("sentiment", { text: input })
    
    # Combine results
    step4 = zip(step1, step2)
    step5 = zip(step4, step3)
    
    # Final processing
    step6 = map(step5, results => {
      analysis: results[0][0],
      wordCount: results[0][1], 
      sentiment: results[1]
    })
    
    output: step6
  `;

  try {
    console.log('📝 DSL Source:');
    console.log(source);
    console.log();

    // Parse and show pipeline structure
    const parseResult = dsl.parse(source);
    if (!parseResult.success) {
      console.error('❌ Parse failed');
      return;
    }

    const pipeline = parseResult.program.pipelines[0];
    console.log('📊 Pipeline Structure:');
    console.log(`   Inputs: ${pipeline.inputs.map(i => `${i.name}:${i.type}`).join(', ')}`);
    console.log('   Steps:');
    pipeline.steps.forEach(step => {
      const deps = step.dependencies.length > 0 ? ` (depends on: ${step.dependencies.join(', ')})` : '';
      console.log(`     ${step.name}${deps}`);
    });
    console.log(`   Outputs: ${pipeline.outputs.map(o => `${o.name} from ${o.stepName}`).join(', ')}`);
    console.log();

    // Compile and run
    const compiled = dsl.compile(parseResult.program);
    console.log('✅ Compiled complex pipeline');
    console.log();

    console.log('⚡ Executing...');
    const inputs = { input: 'This is a sample text for analysis' };
    console.log('   Inputs:', inputs);
    
    compiled.run(inputs, { debug: true, timeout: 10000 }).subscribe({
      next: (result) => {
        console.log('\n✅ Pipeline completed');
        console.log('   Final result:');
        console.log(JSON.stringify(result, null, 2));
      },
      error: (error) => {
        console.error('\n❌ Pipeline failed:', error.message);
      },
      complete: () => {
        console.log('\n🎉 Multi-step example completed!');
      }
    });

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run the example
if (require.main === module) {
  runMultiStepExample().catch(console.error);
}