define("main", ["require", "exports", "foo", "bar"], function (require, exports, foo, bar) {
  exports.value = foo.Foo + ':' + bar.Bar;
  assert.equal(exports.value, '1:3:1');
});
define("bar", ["require", "exports", "foo", "baz"], function (require, exports, foo, baz) {
  exports.Bar = baz.Baz + ':' + foo.Foo;
});
define("foo", ["require", "exports"], function (require, exports) {
  exports.Foo = 1;
});
define("baz", ["require", "exports"], function (require, exports) {
  exports.Baz = 3;
});

function Test() {
  let m = define.require('main');
  assert.equal(m.value, '1:3:1');
}
