// object factory with dependencies is invalid
define('a', ['b'], { value: 1 });

//!error /object module with dependencies/i
