import type { Hono } from "hono";
import type { AppContext } from "../types/env";
import { htmlResponse } from "../lib/html";
import { renderBoardIndex } from "../services/board";
import { renderShell } from "../templates/page";

export function registerPixmicatRoutes(app: Hono<AppContext>): void {
  app.get("/pixmicat.php", async (c) => {
    const mode = c.req.query("mode") || "";
    const pageNum = c.req.query("page_num");
    if (!mode && !c.req.query("res")) {
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
