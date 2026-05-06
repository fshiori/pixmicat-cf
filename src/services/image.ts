export const imageObjectPrefix = {
  source: "src/",
  thumbnail: "thumb/"
} as const;

export function resolveImageKey(pathname: string): string | null {
  const normalized = pathname.replace(/^\/+/, "");
  if (normalized.startsWith(imageObjectPrefix.source)) {
    return normalized.slice(imageObjectPrefix.source.length);
  }
  if (normalized.startsWith(imageObjectPrefix.thumbnail)) {
    return normalized.slice(imageObjectPrefix.thumbnail.length);
  }
  return null;
}

export async function r2ImageExists(env: Env, key: string): Promise<boolean> {
  return (await env.R2.head(key)) !== null;
}

export async function resolveThumbName(env: Env, tim: string): Promise<string | false> {
  const thumbName = `${tim}s.jpg`;
  return (await r2ImageExists(env, thumbName)) ? thumbName : false;
}
