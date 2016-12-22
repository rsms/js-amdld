// simulates loading modules from separate files that arrive randomly

let actualInitOrder = [];

let sourceFiles = {
  'module_1.js': () => {
    define("mod1", ["mod3"], function (mod3) { actualInitOrder.push('mod1'); });
  },

  'module_2_and_3.js': () => {
    define("mod2", ["mod3"], function (mod3) { actualInitOrder.push('mod2'); });
    define("mod3", [],       function () {     actualInitOrder.push('mod3'); });
  },

  'module_4.js': () => {
    define("mod4", ["mod3"], function () { actualInitOrder.push('mod4'); });
  }
}

// Order of which modules are loaded (e.g. over the internet) in our simulated async scenario:
let loadOrder = [
  'module_4.js',
  'module_2_and_3.js',
  'module_1.js',
]

// Expected initialization order
let expectedInitOrder = [
  'mod3',
  'mod4',
  'mod2',
  'mod1',
]

function loadNext(resolve, reject, index) {
  if (index === loadOrder.length) {
    resolve();
  } else {
    if (index === undefined) {
      index = 0;
    }
    sourceFiles[loadOrder[index]]();
    RunloopEnqueue(() => { loadNext(resolve, reject, index+1) });
  }
}

function Test() {
  return (new Promise(loadNext)).then(() => {
    assert.deepEqual(
      expectedInitOrder,
      actualInitOrder,
      'unexpected initialization order'
    );
  });
}
