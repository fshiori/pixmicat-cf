import { PioD1 } from "../db/pio";
import { t } from "../lib/i18n";
import { deleteR2Files, htmlMessage, selectedPostNos } from "./delete";
import { isAdminAuthenticated, loginAdmin, logoutAdmin, verifyAdminPassword } from "./session";

export async function renderAdmin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("admin") === "logout") {
    await logoutAdmin(request, env);
    return redirect("index.htm");
  }

  const authenticated = await isAdminAuthenticated(request, env);
  if (!authenticated) return html(adminLoginPage());
  if (url.searchParams.get("admin") === "del") return html(await adminDeletePage(env));
  if (["optimize", "check", "repair", "export"].includes(url.searchParams.get("admin") || "")) {
    return html(adminUnsupportedMaintenancePage());
  }
  return html(adminMenuPage());
}

export async function handleAdminPost(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const adminMode = String(form.get("admin") || "");
  const authenticated = await isAdminAuthenticated(request, env);

  if (!authenticated) {
    const pass = String(form.get("pass") || "");
    if (!(await verifyAdminPassword(pass, env))) return htmlMessage("密碼錯誤", 403);
    const cookie = await loginAdmin(env);
    return html(adminMenuPage(), { "set-cookie": `pmc_admin=${cookie}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax` });
  }

  if (adminMode === "del") {
    const selected = selectedPostNos(form);
    const stopSelected = selectedThreadStopNos(form);
    if (selected.length > 0 && form.get("func") === "delete") {
      const pio = new PioD1(env.DB);
      const filePosts = form.get("onlyimgdel") === "on" ? await pio.removeAttachments(selected, true) : await pio.removePosts(selected);
      await deleteR2Files(env, filePosts);
    }
    if (stopSelected.length > 0) {
      const pio = new PioD1(env.DB);
      await Promise.all(stopSelected.map((no) => pio.toggleThreadStop(no)));
    }
    return html(await adminDeletePage(env));
  }
  if (["optimize", "check", "repair", "export"].includes(adminMode)) {
    return html(adminUnsupportedMaintenancePage());
  }

  return html(adminMenuPage());
}

async function adminDeletePage(env: Env): Promise<string> {
  const pio = new PioD1(env.DB);
  const postNos = await pio.fetchThreadList(0, 20, true);
  const posts = await pio.fetchPosts(postNos);
  const rows = posts
    .map((post, index) => {
      const bg = index % 2 ? "ListRow1_bg" : "ListRow2_bg";
      const threadStop = post.resto === 0 ? `<input type="checkbox" name="stop[]" value="${post.no}" />${post.status.split(",").includes("TS") ? t("admin_stop_btn") : ""}` : " ";
      return `<tr class="${bg}" align="left"><th style="text-align:center"> </th><th style="text-align:center">${threadStop}</th><th><input type="checkbox" name="clist[]" value="${post.no}" />${post.no}</th><td><small>${post.now}</small></td><td>${post.sub}</td><td><b>${post.name}</b></td><td><small>${post.com}</small></td><td>${post.host}</td><td style="text-align:center">${post.ext ? `${post.tim}${post.ext}` : "--"}<br />${post.md5chksum || "--"}</td></tr>`;
    })
    .join("\n");

  return shell(`<div id="banner">[<a href="index.htm?${Date.now()}">${t("return")}</a>] [<a href="pixmicat.php?mode=admin&amp;admin=logout">${t("admin_logout")}</a>]<div class="bar_admin">${t("admin_top")}</div></div>
<form action="pixmicat.php" method="post">
<input type="hidden" name="mode" value="admin" />
<input type="hidden" name="admin" value="del" />
<div style="text-align: left;">${t("admin_notices")}</div>
<table class="html5Table">
<tr style="background-color: #6080f6;">${t("admin_list_header")}</tr>
${rows}
</table>
<p><select name="func"><option value="delete">${t("admin_delete")}</option></select>
<input type="submit" value="${t("admin_submit_btn")}" /> <input type="reset" value="${t("admin_reset_btn")}" /> [<input type="checkbox" name="onlyimgdel" id="onlyimgdel" value="on" /><label for="onlyimgdel">${t("del_img_only")}</label>]</p>
</form><hr />`);
}

function adminLoginPage(): string {
  return shell(`<div id="banner">[<a href="index.htm?${Date.now()}">${t("return")}</a>]<div class="bar_admin">${t("admin_top")}</div></div>
<form action="pixmicat.php" method="post" name="adminform">
<div id="admin-check" style="text-align: center;">
<br />
<input type="radio" name="admin" value="del" checked="checked" />${t("admin_manageposts")}
<input type="hidden" name="mode" value="admin" />
<input type="password" name="pass" size="8" />
<input type="submit" value="${t("admin_verify_btn")}" />
</div>
</form>`);
}

function adminMenuPage(): string {
  return shell(`<div id="banner">[<a href="index.htm?${Date.now()}">${t("return")}</a>] [<a href="pixmicat.php?mode=admin&amp;admin=logout">${t("admin_logout")}</a>]<div class="bar_admin">${t("admin_top")}</div></div>
<form action="pixmicat.php" method="post" name="adminform">
<div id="admin-check" style="text-align: center;">
<br />
<input type="radio" name="admin" value="del" checked="checked" />${t("admin_manageposts")}
<input type="hidden" name="mode" value="admin" />
<input type="submit" value="${t("admin_submit_btn")}" />
</div>
</form>`);
}

function adminUnsupportedMaintenancePage(): string {
  return shell(`<div id="banner">[<a href="index.htm?${Date.now()}">${t("return")}</a>] [<a href="pixmicat.php?mode=admin&amp;admin=logout">${t("admin_logout")}</a>]<div class="bar_admin">${t("admin_top")}</div></div>
<div id="admin-check" style="text-align: center;">
<br />
D1 maintenance action is not supported in this runtime.
</div>`);
}

function shell(body: string): string {
  return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>Pixmicat!-PIO</title><link rel="stylesheet" type="text/css" href="mainstyle.css" /></head><body>${body}</body></html>`;
}

function html(body: string, headers?: HeadersInit): Response {
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", ...headers } });
}

function redirect(location: string): Response {
  return new Response("", { status: 302, headers: { location, "set-cookie": "pmc_admin=; Max-Age=0; Path=/; SameSite=Lax" } });
}

function selectedThreadStopNos(form: FormData): number[] {
  return form.getAll("stop[]")
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isFinite(value));
}
