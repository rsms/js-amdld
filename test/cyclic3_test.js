define("main", ["foo", "bar"], function (require, exports, foo_1, bar) {});
define("bar", ["foo", "baz"], function (require, exports, foo, baz) {});
define("foo", [], function (require, exports) {});
define("baz", ["main"], function (require, exports) {});
//!error /cyclic module dependency: baz -> main -> bar -> baz/i
