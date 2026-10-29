import { assertEquals, assertThrows } from "jsr:@std/assert";
import { generateRecoveryCode, jsonResponse } from "./index.ts";

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

Deno.test("jsonResponse sets correct status", () => {
  const response = jsonResponse(400, "https://tairusein.github.io", { error: "Invalid request" });
  assertEquals(response.status, 400);
});

Deno.test("jsonResponse sets correct body", async () => {
  const body = { error: "Invalid request" };
  const response = jsonResponse(400, "https://tairusein.github.io", body);
  const responseBody = await response.json();
  assertEquals(responseBody, body);
});

Deno.test("jsonResponse sets correct headers for allowed origin", () => {
  const origin = "https://tairusein.github.io";
  const response = jsonResponse(200, origin, { success: true });
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), origin);
  assertEquals(response.headers.get("Content-Type"), "application/json");
});

Deno.test("jsonResponse sets correct headers for null origin", () => {
  const response = jsonResponse(200, null, { success: true });
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "null");
  assertEquals(response.headers.get("Content-Type"), "application/json");
});

Deno.test("jsonResponse sets correct headers for disallowed origin", () => {
  const response = jsonResponse(200, "https://example.com", { success: true });
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "null");
  assertEquals(response.headers.get("Content-Type"), "application/json");
});
