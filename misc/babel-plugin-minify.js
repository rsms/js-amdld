"use strict";

// const inspect = require('util').inspect;
// function dump() {
//   let args = Array.prototype.slice.call(arguments);
//   console.log(inspect(args.length === 1 ? args[0] : args, {colors:true}));
// }

module.exports = ({ types: t }) => {

  // If we can't remove the expression we'll just replace it with an empty statement.
  function removeOrVoid(path) {
    // If we are working with the expression of an expression statement we want to deal
    // with the expression statement instead.
    if (path.parentPath.isExpressionStatement({ expression: path.node })) {
      path = path.parentPath;
    }

    // If we are working with a variable declarator and there is only one then
    // we need to look at the parent.
    if (path.isVariableDeclarator() && path.parent.declarations[0] === path.node &&
      path.parent.declarations.length === 1
    ) {
      path = path.parentPath;
    }

    if (!path.inList && path.scope.path.type !== "ForStatement") {
      path.replaceWith(t.emptyStatement());
    } else {
      path.remove();
    }
  }

  function scopeFind(scope, name) { // : Binding
    let target = scope.globals[name];
    if (target) {
      // console.log(`scopeFind "${name}": found global`);
      return target;
    }
    if ((target = scope.bindings[name])) {
      // console.log(`scopeFind "${name}": found in bindings`);
      return target;
    }
    // console.log(`scopeFind "${name}" not found -- trying parent`);
    return scope.parent ? scopeFind(scope.parent, name) : null;
  }

  const visitor = state => {

    // state.noopBindings = new Set;

    function isEmptyFunction2(scope, node, depth) {
      if (node._metadata_isEmptyFunction !== undefined) {
        return node._metadata_isEmptyFunction;
      }
      if (!depth) {
        depth = 0;
      } else if (depth > 1000) {
        return node._metadata_isEmptyFunction = false;
      }
      if (t.isIdentifier(node)) {
        let binding = scopeFind(scope, node.name);
        // console.log(`isEmptyFunction2 binding for: "${node.name}"`);
        if (binding && binding.path && 
            ( isBindingEmptyFunction(binding) ||
              isEmptyFunction2(binding.scope, binding.path.node, depth+1)
            )
           )
        {
          // state.noopBindings.add(binding);
          binding._metadata_X = true;
          return node._metadata_isEmptyFunction = true;
        }
      } else if (t.isFunctionDeclaration(node) || t.isFunctionExpression(node)) {
        // console.log(`isEmptyFunction2 isFunctionDeclaration`);
        if (node.body && Array.isArray(node.body.body) && node.body.body.length === 0) {
          return node._metadata_isEmptyFunction = true;
        }
      }
      return node._metadata_isEmptyFunction = false;
    }

    function isBindingEmptyFunction(binding) {
      if (binding._metadata_isEmptyFunction !== undefined) {
        return binding._metadata_isEmptyFunction;
      }
      let node = binding.path.node;
      if (binding.constant && t.isVariableDeclarator(node)) {
        // dump(node);
        // dump(binding);
        if (isEmptyFunction2(binding.scope, node.init)) {
          return binding._metadata_isEmptyFunction = true;
        }
      }
      return binding._metadata_isEmptyFunction = false;
    }

    return {

      CallExpression(path) {
        const { node, scope } = path;
        // console.log('visit CallExpression') dump(node.callee);
        if (isEmptyFunction2(scope, node.callee)) {
          // console.log('CallExpression isEmptyFunction2!')
          // console.log(Object.keys(t).join(' ')); process.exit(0)
          path.replaceWith(t.identifier('undefined'));
          node._metadata_REMOVED = true;
        }
      },

      ExpressionStatement(path) {
        const { scope, node } = path;
        if (node.expression.callee && isEmptyFunction2(scope, node.expression.callee)) {
          // dump(path)
          // console.log('ExpressionStatement isEmptyFunction2!')
          removeOrVoid(path);
          node._metadata_REMOVED = true;
        }
      },
    }
  };

  function isPathRemoved(path) {
    // dump(path.node);
    return (
      path.removed ||
      !path.node ||
      ( path.parentPath &&
        isPathRemoved(path.parentPath)
      )
    ) ? path : null;
  }

  function cleanupBinding(b) {
    let refcount = b.references;
    for (let path of b.referencePaths) {
      // dump(path);
      // console.log('≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠≠');
      if (isPathRemoved(path)) {
        --refcount;
        removeOrVoid(path);
      }
      // else console.log('is not removed', b);
    }
    return (refcount == 0);
  }

  const cleanupVisitor = state => { return {

    VariableDeclaration(path) {
      const { scope, node } = path;

      for (let declaration of node.declarations) {
        if (declaration.id && declaration.id.name) {
          // console.log(`find in scope`, declaration.id.name)
          let b = scopeFind(scope, declaration.id.name);
          if (b) {
            if (cleanupBinding(b)) {
              removeOrVoid(b.path);
            }
          }
        }
      }
    },

  }};

  return {
    name: "minify-empty-function2",
    visitor: {
      Program(path) {
        let state = {};
        // console.log('\n——————————————————————————————\nPASS 1\n——————————————————————————————')
        path.traverse(visitor(state), {});
        // console.log('\n——————————————————————————————\nPASS 2\n——————————————————————————————')
        path.traverse(cleanupVisitor(state), {});
      },
    },
  };
};
