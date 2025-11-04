const color = require('kleur');
const Prompt = require('./prompt');
const { erase, cursor } = require('sisteransi');
const { style, clear, lines, figures } = require('../util');

/**
 * TextPrompt Base Element
 * @param {Object} opts Options
 * @param {String} opts.message Message
 * @param {String} [opts.style='default'] Render style
 * @param {String} [opts.initial] Default value
 * @param {Function} [opts.validate] Validate function
 * @param {Stream} [opts.stdin] The Readable stream to listen to
 * @param {Stream} [opts.stdout] The Writable stream to write readline data to
 * @param {String} [opts.error] The invalid error label
 */
class TextPrompt extends Prompt {
  constructor(opts={}) {
    super(opts);
    this.transform = style.render(opts.style);
    this.scale = this.transform.scale;
    this.msg = opts.message;
    this.initial = opts.initial || ``;
    this.validator = opts.validate || (() => true);
    this.value = ``;
    this.errorMsg = opts.error || `Please Enter A Valid Value`;
    this.cursor = Number(!!this.initial);
    this.cursorOffset = 0;
    this.hasStartedEditing = false;
    this.clear = clear(``, this.out.columns);
    this.render();
  }

  set value(v) {
    if (!v && this.initial && !this.hasStartedEditing) {
      this.placeholder = true;
      this.rendered = color.gray(this.transform.render(this.initial));
    } else {
      this.placeholder = false;
      this.rendered = this.transform.render(v);
    }
    this._value = v;
    this.fire();
  }

  get value() {
    return this._value;
  }

  reset() {
    this.value = ``;
    this.cursor = Number(!!this.initial);
    this.cursorOffset = 0;
    this.fire();
    this.render();
  }

  exit() {
    this.abort();
  }

  abort() {
    this.value = this.value || this.initial;
    this.done = this.aborted = true;
    this.error = false;
    this.red = false;
    this.fire();
    this.render();
    this.out.write('\n');
    this.close();
  }

  async validate() {
    let valid = await this.validator(this.value);
    if (typeof valid === `string`) {
      this.errorMsg = valid;
      valid = false;
    }
    this.error = !valid;
  }

  async submit() {
    this.value = this.value || this.initial;
    this.cursorOffset = 0;
    this.cursor = this.rendered.length;
    await this.validate();
    if (this.error) {
      this.red = true;
      this.fire();
      this.render();
      return;
    }
    this.done = true;
    this.aborted = false;
    this.fire();
    this.render();
    this.out.write('\n');
    this.close();
  }

  next() {
    if (!this.placeholder) return this.bell();
    this.value = this.initial;
    this.cursor = this.rendered.length;
    this.fire();
    this.render();
  }

  // Convert placeholder to editable text if needed
  convertPlaceholder() {
    if (this.placeholder) {
      this.hasStartedEditing = true;
      this.value = this.initial;
      this.cursor = this.value.length;
      this.cursorOffset = 0;
    }
  }

  moveCursor(n) {
    this.cursor = this.cursor+n;
    this.cursorOffset += n;
  }

  _(c, key) {
    this.convertPlaceholder();
    let s1 = this.value.slice(0, this.cursor);
    let s2 = this.value.slice(this.cursor);
    this.value = `${s1}${c}${s2}`;
    this.red = false;
    this.cursor = s1.length + 1;
    this.render();
  }

  delete() {
    this.convertPlaceholder();
    if (this.isCursorAtStart()) return this.bell();
    let s1 = this.value.slice(0, this.cursor-1);
    let s2 = this.value.slice(this.cursor);
    this.value = `${s1}${s2}`;
    this.red = false;
    if (this.isCursorAtStart()) {
      this.cursorOffset = 0
    } else {
      this.cursorOffset++;
      this.moveCursor(-1);
    }
    this.render();
  }

  deleteForward() {
    this.convertPlaceholder();
    if (this.isCursorAtEnd()) return this.bell();
    let s1 = this.value.slice(0, this.cursor);
    let s2 = this.value.slice(this.cursor+1);
    this.value = `${s1}${s2}`;
    this.red = false;
    if (this.isCursorAtEnd()) {
      this.cursorOffset = 0;
    } else {
      this.cursorOffset++;
    }
    this.render();
  }

  deleteToStart() {
    this.convertPlaceholder();
    if (this.isCursorAtStart()) return this.bell();
    let s2 = this.value.slice(this.cursor);
    this.value = s2;
    this.red = false;
    this.cursor = 0;
    this.cursorOffset = 0;
    this.render();
  }

  deleteWord() {
    this.convertPlaceholder();
    if (this.isCursorAtStart()) return this.bell();
    let s1 = this.value.slice(0, this.cursor);
    let s2 = this.value.slice(this.cursor);

    // Find the start of the previous word
    let i = s1.length - 1;

    // Skip trailing whitespace
    while (i >= 0 && /\s/.test(s1[i])) {
      i--;
    }

    // Delete word characters
    while (i >= 0 && !/\s/.test(s1[i])) {
      i--;
    }

    let newS1 = s1.slice(0, i + 1);

    this.value = `${newS1}${s2}`;
    this.red = false;
    this.cursor = newS1.length;
    this.cursorOffset = 0;
    this.render();
  }

  first() {
    this.convertPlaceholder();
    if(this.isCursorAtStart()) return this.bell();
    this.cursor = 0;
    this.cursorOffset = 0;
    this.render();
  }

  last() {
    this.convertPlaceholder();
    this.cursor = this.value.length;
    this.cursorOffset = 0;
    this.render();
  }

  left() {
    this.convertPlaceholder();
    if (this.cursor <= 0) return this.bell();
    this.moveCursor(-1);
    this.render();
  }

  right() {
    this.convertPlaceholder();
    if (this.cursor*this.scale >= this.rendered.length) return this.bell();
    this.moveCursor(1);
    this.render();
  }

  isCursorAtStart() {
    return this.cursor === 0;
  }

  isCursorAtEnd() {
    return this.cursor*this.scale >= this.rendered.length;
  }

  render() {
    if (this.closed) return;
    if (!this.firstRender) {
      if (this.outputError)
        this.out.write(cursor.down(lines(this.outputError, this.out.columns) - 1) + clear(this.outputError, this.out.columns));
      this.out.write(clear(this.outputText, this.out.columns));
    }
    super.render();
    this.outputError = '';

    this.outputText = [
      style.symbol(this.done, this.aborted),
      color.bold(this.msg),
      style.delimiter(this.done),
      this.red ? color.red(this.rendered) : this.rendered
    ].join(` `);

    if (this.error) {
      this.outputError += this.errorMsg.split(`\n`)
          .reduce((a, l, i) => a + `\n${i ? ' ' : figures.pointerSmall} ${color.red().italic(l)}`, ``);
    }

    this.out.write(erase.line + cursor.to(0) + this.outputText + cursor.save + this.outputError + cursor.restore + cursor.move(this.cursorOffset, 0));
  }
}

module.exports = TextPrompt;