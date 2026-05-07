export const defaults = {
  title: "Pixmicat!-CF",
  language: "zh_TW"
} as const;

export async function getConfig(env: Env, key: string, fallback: string): Promise<string> {
  const row = await env.DB.prepare("SELECT value FROM configs WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();

  return row?.value ?? fallback;
}

export async function getNumberConfig(env: Env, key: string, fallback: number): Promise<number> {
  const value = await getConfig(env, key, String(fallback));
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
