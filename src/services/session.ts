export const adminSessionPrefix = "session:admin:";

export function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return rawValue.join("=");
  }

  return null;
}

export async function isAdminAuthenticated(request: Request, env: Env): Promise<boolean> {
  const cookie = getCookie(request, "pmc_admin");
  if (!cookie) return false;
  const [sid, signature] = cookie.split(".");
  if (!sid || !signature) return false;
  if ((await sign(sid, env)) !== signature) return false;
  return (await env.KV.get(`${adminSessionPrefix}${sid}`)) === "1";
}

export async function loginAdmin(env: Env): Promise<string> {
  const sid = crypto.randomUUID();
  await env.KV.put(`${adminSessionPrefix}${sid}`, "1", { expirationTtl: 7 * 24 * 3600 });
  return `${sid}.${await sign(sid, env)}`;
}

export async function logoutAdmin(request: Request, env: Env): Promise<void> {
  const cookie = getCookie(request, "pmc_admin");
  const sid = cookie?.split(".")[0];
  if (sid) await env.KV.delete(`${adminSessionPrefix}${sid}`);
}

export async function verifyAdminPassword(input: string, env: Env): Promise<boolean> {
  const adminHash = env.ADMIN_HASH || "";
  if (!adminHash || adminHash === "TO-BE-COMPUTED-BY-GENHASH") return false;
  if (adminHash.startsWith("sha256:")) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    const hex = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `sha256:${hex}` === adminHash;
  }
  return input === adminHash;
}

async function sign(value: string, env: Env): Promise<string> {
  const secret = env.SESSION_SECRET || "local-dev-session-secret";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
