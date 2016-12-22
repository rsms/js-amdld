define("bar", ["foo"], function (foo) {});
define("foo", ["bar"], function (bar) {});
//!error /cyclic module dependency: foo -> bar -> foo/i
