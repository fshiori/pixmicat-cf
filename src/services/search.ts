import { PioD1 } from "../db/pio";
import type { ImglogRow } from "../db/schema";
import { cleanStr } from "../lib/html";
import { t } from "../lib/i18n";

export async function renderSearch(request: Request, env: Env): Promise<Response> {
  const form = request.method === "POST" ? await request.formData() : null;
  const keyword = cleanStr(String(form?.get("keyword") || ""));
  if (!keyword) return html(shell(searchForm()));

  const field = normalizeField(String(form?.get("field") || "com"));
  const method = String(form?.get("method") || "AND") === "OR" ? "OR" : "AND";
  const keywords = keyword.split(/(　| )+/).map((part) => part.trim()).filter(Boolean);
  const posts = await new PioD1(env.DB).searchPost(keywords, field, method);
  return html(shell(`<div id="search_result">${posts.length ? posts.map(renderSearchResult).join("") : `<div style="text-align: center">${t("search_notfound")}<br/><a href="?mode=search">${t("search_back")}</a></div>`}</div>`));
}

export async function renderCategory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const category = cleanStr((url.searchParams.get("c") || "").toLowerCase());
  if (!category) return html(shell(`<div style="text-align:center;color:red;">${t("category_nokeyword")}</div>`), 400);
  const posts = await new PioD1(env.DB).searchCategory(category);
  return html(shell(`<div>[<a href="index.htm?${Date.now()}">${t("return")}</a>][<a href="pixmicat.php?mode=category&amp;c=${encodeURIComponent(category)}&amp;recache=1">${t("category_recache")}</a>]</div>
${posts.length ? posts.map(renderSearchResult).join("") : `<div style="text-align:center;">${t("category_notfound")}</div>`}`));
}

function searchForm(): string {
  return `<div id="banner">[<a href="index.htm?${Date.now()}">${t("return")}</a>]<div class="bar_admin">${t("search_top")}</div></div>
<form action="pixmicat.php" method="post">
<div id="search">
<input type="hidden" name="mode" value="search" />
<ul>${t("search_notice")}<input type="text" name="keyword" size="30" />
${t("search_target")}<select name="field"><option value="com" selected="selected">${t("search_target_comment")}</option><option value="name">${t("search_target_name")}</option><option value="sub">${t("search_target_topic")}</option><option value="no">${t("search_target_number")}</option></select>
${t("search_method")}<select name="method"><option value="AND" selected="selected">${t("search_method_and")}</option><option value="OR">${t("search_method_or")}</option></select>
<input type="submit" value="${t("search_submit_btn")}" />
</li>
</ul>
</div>
</form>`;
}

function renderSearchResult(post: ImglogRow): string {
  const category = post.category
    .replaceAll("&#44;", ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<a href="pixmicat.php?mode=category&amp;c=${encodeURIComponent(part)}">${part}</a>`)
    .join(", ");
  const no = `<a href="pixmicat.php?res=${post.resto ? `${post.resto}#r${post.no}` : post.no}">${post.no}</a>`;
  return `<div class="threadpost">
<span class="title">${post.sub}</span>
${t("post_name")}<span class="name">${post.name}</span> [${post.now}] No.${no}
<div class="quote">${post.com}</div>
${category ? `<div class="category">${t("post_category")}${category}</div>` : ""}
</div>
<hr />`;
}

function normalizeField(field: string): "com" | "name" | "sub" | "no" {
  return field === "name" || field === "sub" || field === "no" ? field : "com";
}

function shell(body: string): string {
  return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>Pixmicat!-PIO</title><link rel="stylesheet" type="text/css" href="mainstyle.css" /></head><body>${body}</body></html>`;
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}
