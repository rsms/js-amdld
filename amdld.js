(function(exports, require){

  const DEBUG = true;

  let modules = new Map; // Map<string,ModuleDefinition>
  let waiting = new Map; // Map<string,Set<string>>

  // Return the path to dependency 'id' starting at m.
  // Returns null if m does not depend on id.
  // Note: This is not a generic function but only works during initialization
  // and is currently only used for cyclic-dependency check.
  function deppath(m, id) { // : Array<string> | null
    if (m.waitdeps) {
      for (let wdepid of m.waitdeps) {
        if (wdepid == id) {
          return [m.id];
        }
        let wdepm = modules.get(wdepid);
        if (wdepm) {
          let path = deppath(wdepm, id);
          if (path) {
            return [m.id].concat(path);
          }
        }
      }
    }
    return null;
  }

  function* minitg(m, deps) {
    while (true) {

      for (let i = 0, L = deps.length; i != L; ++i) {
        let depid = deps[i];
        if (m.deps[i] !== undefined) {
          continue;
        }
        if (depid == 'require') {
          m.deps[i] = require;
        } else if (depid == 'exports') {
          m.deps[i] = m.exports;
        } else {
          let depm = modules.get(depid);
          if (depm && !depm.init) {
            // dependency is initialized
            m.deps[i] = depm.exports;
            if (m.waitdeps) {
              m.waitdeps.delete(depid);
            }
          } else {
            // latent dependency — add to waitdeps
            if (!m.waitdeps) {
              m.waitdeps = new Set([depid]);
            } else if (!m.waitdeps.has(depid)) {
              m.waitdeps.add(depid);
            } else {
              continue;
            }

            // check for cyclic dependencies when depm.init is still pending
            if (DEBUG && depm) {
              let cycle = deppath(depm, m.id);
              if (cycle) {
                if (cycle[cycle.length-1] != m.id) {
                  cycle.push(m.id);
                }
                throw new Error(`Cyclic module dependency: ${m.id} -> ${cycle.join(' -> ')}`);
              }
            }
          }
        }
      }

      if (!m.waitdeps || m.waitdeps.size == 0) {
        // no outstanding dependencies
        break;
      }

      yield m.waitdeps;
    }

    // clear init to signal that the module has been initialized
    m.init = null;
    
    // get dependants that are waiting
    let waitingDependants = waiting.get(m.id);
    waiting.delete(m.id); // clear this module from `waiting`

    // execute module function
    m.fn.apply(m.exports, m.deps);

    // clear module properties to free up memory since m will live forever because
    // it's owned by modules which is bound to the define's closure.
    m.deps = null;
    m.fn = null;
    m.waitdeps = null;

    if (waitingDependants) {
      // check in on dependants
      for (let depid of waitingDependants) {
        let depm = modules.get(depid);
        if (depm.init) {
          if (depm.waitdeps.size == 1) {
            // The just-initialized module is the last dependency.
            // Resume initialization of depm.
            depm.init();
          } else {
            // The just-initialized module is one of many dependencies.
            // Simply clear this module from depm's waitdeps
            depm.waitdeps.delete(m.id);
          }
        }
      }
    }
  }

  // Creates a resumable init function for module m with dependencies deps
  function minit(m, deps) {
    let initg = minitg(m, deps);

    return function init() {
      let v = initg.next();
      if (v.done) {
        // module initialized
        return true;
      }

      // add outstanding dependencies to waitset
      for (let depid of v.value) {
        let waitset = waiting.get(depid);
        if (waitset) {
          waitset.add(m.id);
        } else {
          waiting.set(depid, new Set([m.id]));
        }
      }

      return false;
    };
  }

  // if define.timeout is set, the `timeout` function is called to check for
  // modules that has not yet loaded, and if any are found throws an error.
  let timeoutTimer = null;
  let timeoutReached = false;
  function timeout() {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
    timeoutReached = true;
    if (waiting && waiting.size > 0) {
      let v = [];
      for (let id of waiting.keys()) {
        if (!modules.has(id)) {
          v.push(id);
        }
      }
      if (v.length) {
        throw new Error(`Module load timeout -- still waiting on "${v.join('", "')}"`)
      }
    }
  }

  function define(id, deps, fn) {
    if (define.timeout && define.timeout > 0) {
      if (timeoutReached) {
        return;
      }
      clearTimeout(timeoutTimer);
      timeoutTimer = setTimeout(timeout, define.timeout);
    }
    let m = {
      id,
      deps: new Array(deps.length),
      fn,
      exports: {},
      init: null,
      waitdeps: null,
    };
    modules.set(id, m);
    m.init = minit(m, deps);
    m.init();
  }

  // Set to a number larger than zero to enable timeout.
  // Whenever define() is called, the timeout is reset and when the timer expires
  // an error is thrown if there are still undefined modules.
  define['timeout'] = 0;

  define['require'] = function(id) {
    let m = modules.get(id);
    if (!m) {
      throw new Error(`unknown module "${id}"`);
    }
    return m.init ? undefined : m.exports;
  };

  exports['define'] = define;
})(this, typeof require == 'undefined' ? undefined : require);
