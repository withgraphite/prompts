const prompts = require('./index.js');

console.log('\n=== Manual Prompt Test ===\n');
console.log('This test will help you verify your cursor offset fix.');
console.log('\nInstructions:');
console.log('  1. Type some text');
console.log('  2. Press Ctrl+A (or Home) to jump to start');
console.log('  3. Press Ctrl+E (or End) to jump to end');
console.log('  4. Use arrow keys to move cursor');
console.log('  5. Verify cursor position is correct\n');

(async () => {
  const response = await prompts({
    type: 'text',
    name: 'testInput',
    message: 'Enter some text and test cursor movement:',
    initial: ''
  });

  console.log('\n--- Result ---');
  console.log('You entered:', response.testInput);
  console.log('\nTest complete!');
})();
