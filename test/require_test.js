// a module should be able to use require inside its factory to access
// any other module, including itself, that is or has been initialized.
define("foo", ["require", "exports", "module"], function (require, exports, module) {
  exports.hello = 'hello';
  assert.equal(typeof require, 'function', 'typeof require == "function"');
  let self = require('foo');
  assert.strictEqual(module.exports, self);
  assert.strictEqual(exports, self);
  exports.lol = 123;
  assert.equal(123, self.lol);
  assert.equal('hello', self.hello);
});

define("bar", ["require", "foo"], function (require, foo) {
  let foo2 = require('foo');
  assert.strictEqual(foo, foo2);
});
