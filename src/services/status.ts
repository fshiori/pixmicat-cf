import { PioD1 } from "../db/pio";
import { t } from "../lib/i18n";

export async function renderStatus(env: Env): Promise<Response> {
  const pio = new PioD1(env.DB);
  const posts = await pio.postCount();
  const threads = await pio.threadCount();
  return html(shell(`<div id="banner">[<a href="index.htm?${Date.now()}">${t("return")}</a>] [<a href="pixmicat.php?mode=moduleloaded">${t("module_info_top")}</a>]<div class="bar_admin">${t("info_top")}</div></div>
<div id="status-table" style="text-align: center;">
<table class="admTable">
<thead><tr><td style="text-align:center" colspan="4">${t("info_basic")}</td></tr></thead>
<tbody>
<tr><td style="width: 240px;">${t("info_basic_ver")}</td><td colspan="3"> Pixmicat!-CF 8th.Release.4 </td></tr>
<tr><td>${t("info_basic_pio")}</td><td colspan="3"> D1 : 0.1 </td></tr>
<tr style="text-align:center"><td>${t("info_basic_threadcount")}</td><td colspan="3">${threads} ${t("info_basic_threads")}</td></tr>
<tr style="text-align:center"><td>${t("info_dsusage_count")}</td><td colspan="3">${posts}</td></tr>
</tbody>
</table>
<hr />
</div>`));
}

export function renderModuleLoaded(): Response {
  return html(shell(`<div id="banner">[<a href="index.htm?${Date.now()}">${t("return")}</a>]<div class="bar_admin">${t("module_info_top")}</div></div>
<div id="modules">
${t("module_loaded")}<ul></ul><hr />
${t("module_info")}<ul></ul><hr />
</div>`));
}

function shell(body: string): string {
  return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>Pixmicat!-CF</title><link rel="stylesheet" type="text/css" href="mainstyle.css" /></head><body>${body}</body></html>`;
}

function html(body: string): Response {
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}
