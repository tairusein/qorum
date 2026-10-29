const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appJsPath = path.join(__dirname, '../app.js');
let appJsCode = fs.readFileSync(appJsPath, 'utf8');

const sandbox = {
    module: { exports: {} },
    window: {
        QORUM_CONFIG: { supabaseUrl: "__SUPABASE_URL__", supabasePublishableKey: "__SUPABASE_PUBLISHABLE_KEY__" },
        navigator: { language: 'en-US' },
        localStorage: { getItem: () => null, setItem: () => {} },
        location: { hash: '' },
        addEventListener: () => {},
        matchMedia: () => ({ matches: false, addEventListener: () => {} }),
supabase: { createClient: () => {} },
            setTimeout: () => 0,
            clearTimeout: () => {},
            setInterval: () => 0,
            clearInterval: () => {},
            dispatchEvent: () => {}
        },
        document: {
            createTreeWalker: () => ({ nextNode: () => null }),
            getElementById: () => ({ querySelectorAll: () => [], getAttribute: () => null, setAttribute: () => {}, value: '', replaceChildren: () => {}, addEventListener: () => {}, classList: { add: () => {} }, remove: () => {}, style: {}, appendChild: () => {}, removeChild: () => {}, innerHTML: '' }),
            querySelector: () => ({ querySelectorAll: () => [], getAttribute: () => null, setAttribute: () => {}, value: '', replaceChildren: () => {}, addEventListener: () => {}, classList: { add: () => {} }, remove: () => {}, style: {}, appendChild: () => {}, removeChild: () => {}, innerHTML: '' }),
            querySelectorAll: () => [],
            createElement: () => ({ querySelectorAll: () => [], getAttribute: () => null, setAttribute: () => {}, value: '', replaceChildren: () => {}, addEventListener: () => {}, classList: { add: () => {} }, remove: () => {}, style: {}, appendChild: () => {}, removeChild: () => {}, innerHTML: '' }),
        body: { appendChild: () => {}, classList: { add: () => {}, remove: () => {} } },
        documentElement: { style: { setProperty: () => {} }, lang: 'en' },
        addEventListener: () => {}
    },
    navigator: { language: 'en-US' },
    localStorage: { getItem: () => null, setItem: () => {} },
    location: { hash: '' },
    console: { log: () => {}, error: () => {}, warn: () => {} },
    Math: Math,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    MutationObserver: class { constructor() {} observe() {} disconnect() {} },
    BroadcastChannel: class { constructor() {} postMessage() {} close() {} },
    CustomEvent: class { constructor() {} },
    NodeFilter: { SHOW_TEXT: 4 },
    URLSearchParams: class { constructor() {} get() { return null; } has() { return false; } }, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    Event: class {}
};

vm.createContext(sandbox);

try {
    vm.runInContext(appJsCode, sandbox);
} catch (e) {
    // Expected UI error
}

if (!sandbox.module.exports.generateRoomCode) {
    console.error("Failed to load generateRoomCode into VM context from module.exports");
    process.exit(1);
}

const generateRoomCode = sandbox.module.exports.generateRoomCode;

function runTests() {
    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log("PASS: " + name);
            passed++;
        } catch (e) {
            console.error("FAIL: " + name);
            // Expected UI error;
            failed++;
        }
    }

    test('generates code with correct prefix for tic-tac-toe', () => {
        const code = generateRoomCode('tic-tac-toe');
        assert.strictEqual(code.startsWith('T'), true);
        assert.strictEqual(code.length, 5);
    });

    test('generates code with correct prefix for unknown game', () => {
        const code = generateRoomCode('unknown-game');
        assert.strictEqual(code.startsWith('Q'), true);
        assert.strictEqual(code.length, 5);
    });

    test('uses only allowed characters after the prefix', () => {
        const code = generateRoomCode('tic-tac-toe');
        const allowedChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (let i = 1; i < code.length; i++) {
            assert.strictEqual(allowedChars.includes(code[i]), true, "Character " + code[i] + " not allowed");
        }
    });

    test('generates correct code based on Math.random', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.5; // Always pick the middle character 'S'

        try {
            const code = generateRoomCode('tic-tac-toe');
            assert.strictEqual(code, 'TSSSS');
        } finally {
            Math.random = originalRandom;
        }
    });

    console.log("\n" + passed + " passed, " + failed + " failed");
    if (failed > 0) process.exit(1);
}

runTests();
