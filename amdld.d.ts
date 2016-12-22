export function define(id :string, deps :string[], body :(deps :any)=>void) :boolean;
export namespace define {
  export var timeout :number;
  export function require(id :string): any;
}