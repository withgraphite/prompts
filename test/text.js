'use strict';

const test = require('tape');
const TextPrompt = require('../lib/elements/text');

test('move', (t) => {
  t.plan(6);

  const textPrompt = new TextPrompt();
  textPrompt.value = 'Hello, world!';
  textPrompt.last()
  textPrompt.render()

  t.same(textPrompt.cursorOffset, 0, 'cursorOffset is 0 at start');
  t.same(textPrompt.cursor, textPrompt.rendered.length, 'cursor starts at 0')

  textPrompt.right();
  t.same(textPrompt.cursorOffset, 0, 'cursorOffset is unaffected when moved right from the end');
  t.same(textPrompt.cursor, textPrompt.rendered.length, 'cursor is unaffected when moved right from the end')

  textPrompt.left();
  t.equal(textPrompt.cursorOffset, -1, 'cursorOffset is -1 when moved left');

  textPrompt.right();
  t.equal(textPrompt.cursorOffset, 0, 'cursorOffset is 0 when moved left');

  t.end();
});

test('delete', (t) => {
  t.plan(4);

  const textPrompt = new TextPrompt();
  textPrompt.value = 'Hello, world!';
  textPrompt.last();
  textPrompt.render();

  textPrompt.delete();
  t.same(textPrompt.cursorOffset, 0, 'cursorOffset is 0 after delete');
  t.same(textPrompt.cursor, textPrompt.rendered.length, 'cursor stays at end of line')

  textPrompt.left();
  textPrompt.deleteForward()
  t.same(textPrompt.cursorOffset, 0, 'cursorOffset is 0 after deleteForward');
  t.same(textPrompt.cursor, textPrompt.rendered.length, 'cursor stays at end of line')

  textPrompt.submit();
  t.end()
});

test('submit', (t) => {
  t.plan(2)
  const textPrompt = new TextPrompt();
  textPrompt.value = 'Hello, world!';
  textPrompt.submit()

  t.same(textPrompt.cursorOffset, 0, 'cursorOffset is reset on submit')
  t.same(textPrompt.cursor, textPrompt.rendered.length, 'cursor is reset to end of line on submit')
})

test('deleteToStart', (t) => {
  t.plan(6);

  const textPrompt = new TextPrompt();
  textPrompt.value = 'Hello, world!';
  textPrompt.last();
  textPrompt.render();

  // Move cursor to middle of text
  textPrompt.left();
  textPrompt.left();
  textPrompt.left();
  textPrompt.left();
  textPrompt.left();
  textPrompt.left();
  textPrompt.left();

  t.same(textPrompt.cursor, 6, 'cursor is at position 6');

  textPrompt.deleteToStart();
  t.same(textPrompt.value, ' world!', 'text before cursor is deleted');
  t.same(textPrompt.cursor, 0, 'cursor moved to start');
  t.same(textPrompt.cursorOffset, 0, 'cursorOffset is 0');

  // Test at start of line (should do nothing)
  textPrompt.deleteToStart();
  t.same(textPrompt.value, ' world!', 'text unchanged when at start');
  t.same(textPrompt.cursor, 0, 'cursor still at start');

  textPrompt.submit();
  t.end();
});

test('first', (t) => {
  t.plan(3);

  const textPrompt = new TextPrompt();
  textPrompt.value = 'Hello, world!';
  textPrompt.last();
  textPrompt.render();

  // Nudge left so offset is non-zero, then verify reset on first()
  textPrompt.left();
  t.same(textPrompt.cursorOffset, -1, 'precondition: cursorOffset moved left');

  textPrompt.first();
  t.same(textPrompt.cursor, 0, 'cursor moved to start');
  t.same(textPrompt.cursorOffset, 0, 'cursorOffset reset to 0');

  t.end();
});

test('last', (t) => {
  t.plan(3);

  const textPrompt = new TextPrompt();
  textPrompt.value = 'Hello, world!';
  textPrompt.first();
  textPrompt.render();

  // Nudge right so offset is non-zero, then verify reset on last()
  textPrompt.right();
  t.same(textPrompt.cursorOffset, 1, 'precondition: cursorOffset moved right');

  textPrompt.last();
  t.same(textPrompt.cursor, textPrompt.rendered.length, 'cursor moved to end');
  t.same(textPrompt.cursorOffset, 0, 'cursorOffset reset to 0');

  t.end();
});

test('deleteWord', (t) => {
  t.plan(7);

  const textPrompt = new TextPrompt();
  textPrompt.value = 'Hello, world!';
  textPrompt.last();
  textPrompt.render();

  // Delete last word
  textPrompt.deleteWord();
  t.same(textPrompt.value, 'Hello, ', 'last word deleted');
  t.same(textPrompt.cursor, 7, 'cursor moved to end of remaining text');

  // Delete remaining word
  textPrompt.deleteWord();
  t.same(textPrompt.value, '', 'all text deleted');
  t.same(textPrompt.cursor, 0, 'cursor at start');

  // Test with multiple spaces
  textPrompt.value = 'one   two';
  textPrompt.last();
  textPrompt.render();

  textPrompt.deleteWord();
  t.same(textPrompt.value, 'one   ', 'word deleted, spaces remain');

  // Test at start (should do nothing)
  textPrompt.first();
  textPrompt.deleteWord();
  t.same(textPrompt.value, 'one   ', 'text unchanged when at start');
  t.same(textPrompt.cursor, 0, 'cursor still at start');

  textPrompt.submit();
  t.end();
});

test('initial value creates placeholder', (t) => {
  t.plan(3);

  const textPrompt = new TextPrompt({ message: 'Test', initial: 'initial value' });
  
  t.ok(textPrompt.placeholder, 'placeholder is true');
  t.same(textPrompt.value, '', 'value is empty');
  t.same(textPrompt.initial, 'initial value', 'initial value is set');

  t.end();
});

