import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://tairusein.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function responseHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function jsonResponse(
  status: number,
  origin: string,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
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
    if (!origin || !allowedOrigins.has(origin)) return new Response("Forbidden", { status: 403 });
    return new Response("ok", { headers: responseHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, origin && allowedOrigins.has(origin) ? origin : "null", { error: "Method not allowed." });
  }
  if (!origin || !allowedOrigins.has(origin)) {
    return jsonResponse(403, "null", { error: "This site is not allowed to create accounts." });
  }

  let payload: { username?: unknown; password?: unknown };
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(400, origin, { error: "Invalid request." });
    }
    payload = body as { username?: unknown; password?: unknown };
  } catch {
    return jsonResponse(400, origin, { error: "Invalid request." });
  }

  const { username, password } = payload;
  if (
    typeof username !== "string"
    || !/^[A-Za-z0-9_]{3,24}$/.test(username)
    || typeof password !== "string"
    || password.length < 8
    || password.length > 72
  ) {
    return jsonResponse(400, origin, { error: "Enter a valid username and a password between 8 and 72 characters." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  let secretKey: string | undefined;
  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    secretKey = secretKeys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  } catch (error) {
    console.error("Could not read Supabase admin credentials.", error);
  }
  if (!supabaseUrl || !secretKey) {
    console.error("Supabase admin credentials are unavailable to account registration.");
    return jsonResponse(500, origin, { error: "Account registration is temporarily unavailable." });
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim()
    || request.headers.get("cf-connecting-ip")
    || "unknown";
  const ipHash = await hash(`${secretKey}:${clientIp}`);
  const { data: allowed, error: rateLimitError } = await admin.rpc("allow_account_signup", {
    p_ip_hash: ipHash,
  });
  if (rateLimitError) {
    console.error("Could not check the account registration rate limit.", rateLimitError);
    return jsonResponse(500, origin, { error: "Account registration is temporarily unavailable." });
  }
  if (!allowed) {
    return jsonResponse(429, origin, { error: "Too many registration attempts from this connection. Try again in an hour." });
  }

  const normalizedUsername = username.toLowerCase();
  const { data: existingProfile, error: profileCheckError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", normalizedUsername)
    .maybeSingle();
  if (profileCheckError) {
    console.error("Could not check the requested username.", profileCheckError);
    return jsonResponse(500, origin, { error: "Account registration is temporarily unavailable." });
  }
  if (existingProfile) {
    return jsonResponse(409, origin, { error: "That username is already taken. Please choose another." });
  }

  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hash(recoveryCode);
  const { data, error: createError } = await admin.auth.admin.createUser({
    email: `${normalizedUsername}@tairusein.github.io`,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (createError) {
    if (createError.code === "email_exists" || createError.code === "user_already_exists") {
      return jsonResponse(409, origin, { error: "That username is already taken. Please choose another." });
    }
    console.error("Could not create the account.", createError);
    return jsonResponse(400, origin, { error: "The account could not be created. Check your username and password and try again." });
  }

  const { error: recoveryError } = await admin.from("account_recovery_keys").insert({
    user_id: data.user.id,
    recovery_code_hash: recoveryCodeHash,
  });
  if (recoveryError) {
    console.error("Could not save the new account recovery code.", recoveryError);
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
    if (deleteError) console.error("Could not remove the incomplete account.", deleteError);
    return jsonResponse(500, origin, { error: "The account could not be safely initialized. Please try again." });
  }

  return jsonResponse(200, origin, { success: true, recoveryCode });
});
