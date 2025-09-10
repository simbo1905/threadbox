/**
 * Error handling example
 * 
 * Demonstrates error handling, retries, and fallback mechanisms
 */

import { AgentDSL } from '../src';

async function runErrorHandlingExample() {
  console.log('🚀 Running error handling example...\n');

  const dsl = new AgentDSL();

  // Define a pipeline with error handling
  const source = `
    input: string
    
    step1 = callApi("/might-fail", { data: input })
    step2 = onError(step1, "fallback response")
    step3 = map(step2, result => "Processed: " + result)
    
    output: step3
  `;

  try {
    console.log('📝 DSL Source:');
    console.log(source);
    console.log();

    // Compile and run
    const compiled = dsl.compileSource(source);
    console.log('✅ Compiled pipeline with error handling');
    console.log();

    // Test with different inputs
    const testCases = [
      { input: 'valid-data', description: 'Normal case' },
      { input: 'error-trigger', description: 'Error case (should use fallback)' }
    ];

    for (const testCase of testCases) {
      console.log(`🧪 Testing: ${testCase.description}`);
      console.log(`   Input: ${testCase.input}`);
      
      compiled.run({ input: testCase.input }).subscribe({
        next: (result) => {
          console.log('   Result:', result);
        },
        error: (error) => {
          console.error('   Error:', error.message);
        },
        complete: () => {
          console.log('   ✅ Test completed\n');
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run the example
if (require.main === module) {
  runErrorHandlingExample().catch(console.error);
}