test('typing converts placeholder and edits initial value', (t) => {
  t.plan(5);

  const textPrompt = new TextPrompt({ message: 'Test', initial: 'terkelg' });
  
  // Initially placeholder
  t.ok(textPrompt.placeholder, 'starts with placeholder');
  t.same(textPrompt.value, '', 'value is empty initially');
  
  // Type a character
  textPrompt._('a', {});
  
  t.notOk(textPrompt.placeholder, 'placeholder is false after typing');
  t.same(textPrompt.value, 'terkelga', 'value is initial + typed character');
  t.ok(textPrompt.hasStartedEditing, 'hasStartedEditing is true');

  t.end();
});

test('deleting all characters does not restore placeholder', (t) => {
  t.plan(4);

  const textPrompt = new TextPrompt({ message: 'Test', initial: 'terkelg' });
  
  // Start editing
  textPrompt._('a', {});
  t.same(textPrompt.value, 'terkelga', 'value is initial + typed character');
  
  // Delete all characters - move to end first, then delete until empty
  textPrompt.last();
  while (textPrompt.value.length > 0) {
    textPrompt.delete();
  }
  
  t.same(textPrompt.value, '', 'value is empty after deleting all');
  t.notOk(textPrompt.placeholder, 'placeholder does not return');
  t.ok(textPrompt.hasStartedEditing, 'hasStartedEditing remains true');

  t.end();
});

test('deleteToStart with placeholder converts and works', (t) => {
  t.plan(4);

  const textPrompt = new TextPrompt({ message: 'Test', initial: 'hello world' });
  
  t.ok(textPrompt.placeholder, 'starts with placeholder');
  
  // Ctrl+U should convert placeholder and delete everything before cursor (which is at end)
  textPrompt.deleteToStart();
  
  t.notOk(textPrompt.placeholder, 'placeholder is false after deleteToStart');
  t.same(textPrompt.value, '', 'all text deleted (cursor was at end)');
  t.ok(textPrompt.hasStartedEditing, 'hasStartedEditing is true');

  t.end();
});

test('deleteWord with placeholder converts and works', (t) => {
  t.plan(4);

  const textPrompt = new TextPrompt({ message: 'Test', initial: 'hello world' });
  
  t.ok(textPrompt.placeholder, 'starts with placeholder');
  
  // Ctrl+W should convert placeholder and delete last word
  textPrompt.deleteWord();
  
  t.notOk(textPrompt.placeholder, 'placeholder is false after deleteWord');
  t.same(textPrompt.value, 'hello ', 'last word deleted');
  t.ok(textPrompt.hasStartedEditing, 'hasStartedEditing is true');

  t.end();
});

test('arrow keys convert placeholder', (t) => {
  t.plan(6);

  const textPrompt = new TextPrompt({ message: 'Test', initial: 'hello' });
  
  t.ok(textPrompt.placeholder, 'starts with placeholder');
  
  // Left arrow should convert placeholder
  textPrompt.left();
  
  t.notOk(textPrompt.placeholder, 'placeholder is false after left arrow');
  t.same(textPrompt.value, 'hello', 'value is initial');
  t.ok(textPrompt.hasStartedEditing, 'hasStartedEditing is true');
  
  // Right arrow should also work (though we're already converted)
  const textPrompt2 = new TextPrompt({ message: 'Test', initial: 'hello' });
  textPrompt2.right();
  t.notOk(textPrompt2.placeholder, 'placeholder is false after right arrow');
  t.ok(textPrompt2.hasStartedEditing, 'hasStartedEditing is true');

  t.end();
});

test('backspace with placeholder converts and works', (t) => {
  t.plan(4);

  const textPrompt = new TextPrompt({ message: 'Test', initial: 'hello' });
  
  t.ok(textPrompt.placeholder, 'starts with placeholder');
  
  // Backspace should convert placeholder (cursor at end, so deletes last char)
  textPrompt.delete();
  
  t.notOk(textPrompt.placeholder, 'placeholder is false after delete');
  t.same(textPrompt.value, 'hell', 'last character deleted');
  t.ok(textPrompt.hasStartedEditing, 'hasStartedEditing is true');

  t.end();
});

test('first and last with placeholder convert', (t) => {
  t.plan(6);

  const textPrompt = new TextPrompt({ message: 'Test', initial: 'hello' });
  
  t.ok(textPrompt.placeholder, 'starts with placeholder');
  
  // Ctrl+A (first) should convert placeholder
  textPrompt.first();
  
  t.notOk(textPrompt.placeholder, 'placeholder is false after first');
  t.same(textPrompt.value, 'hello', 'value is initial');
  t.ok(textPrompt.hasStartedEditing, 'hasStartedEditing is true');
  
  // Ctrl+E (last) should also convert
  const textPrompt2 = new TextPrompt({ message: 'Test', initial: 'hello' });
  textPrompt2.last();
  t.notOk(textPrompt2.placeholder, 'placeholder is false after last');
  t.ok(textPrompt2.hasStartedEditing, 'hasStartedEditing is true');

  t.end();
});

test('reset does not restore placeholder after editing', (t) => {
  t.plan(4);

  const textPrompt = new TextPrompt({ message: 'Test', initial: 'hello' });
  
  // Start editing
  textPrompt._('a', {});
  t.ok(textPrompt.hasStartedEditing, 'hasStartedEditing is true');
  
  // Reset
  textPrompt.reset();
  
  t.same(textPrompt.value, '', 'value is empty after reset');
  t.notOk(textPrompt.placeholder, 'placeholder does not return after reset');
  t.ok(textPrompt.hasStartedEditing, 'hasStartedEditing remains true');

  t.end();
});
