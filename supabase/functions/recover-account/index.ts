import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://tairusein.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function responseHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function jsonResponse(
  status: number,
  origin: string | null,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

async function hashRecoveryCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

Deno.serve(async request => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, origin, { error: "Method not allowed." });
  }
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse(403, origin, { error: "This site is not allowed to use account recovery." });
  }

  let payload: { username?: unknown; recoveryCode?: unknown; newPassword?: unknown };
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(400, origin, { error: "Invalid request." });
    }
    payload = body as { username?: unknown; recoveryCode?: unknown; newPassword?: unknown };
  } catch {
    return jsonResponse(400, origin, { error: "Invalid request." });
  }

  const { username, recoveryCode, newPassword } = payload;
  if (
    typeof username !== "string"
    || !/^[A-Za-z0-9_]{3,24}$/.test(username)
    || typeof recoveryCode !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(recoveryCode)
    || typeof newPassword !== "string"
    || newPassword.length < 8
    || newPassword.length > 72
  ) {
    return jsonResponse(400, origin, { error: "Check the username, recovery code, and new password." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const serviceKey = secretKeys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Supabase admin credentials are unavailable to account recovery.");
    return jsonResponse(500, origin, { error: "Account recovery is temporarily unavailable." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const claimId = crypto.randomUUID();
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode);
  const { data: userId, error: claimError } = await admin.rpc("claim_account_recovery_code", {
    p_username: username,
    p_recovery_code_hash: recoveryCodeHash,
    p_claim_id: claimId,
  });

  if (claimError) {
    console.error("Could not validate an account recovery request.", claimError);
    return jsonResponse(500, origin, { error: "Account recovery is temporarily unavailable." });
  }
  if (!userId) {
    return jsonResponse(400, origin, { error: "The username or recovery code is incorrect." });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (updateError) {
    console.error("Could not update the account password.", updateError);
    const { error: releaseError } = await admin.rpc("release_account_recovery_code", {
      p_user_id: userId,
      p_claim_id: claimId,
    });
    if (releaseError) console.error("Could not release the recovery-code claim.", releaseError);
    return jsonResponse(500, origin, { error: "The password could not be changed. Please try again." });
  }

  const nextRecoveryCode = generateRecoveryCode();
  const nextRecoveryCodeHash = await hashRecoveryCode(nextRecoveryCode);
  const { error: rotateError } = await admin.from("account_recovery_keys").upsert({
    user_id: userId,
    recovery_code_hash: nextRecoveryCodeHash,
    claim_id: null,
    claim_expires_at: null,
    created_at: new Date().toISOString(),
  });
  if (rotateError) {
    console.error("Password changed, but the recovery code could not be replaced.", rotateError);
    const { error: releaseError } = await admin.rpc("release_account_recovery_code", {
      p_user_id: userId,
      p_claim_id: claimId,
    });
    if (releaseError) console.error("Could not release the recovery-code claim.", releaseError);
    return jsonResponse(500, origin, {
      error: "The password changed, but the recovery code could not be replaced. Wait a moment and retry using your previous code.",
    });
  }

  return jsonResponse(200, origin, { success: true, recoveryCode: nextRecoveryCode });
});
