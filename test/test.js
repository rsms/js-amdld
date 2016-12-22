const assert = require('assert')
const vm = require('vm')
const fs = require('fs')

const amdldVariants = ['amdld.js', 'amdld.min.js'];

let amdldSrc = {};
for (let fn of amdldVariants) {
  try {
    amdldSrc[fn] = fs.readFileSync(__dirname + '/../' + fn);
  } catch (err) {
    console.error(fn+' not found -- skipping tests for this variant');
  }
}

function createAMDLD(amdldVariant) {
  let amdldScript = new vm.Script(amdldSrc[amdldVariant], {
    filename: amdldVariant,
    displayErrors: true,
  });
  let ctx = { console };
  amdldScript.runInNewContext(ctx);
  //console.log('ctx', ctx)
  assert.equal(typeof ctx.define, 'function');
  return ctx.define;
}

function runJSTestWithVariant(filename, name, amdldVariant) { // :Promise<void>
  let define = createAMDLD(amdldVariant);

  let src = fs.readFileSync(filename, {encoding:'utf8'});
  let expectError = null;
  let m = src.match(/\/\/\!error\s+(.+)\s*(?:\n|$)/);
  if (m) {
    expectError = m[1];
    if (expectError[0] != '/') {
      throw new Error('"//!error" value must be a regex (/.../)');
    }
    expectError = vm.runInNewContext(expectError);
  }

  let script, scriptLoadOK = false;

  try {
    script = new vm.Script(src, {
      filename,
      displayErrors: true,
      timeout: 10000,
    });

    let ctx = {
      define,
      console,
      assert,
      setTimeout,
      clearTimeout,
      RunloopEnqueue: process.nextTick
    };

    if (expectError) {
      assert.throws(() => {
        script.runInNewContext(ctx);
      }, expectError);
    } else {
      script.runInNewContext(ctx);
      if (ctx.Test) {
        let p = ctx.Test();
        if (typeof p == 'object' && typeof p.then == 'function') {
          return p;
        }
      }
    }
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

function runJSTest(filename, name) {
  let pv = [];
  for (let amdldVariant of amdldVariants) {
    if (amdldSrc[amdldVariant]) {
      pv.push(runJSTestWithVariant(filename, name, amdldVariant).then(() => {
        process.stdout.write(`ok ${name} @${amdldVariant}\n`);
      }).catch(err => {
        process.stderr.write(`FAIL ${name} @${amdldVariant}:\n${err.stack || String(err)}\n`);
      }));
    }
  }
  return Promise.all(pv);
}

const suffix = '_test.js';
Promise.all(
  fs.readdirSync(__dirname).filter(fn =>
    fn.substr(-suffix.length) == '_test.js'
  ).map(fn =>
    runJSTest(__dirname + '/' + fn, fn.substr(0, fn.length-suffix.length))
  )
)

