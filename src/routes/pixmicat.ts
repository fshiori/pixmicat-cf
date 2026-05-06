import type { Hono } from "hono";
import type { AppContext } from "../types/env";
import { htmlResponse } from "../lib/html";
import { renderBoardIndex, renderThreadView } from "../services/board";
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

    return htmlResponse(
      renderShell(
        c.env.TITLE || "Pixmicat!-PIO",
        `<div id="error"><div style="text-align: center; font-size: 1.5em; font-weight: bold;">
<span style="color: red;">Mode ${mode || "reply"} is not implemented in scaffold.</span>
</div><hr /></div>`
      ),
      { status: 501 }
    );
  });

  app.post("/pixmicat.php", (c) => {
    return htmlResponse(
      renderShell(
        c.env.TITLE || "Pixmicat!-PIO",
        `<div id="error"><div style="text-align: center; font-size: 1.5em; font-weight: bold;">
<span style="color: red;">Posting routes are not implemented in scaffold.</span>
</div><hr /></div>`
      ),
      { status: 501 }
    );
  });
}

function parseThreadPage(pageNum: string | undefined): number | "RE_PAGE_MAX" | "all" {
  if (!pageNum) return "RE_PAGE_MAX";
  if (pageNum === "all") return "all";
  const parsed = Number.parseInt(pageNum, 10);
  return Number.isFinite(parsed) ? parsed : "RE_PAGE_MAX";
}
