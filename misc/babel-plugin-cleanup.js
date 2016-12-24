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
      return target;
    }
    if ((target = scope.bindings[name])) {
      return target;
    }
    return scope.parent ? scopeFind(scope.parent, name) : null;
  }

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
      if (isPathRemoved(path)) {
        --refcount;
        removeOrVoid(path);
      }
    }
    return (refcount == 0);
  }

  const visitor = {

    FunctionDeclaration(path) {
      const { scope, node } = path;
      if (node._metadata_isEmptyFunction) {
        // dump(path);
        if (node.id && node.id.name) {
          //console.log('visit FunctionDeclaration:', node.id.name)
          let b = scopeFind(scope.parent, node.id.name);
          if (b) {
            //dump(b.referencePaths);
            if (cleanupBinding(b)) {
              //console.log('remove');
              removeOrVoid(path);
            }
          }
        }
      }
    },

    VariableDeclaration(path) {
      const { scope, node } = path;

      for (let declaration of node.declarations) {
        if (declaration.id && declaration.id.name) {
          //console.log(`find in scope`, declaration.id.name)
          let b = scopeFind(scope, declaration.id.name);
          if (b) {
            if (cleanupBinding(b)) {
              removeOrVoid(b.path);
            }
          }
        }
      }
    },

  };

  return {
    name: "cleanup",
    visitor: {
      Program(path) {
        path.traverse(visitor, {});
      },
    },
  };
};
