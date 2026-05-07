import type { Hono } from "hono";
import type { AppContext } from "../types/env";
import { htmlResponse } from "../lib/html";
import { renderBoardIndex, renderThreadView } from "../services/board";
import { renderAdmin, handleAdminPost } from "../services/admin";
import { handleUserDelete } from "../services/delete";
import { handleRegist } from "../services/posting";
import { renderCategory, renderSearch } from "../services/search";
import { renderModuleLoaded, renderStatus } from "../services/status";
import { renderShell } from "../templates/page";

export function registerPixmicatRoutes(app: Hono<AppContext>): void {
  app.get("/pixmicat.php", async (c) => {
    const mode = c.req.query("mode") || "";
    const pageNum = c.req.query("page_num");
    const res = c.req.query("res");
    if (!mode && res) {
      const parsedRes = Number.parseInt(res, 10);
      const page = parseThreadPage(pageNum);
      return htmlResponse(await renderThreadView(c.env, { resno: parsedRes, page }));
    }
    if (!mode && !res) {
      const page = pageNum ? Number.parseInt(pageNum, 10) : 0;
      return htmlResponse(await renderBoardIndex(c.env, { page }));
    }
    if (mode === "admin") {
      return renderAdmin(c.req.raw, c.env);
    }
    if (mode === "search") {
      return renderSearch(c.req.raw, c.env);
    }
    if (mode === "category") {
      return renderCategory(c.req.raw, c.env);
    }
    if (mode === "status") {
      return renderStatus(c.env);
    }
    if (mode === "moduleloaded") {
      return renderModuleLoaded();
    }
    if (mode === "module") {
      return new Response("404 Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    if (mode === "remake") {
      return new Response("", { status: 302, headers: { location: `index.htm?${Date.now()}` } });
    }

    return unsupportedMode(c.env, mode || "reply");
  });

  app.post("/pixmicat.php", async (c) => {
    const form = await c.req.raw.clone().formData();
    const mode = String(form.get("mode") ?? "");
    if (mode === "regist") {
      const result = await handleRegist(c.req.raw, c.env);
      return htmlResponse(result.html, { status: result.status, headers: result.headers });
    }
    if (mode === "usrdel") {
      return handleUserDelete(c.req.raw, c.env);
    }
    if (mode === "admin") {
      return handleAdminPost(c.req.raw, c.env);
    }
    if (mode === "search") {
      return renderSearch(c.req.raw, c.env);
    }

    return unsupportedMode(c.env, mode || "post");
  });
}

function parseThreadPage(pageNum: string | undefined): number | "RE_PAGE_MAX" | "all" {
  if (!pageNum) return "RE_PAGE_MAX";
  if (pageNum === "all") return "all";
  const parsed = Number.parseInt(pageNum, 10);
  return Number.isFinite(parsed) ? parsed : "RE_PAGE_MAX";
}

function unsupportedMode(env: Env, mode: string): Response {
  return htmlResponse(
    renderShell(
      env.TITLE || "Pixmicat!-CF",
      `<div id="error"><div style="text-align: center; font-size: 1.5em; font-weight: bold;">
<span style="color: red;">不支援的操作模式：${mode}</span>
</div><hr /></div>`
    ),
    { status: 404 }
  );
}
