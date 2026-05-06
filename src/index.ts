import { Hono } from "hono";
import type { AppContext } from "./types/env";
import { registerAssetRoutes } from "./routes/assets";
import { registerBoardRoutes } from "./routes/board";
import { registerPixmicatRoutes } from "./routes/pixmicat";

const app = new Hono<AppContext>();

app.get("/healthz", (c) => c.json({ ok: true, service: "pixmicat-cf" }));

registerAssetRoutes(app);
registerBoardRoutes(app);
registerPixmicatRoutes(app);

app.notFound(async (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
