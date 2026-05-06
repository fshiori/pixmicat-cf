import type { Hono } from "hono";
import type { AppContext } from "../types/env";
import { resolveImageKey } from "../services/image";

export function registerAssetRoutes(app: Hono<AppContext>): void {
  app.get("/src/*", async (c) => {
    const key = resolveImageKey(c.req.path);
    if (!key) return c.notFound();

    const object = await c.env.R2.get(key);
    if (!object) return c.notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    return new Response(object.body, { headers });
  });

  app.get("/thumb/*", async (c) => {
    const key = resolveImageKey(c.req.path);
    if (!key) return c.notFound();

    const object = await c.env.R2.get(key);
    if (!object) return c.notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    return new Response(object.body, { headers });
  });
}
