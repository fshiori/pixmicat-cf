import { PioD1 } from "../db/pio";
import type { ImglogRow } from "../db/schema";
import { postPasswordHash } from "../lib/hash";
import { isAdminAuthenticated } from "./session";

export async function handleUserDelete(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const selected = selectedPostNos(form);
  if (selected.length === 0) return htmlMessage("你真的有要刪除嗎？請回頁面重勾選", 400);

  const pio = new PioD1(env.DB);
  const password = String(form.get("pwd") || getCookie(request, "pwdc") || "");
  const passwordHash = await postPasswordHash(password);
  const admin = await isAdminAuthenticated(request, env);
  const remote = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const posts = await pio.fetchPosts(selected);
  const allowed = posts.filter((post) => admin || post.pwd === passwordHash || post.host === remote).map((post) => post.no);
  if (allowed.length === 0) return htmlMessage("無此文章或是密碼錯誤", 403);

  const filePosts = form.get("onlyimgdel") ? await pio.removeAttachments(allowed) : await pio.removePosts(allowed);
  await deleteR2Files(env, filePosts);
  return htmlMessage("刪除完成", 200);
}

export async function deleteR2Files(env: Env, posts: ImglogRow[]): Promise<void> {
  const keys = new Set<string>();
  for (const post of posts) {
    if (post.ext) keys.add(`${post.tim}${post.ext}`);
    keys.add(`${post.tim}s.jpg`);
  }
  await Promise.all([...keys].map((key) => env.R2.delete(key)));
}

export function selectedPostNos(form: FormData, fieldValue = "delete"): number[] {
  const selected: number[] = [];
  for (const [key, value] of form.entries()) {
    if (value === fieldValue && /^\d+$/.test(key)) selected.push(Number.parseInt(key, 10));
  }
  for (const value of form.getAll("clist[]")) {
    const no = Number.parseInt(String(value), 10);
    if (Number.isFinite(no)) selected.push(no);
  }
  return [...new Set(selected)];
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function htmlMessage(message: string, status: number): Response {
  return new Response(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title></title></head><body><div id="error"><div style="text-align: center; font-size: 1.5em; font-weight: bold;"><span style="color: red;">${message}</span><p /><a href="index.htm">回到版面</a>　<a href="javascript:history.back();">回上頁</a></div><hr /></div></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}
