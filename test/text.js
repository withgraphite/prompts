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
  t.plan(4);

  const textPrompt = new TextPrompt();
  textPrompt.value = 'Hello, world!';
  textPrompt.last();
  textPrompt.render();

  // Move left repeatedly to the beginning to capture expected state
  const length = textPrompt.rendered.length;
  for (let i = 0; i < length; i++) {
    textPrompt.left();
  }

  const expectedCursor = textPrompt.cursor;
  const expectedOffset = textPrompt.cursorOffset;

  t.same(expectedCursor, 0, 'manual movement reaches start');

  // Reset to end and use first()
  textPrompt.last();
  textPrompt.render();
  textPrompt.first();

  t.same(textPrompt.cursor, expectedCursor, 'first() cursor matches manual movement');
  t.same(textPrompt.cursorOffset, expectedOffset, 'first() cursorOffset matches manual movement');
  t.same(textPrompt.cursor, 0, 'cursor moved to start');

  t.end();
});

test('last', (t) => {
  t.plan(4);

  const textPrompt = new TextPrompt();
  textPrompt.value = 'Hello, world!';
  textPrompt.first();
  textPrompt.render();

  // Move right repeatedly to the end to capture expected state
  const length = textPrompt.rendered.length;
  for (let i = 0; i < length; i++) {
    textPrompt.right();
  }

  const expectedCursor = textPrompt.cursor;
  const expectedOffset = textPrompt.cursorOffset;

  t.same(expectedCursor, textPrompt.rendered.length, 'manual movement reaches end');

  // Reset to start and use last()
  textPrompt.first();
  textPrompt.render();
  textPrompt.last();

  t.same(textPrompt.cursor, expectedCursor, 'last() cursor matches manual movement');
  t.same(textPrompt.cursorOffset, expectedOffset, 'last() cursorOffset matches manual movement');
  t.same(textPrompt.cursor, textPrompt.rendered.length, 'cursor moved to end');

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
