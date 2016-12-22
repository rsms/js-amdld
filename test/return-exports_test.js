// when a factory function returning a truthy value, that value
// should become the module's 'exports'.

define("foo", [], function () {
  return { value: 'Foo' }
});

define("bar", ["foo"], function (foo) {
  assert.equal(foo.value, 'Foo');
});

// Note: We don't modify exports in the following case simply becase
// an anonymous module can not be imported and thus its `exports` are
// only available inside the factory function — `define` does not keep
// references to modules w/o identifiers.
define(function () {
  return { value: 'anon' }
});
