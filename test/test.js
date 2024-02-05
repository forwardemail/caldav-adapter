const test = require('ava');
const caldavAdapter = require('..');

// NOTE: defer to FE for tests

test('exports a function', (t) => {
  t.true(typeof caldavAdapter === 'function');
});
