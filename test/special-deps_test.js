function verify3(require, exports, module) {
  assert.equal(typeof require, 'function');
  assert.equal(typeof exports, 'object');
  assert.equal(typeof module, 'object');
  assert.deepEqual(exports, {});
  assert.equal(module.id, 'foo');
  assert.strictEqual(module.exports, exports);
}

// Verify that order doesn't matter
define("foo", ["require", "exports", "module"], (r,e,m) => verify3(r,e,m));
define("foo", ["require", "module", "exports"], (r,m,e) => verify3(r,e,m));
define("foo", ["exports", "require", "module"], (e,r,m) => verify3(r,e,m));
define("foo", ["exports", "module", "require"], (e,m,r) => verify3(r,e,m));
define("foo", ["module", "require", "exports"], (m,r,e) => verify3(r,e,m));
define("foo", ["module", "exports", "require"], (m,e,r) => verify3(r,e,m));

// Verify that duplicates works
define(
  "foo",
  ["require", "exports", "require", "module", "exports"],
  (r,e,r2,m,e2) => verify3(r,e,m)
);
define(
  "foo",
  ["require", "exports", "require", "module", "exports"],
  (r,e,r2,m,e2) => verify3(r2,e2,m)
);
