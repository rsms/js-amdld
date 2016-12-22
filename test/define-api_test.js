// define(id?, dependencies?, factory) : void

let initConfirmation = [];

// define(id, [...], factory)
define("foo", ["exports", "bar"], function (exports, bar) {
  exports.value = bar.Bar + ':foo';
  initConfirmation.push('foo');
});

// define(id, factory)
define("bar", function () {
  this.Bar = 'bar';
  initConfirmation.push('bar');
});

// define([...], factory)
define(["exports", "bar"], function (exports, bar) {
  assert.equal(bar.Bar, 'bar');
  initConfirmation.push('anon0');
});

// define(factory)
define(function () {
  initConfirmation.push('anon1');
});

// define(id, factoryobj)
define("bar1", { value: 'bar1' });
initConfirmation.push('bar1');


function Test() {
  let m = define.require('foo');
  assert.equal(m.value, 'bar:foo');
  assert.deepEqual(initConfirmation, ['bar', 'foo', 'anon0', 'anon1', 'bar1']);
}
