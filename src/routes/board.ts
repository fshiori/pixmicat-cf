import type { Hono } from "hono";
import type { AppContext } from "../types/env";
import { htmlResponse } from "../lib/html";
import { renderBoardIndex } from "../services/board";

export function registerBoardRoutes(app: Hono<AppContext>): void {
  app.get("/", async (c) => htmlResponse(await renderBoardIndex(c.env)));
  app.get("/index.htm", async (c) => htmlResponse(await renderBoardIndex(c.env)));
}
