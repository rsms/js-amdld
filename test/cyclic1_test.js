define("bar", ["bar"], function (foo) {});
//!error /cyclic module dependency: bar -> bar/i
