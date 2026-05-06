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
