import { getConfig } from "../lib/config";
import { renderShell } from "../templates/page";

export async function renderBoardIndex(env: Env): Promise<string> {
  const title = await getConfig(env, "TITLE", env.TITLE || "Pixmicat!-PIO");
  return renderShell(
    title,
    `<div id="header">
<div id="toplink">[<a href="/pixmicat.php?mode=status">狀態</a>] [<a href="/pixmicat.php?mode=admin">管理</a>]</div>
<br />
<h1>${title}</h1>
<hr class="top" />
</div>
<div id="contents">
<div id="threads" class="autopagerize_page_element">
<p>Pixmicat Cloudflare scaffold is ready.</p>
</div>
</div>`
  );
}
