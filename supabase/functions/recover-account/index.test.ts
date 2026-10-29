import { assertEquals, assertThrows } from "jsr:@std/assert";
import { generateRecoveryCode } from "./index.ts";

Deno.test("generateRecoveryCode - happy path", () => {
  const originalGetRandomValues = crypto.getRandomValues;
  try {
    crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
      if (array && array.buffer) {
        const arr = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i % 256;
        }
      }
      return array;
    };
    const code = generateRecoveryCode();
    // Deterministic base64 encoding of [0, 1, 2, ..., 31]
    assertEquals(code, "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8");
  } finally {
    crypto.getRandomValues = originalGetRandomValues;
  }
});

Deno.test("generateRecoveryCode - error path", () => {
  const originalGetRandomValues = crypto.getRandomValues;
  try {
    crypto.getRandomValues = () => {
      throw new Error("Crypto error");
    };
    assertThrows(() => generateRecoveryCode(), Error, "Crypto error");
  } finally {
    crypto.getRandomValues = originalGetRandomValues;
  }
});
