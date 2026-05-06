export const defaults = {
  title: "Pixmicat!-PIO",
  language: "zh_TW"
} as const;

export async function getConfig(env: Env, key: string, fallback: string): Promise<string> {
  const row = await env.DB.prepare("SELECT value FROM configs WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();

  return row?.value ?? fallback;
}
