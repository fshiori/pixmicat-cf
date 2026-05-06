import type { Hono } from "hono";
import type { AppContext } from "../types/env";
import { htmlResponse } from "../lib/html";
import { renderBoardIndex } from "../services/board";

export function registerBoardRoutes(app: Hono<AppContext>): void {
  app.get("/", async (c) => htmlResponse(await renderBoardIndex(c.env, { page: 0 })));
  app.get("/index.htm", async (c) => htmlResponse(await renderBoardIndex(c.env, { page: 0 })));
  app.get("/:pageFile", async (c, next) => {
    const pageFile = c.req.param("pageFile");
    if (!/^\d+\.htm$/.test(pageFile)) {
      return next();
    }
    const page = Number.parseInt(pageFile.replace(".htm", ""), 10);
    return htmlResponse(await renderBoardIndex(c.env, { page }));
  });
}
