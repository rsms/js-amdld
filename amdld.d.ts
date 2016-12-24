type Factory = (...dependencies :any[])=>any | {[key :string] :any};

export function define(id :string, dependencies :string[], factory :Factory) :boolean;
export function define(id :string, factory :Factory) :boolean;
export function define(dependencies :string[], factory :Factory) :boolean;
export function define(factory :Factory) :boolean;

export namespace define {
  export var timeout :number;
  export function require(id :string): any;
  export var debug :boolean; // only available from amdld.g.js
}
