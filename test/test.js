#!/usr/bin/env node
"use strict";
const assert = require('assert')
const vm = require('vm')
const fs = require('fs')

let amdldVariants = ['amdld.js', 'amdld.min.js'];
let logDebug = function(){};
let isInteractive = null; // [stdoutistty:bool, stderristty:bool]

function style(streamno, style, what) {
  if (!isInteractive[streamno]) {
    return what;
  }
  const styles = {
    'bold'      : ['1', '22'],
    'italic'    : ['3', '23'],
    'underline' : ['4', '24'],
    'inverse'   : ['7', '27'],

    'white'     : ['37', '39'],
    'grey'      : ['90', '39'],
    'black'     : ['30', '39'],
    'blue'      : ['34', '39'],
    'cyan'      : ['36', '39'],
    'green'     : ['32', '39'],
    'magenta'   : ['35', '39'],
    'red'       : ['31', '39'],
    'yellow'    : ['33', '39'],

    'boldWhite'     : ['1;37', '0;39'],
    'boldGrey'      : ['1;90', '0;39'],
    'boldBlack'     : ['1;30', '0;39'],
    'boldBlue'      : ['1;34', '0;39'],
    'boldCyan'      : ['1;36', '0;39'],
    'boldGreen'     : ['1;32', '0;39'],
    'boldMagenta'   : ['1;35', '0;39'],
    'boldRed'       : ['1;31', '0;39'],
    'boldYellow'    : ['1;33', '0;39'],

    'italicWhite'     : ['3;37', '0;39'],
    'italicGrey'      : ['3;90', '0;39'],
    'italicBlack'     : ['3;30', '0;39'],
    'italicBlue'      : ['3;34', '0;39'],
    'italicCyan'      : ['3;36', '0;39'],
    'italicGreen'     : ['3;32', '0;39'],
    'italicMagenta'   : ['3;35', '0;39'],
    'italicRed'       : ['3;31', '0;39'],
    'italicYellow'    : ['3;33', '0;39'],
  };
  let v = styles[style];
  return `\x1b[${v[0]}m${what}\x1b[${v[1]}m`;
}

function createAMDLD(amdldVariant) {
  let amdldScript = new vm.Script(amdldSrc[amdldVariant], {
    filename: amdldVariant,
    displayErrors: true,
  });
  let ctx = { console };
  amdldScript.runInNewContext(ctx);
  assert.equal(typeof ctx.define, 'function');
  return ctx.define;
}

function runJSTestWithVariant(filename, name, amdldVariant) { // :Promise<void>
  logDebug('run', name);
  return new Promise((resolve, reject) => {
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

    let script = new vm.Script(src, {
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
      logDebug(`script.runInNewContext("${filename}") ENTER`)
      script.runInNewContext(ctx);
      logDebug(`script.runInNewContext("${filename}") EXIT`)
      if (ctx.Test) {
        let p = ctx.Test();
        if (typeof p == 'object' && typeof p.then == 'function') {
          p.then(resolve).catch(reject);
          return;
        }
      }
    }

    resolve();
  });
}

function runJSTest(filename, name) {
  let pv = [];
  for (let amdldVariant of amdldVariants) {
    if (amdldSrc[amdldVariant]) {
      pv.push(runJSTestWithVariant(filename, name, amdldVariant).then(() => {
        process.stdout.write(
          `${style(0,'boldGreen','pass')} ${name} @${amdldVariant}\n`
        );
      }).catch(err => {
        process.stderr.write(
          `${style(1,'boldRed','FAIL')} ${name} @${amdldVariant}:\n${err.stack || String(err)}\n`
        );
        throw err;
      }));
    }
  }
  return Promise.all(pv);
}

const suffix = '_test.js';

function runAllTests() {
  return Promise.all(
    fs.readdirSync(__dirname).filter(fn =>
      fn.substr(-suffix.length) == '_test.js'
    ).map(fn =>
      runJSTest(__dirname + '/' + fn, fn.substr(0, fn.length-suffix.length))
    )
  )
}

function runSomeTests(tests) {
  return Promise.all(tests.map(name => {
    let path = __dirname + '/' + name + suffix;
    if (!fs.existsSync(path)) {
      path = __dirname + '/' + name;
      if (!fs.existsSync(path)) {
        path = name;
        if (!fs.existsSync(path)) {
          console.error(`test not found: "${name}"`);
          process.exit(1);
        }
      }
    }
    return runJSTest(path, name);
  }));
}

let args = process.argv.slice(2);
let timeout = 30000;
let timeoutTimer;

let onerr = err => {
  clearTimeout(timeoutTimer);
  console.error(style(1,'boldRed', 'aborted by error'));
  process.exit(1);
};

let onallpass = () => {
  console.log(style(0,'boldGreen','all pass'));
  clearTimeout(timeoutTimer);
}

timeoutTimer = setTimeout(function(){
  console.error(style(1,'boldRed', `timeout after ${(timeout/1000).toFixed(2)}s`));
  onerr();
}, timeout);

function checkflag(flag) {
  let i = args.indexOf(flag);
  if (i != -1) {
    args.splice(i,1);
    return true;
  }
  return false;
}

if (args.indexOf('-h') != -1 || args.indexOf('--help') != -1) {
  console.error([
    'Usage: test [options] [<test> ...]',
    'options:',
    '  --skip-min-lib       Only test against the development library (amdld.js).',
    '  --debug              Enable debug mode; prints detailed information.',
    '  --[non-]interactive  Instead of checking if stdout is interactive, be explicit',
    '                       about whether colors and other TTY-related things are output.',
  ].join('\n'));
  process.exit(1);
}

if (checkflag('--skip-min-lib')) {
  amdldVariants = amdldVariants.slice(0,1);
}

if (checkflag('--non-interactive')) {
  isInteractive = [false,false];
}
if (checkflag('--interactive')) {
  isInteractive = [true,true];
}
if (isInteractive === null) {
  // auto-detect
  isInteractive = [process.stdout.isTTY,process.stderr.isTTY];
}

if (checkflag('--debug')) {
  logDebug = function() {
    let args = Array.prototype.slice.call(arguments);
    args.unshift(style(0,'boldMagenta','[debug]'));
    console.log.apply(console, args);
  };
}

let amdldSrc = {};
for (let fn of amdldVariants) {
  try {
    amdldSrc[fn] = fs.readFileSync(__dirname + '/../' + fn);
  } catch (err) {
    console.error(style(1,'yellow', fn+' not found -- skipping tests for this variant'));
  }
}


(args.length ? runSomeTests(args) : runAllTests()).catch(onerr).then(onallpass);
