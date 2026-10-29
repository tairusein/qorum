const assert = require('assert');

// A simple mock for window and localStorage
global.window = {
  QORUM_CONFIG: {},
  supabase: null,
  addEventListener: () => {},
  dispatchEvent: () => {},
  location: { search: "" },
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

const domMock = {
  addEventListener: () => {},
  querySelector: () => domMock,
  querySelectorAll: () => [],
  classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false, replace: () => {} },
  style: {},
  value: "",
  textContent: "",
  dataset: {},
  getAttribute: () => null,
  setAttribute: () => {},
  appendChild: () => {},
  append: () => {},
  remove: () => {},
  replaceChildren: () => {},
  closest: () => null,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 })
};

global.document = {
  getElementById: () => domMock,
  querySelectorAll: () => [],
  querySelector: () => domMock,
  documentElement: { lang: "en" },
  createTreeWalker: () => ({ nextNode: () => null }),
  body: domMock,
  createElement: () => domMock,
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.MutationObserver = class { observe() {} };
global.NodeFilter = { SHOW_TEXT: 1 };
global.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

// Overwrite global set/clear Interval/Timeout so Node's event loop doesn't hang
global.setInterval = () => 0;
global.setTimeout = () => 0;

const { formatDuration } = require('../app.js');

function check(seconds, lang, expected) {
  const actual = formatDuration(seconds, lang);
  assert.strictEqual(actual, expected, "Failed for " + seconds + " (" + lang + "): expected " + expected + ", got " + actual);
}

let testCount = 0;

check(0, "en", "0m"); testCount++;
check(59, "en", "0m"); testCount++;
check(60, "en", "1m"); testCount++;
check(119, "en", "1m"); testCount++;
check(120, "en", "2m"); testCount++;
check(3599, "en", "59m"); testCount++;
check(3600, "en", "1h 0m"); testCount++;
check(3660, "en", "1h 1m"); testCount++;
check(7320, "en", "2h 2m"); testCount++;

check(60, "ru", "1 мин"); testCount++;
check(3660, "ru", "1 ч 1 мин"); testCount++;

check(60, "de", "1 Min."); testCount++;
check(3660, "de", "1 Std. 1 Min."); testCount++;

check("60", "en", "1m"); testCount++;
check(-10, "en", "0m"); testCount++;
check(null, "en", "0m"); testCount++;
check(undefined, "en", "0m"); testCount++;

console.log("All " + testCount + " formatDuration tests passed.");
