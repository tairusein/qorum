const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appJsPath = path.join(__dirname, '../app.js');
let appJsCode = fs.readFileSync(appJsPath, 'utf8');

const sandbox = {
    module: { exports: {} },
    window: {
        QORUM_CONFIG: {},
        navigator: { language: 'en-US' },
        localStorage: { getItem: () => null, setItem: () => {} },
        location: { hash: '' },
        addEventListener: () => {},
        matchMedia: () => ({ matches: false, addEventListener: () => {} }),
        supabase: { createClient: () => {} }
    },
    document: {
        createTreeWalker: () => ({ nextNode: () => null }),
        getElementById: () => ({ addEventListener: () => {}, classList: { add: () => {}, remove: () => {} }, style: {}, appendChild: () => {}, removeChild: () => {}, innerHTML: '' }),
        querySelector: () => ({ addEventListener: () => {}, classList: { add: () => {}, remove: () => {} }, style: {}, appendChild: () => {}, removeChild: () => {}, innerHTML: '' }),
        querySelectorAll: () => [],
        createElement: () => ({ addEventListener: () => {}, classList: { add: () => {}, remove: () => {} }, style: {}, appendChild: () => {} }),
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
    URLSearchParams: class { constructor() {} get() { return null; } has() { return false; } }
};

vm.createContext(sandbox);

try {
    vm.runInContext(appJsCode, sandbox);
} catch (e) {
    // Expect some UI specific errors, but the function exports should succeed
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
            console.error(e);
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
