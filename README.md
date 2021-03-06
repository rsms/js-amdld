# AMD loader

Simple JavaScript [AMD module](https://github.com/amdjs/amdjs-api/blob/master/AMD.md) loader.

- Uses generators to resolve dependencies quickly and efficiently.
- Provides deterministic module initialization by verifying there are no cyclic dependencies.
- Has no dependencies and is small in size ([ES6 version](https://unpkg.com/amdld/amdld.es6.min.js) is only 2500 bytes.)
- Modules can be loaded gradually and randomly over time with just-in-time initialization as dependencies are resolved.

[![Build status](https://travis-ci.org/rsms/js-amdld.svg?branch=master)](https://travis-ci.org/rsms/js-amdld)

Simply include the script:

```html
<script src="https://unpkg.com/amdld/amdld.min.js"></script>
```

The API is very simple:

```ts
define(
  id?           : string,
  dependencies? : string[],
  factory       : (...dependencies :any[])=>any
                | {[key :string] :any}
) : boolean
```

E.g.

```js
define("A", ["B", "C"], function(B, C) {
  console.log(C.hello, B.world);
});
define("B", ["exports"], function(exports) {
  exports.world = 'world';
});
define("C", { hello: 'Hello' });
```

Get a tested optimized ES5-compatible build from [unpkg](https://unpkg.com/amdld/) or [NPM](https://www.npmjs.com/package/amdld).

If you're only targeting ES6 hosts—for instance in an Electron app—use `amdld.es6.min.js` instead which uses native generators and other ES6 features (Symbol, const, let, etc):

```html
<script src="https://unpkg.com/amdld/amdld.es6.min.js"></script>
```


## Just-in time initialization

[![Illustration](misc/timeline.png)](https://www.figma.com/file/HdeD6xoSRs1LeLl1yDeGgHf3/AMDLD)


## Random loading

Since AMDLD uses initializers with pause-and-resumable state, dependencies and modules can be loaded in random order, in synchronous or asynchronous fashion.

Say we have some HTML like this where four modules are loaded concurrently and asynchronously:

```html
<script async src="module_1.js"></script>
<script async src="module_2_and_3.js"></script>
<script async src="module_4.js"></script>
```

Normally, this would require additional app code to track what modules have been loaded and when their dependencies has loaded. But not with AMDLD since dependency resolution is done just-in-time.

For this example, let's say that the files loaded have this content:

```js
// module_1.js
define("mod1", ["mod3"], function (mod3) { console.log('hello from mod1'); });

// module_2_and_3.js
define("mod2", ["mod3"], function (mod3) { console.log('hello from mod2'); });
define("mod3", [],       function () {     console.log('hello from mod3'); });

// module_4.js
define("mod4", ["mod3"], function () { console.log('hello from mod4'); });
```

Now imagine that the following happens in the web browser:

1. Loads HTML document
2. Sends requests for module_1.js, module_2_and_3.js and module_4.js
3. Continues to parse and initialize the rest of the HTML document
4. Receives response for module_4.js and executes the script:
  1. An outstanding dependency on "mod3" means _initialization of "mod4" is suspended._
5. Receives response for module_2_and_3.js and executes the script:
  1. "mod2" begins initialization, but is immediately suspended waiting for "mod3"
  2. "mod3" completes initialization
  3. resumes initialization of "mod4" which completes initialization
  4. resumes initialization of "mod2" which completes initialization
6. Receives response for module_1.js and executes the script:
  1. "mod1" completes initialization

The browser's console looks like this:

```
[09:30:19] hello from mod3
[09:30:19] hello from mod4
[09:30:19] hello from mod2
[09:31:21] hello from mod1
```

What's important to realize here is that "mod4" is initialized _as soon as all it's dependencies are available_, rather than when all modules has loaded. "mod1" therefore is in practice initialized later than "mod4", but since "mod1" doesn't depend on "mod4" (or vice versa), neither have to wait for the other. AMDLD guarantees that the order of initialization is the same every time for each dependency root — i.e. "mod3" is _always_ initialized before "mod1" in our example above.

The ["async" test](test/async_test.js) verifies this behavior.

When loading modules over separate files, consider setting `define.timeout` (see API.)


## Deterministic module initialization

Cyclic dependencies cause a lot of issues, primarily by preventing module initialization from being deterministic. AMDLD forces dependencies to be non-cyclical and thus by using AMDLD, all module initialization is deterministic, meaning that when a module's function is executed all it's dependencies have been executed already; any dependant values required during module initialization are guaranteed.

Check this out. Here's an example of a simple program that defines two modules:

```js
define('foo', ['bar'], function(bar) {
  let sum = bar.value * 10;
  console.log(`sum is ${sum}`); // what is printed?
})
define('bar', ['exports'], function(exports) {
  exports.value = 3;
})
```

What is printed to the console? With some module loaders, it depends on when "bar" is defined (imagine loading them over network or from disk where one module might be loaded before the other differs from time to time.)

In this case AMDLD suspends initialization of `foo` until `bar` has fully initialized, meaning that no matter when what module is loaded, the result is always the same (prints `sum is 30` to the console.)

When a cyclic dependency is detected, a short but descriptive error is thrown:

```js
define("main", ["bar"], function (bar) {});
define("bar", ["baz"], function (baz) {});
define("baz", ["main"], function () {});
// Error: Cyclic module dependency: baz -> main -> bar -> baz
```

The ["cyclic3" test](test/cyclic3_test.js) verifies this behavior.


## API

```ts
define(
  id?           : string,
  dependencies? : string[],
  factory       : (...dependencies :any[])=>any
                | {[key :string] :any}
) : boolean
  // Define a module. Returns true if the module was initialized immediately,
  // otherwise false is returned to indicate that initialization is suspended
  // waiting for a dependency.
  // See https://github.com/amdjs/amdjs-api/blob/master/AMD.md for details.

define.timeout : number = 0
  // Set to a number larger than zero to enable timeout.
  // Whenever define() is called, the timeout is reset.
  // When the timer expires an error is thrown if there are still undefined modules.

define.require(id :string) : any
  // Acquire a module's exported API. Throws an error if the module is not defined.
  // Might return undefined if the module has not yet been initialized.

define.debug : boolean = false
  // Only available in amdld.g.js, setting this to true causes detailed messages
  // to be logged to the console.
```


## Building and testing

Although you can use `amdld.js` as-is in an ES6 environment (like latest Chrome or Firefox), there are three products that are generated from the source:

- `amdld.g.js` — assertions enabled
- `amdld.min.js` — optimized code for ES5 targets (~4 kB)
  - `amdld.min.js.map` — source mappings to `amdld.js`
- `amdld.es6.min.js` — optimized code for ES6 targets (~2.5 kB)
  - `amdld.es6.min.js.map` — source mappings to `amdld.js`

To build all of these, first make sure you have `java` in your `$PATH` as it's required for closure-compiler. Then:

```
$ yarn
$ yarn build
```

Run all unit tests:

```
$ yarn test
pass basic @amdld.js
pass basic @amdld.min.js
pass cyclic1 @amdld.js
...
all pass
testing TypeScript... ok
```

See `test/test.js -h` for how to run a subset of the tests.

Note: Building and testing requires [Nodejs](https://nodejs.org/) to be installed, but is not required for using AMDLD in a web browser.

Note: If you don't have [`yarn`](https://yarnpkg.com/), you can use `npm` instead for the instructions above.


## MIT License

Copyright (c) 2016 Rasmus Andersson <https://rsms.me/>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
