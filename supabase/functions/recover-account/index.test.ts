import { assertEquals } from "jsr:@std/assert";
import { jsonResponse } from "./index.ts";

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
