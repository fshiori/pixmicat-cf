import { PioD1 } from "../db/pio";
import type { ImglogRow } from "../db/schema";
import { getConfig, getNumberConfig } from "../lib/config";
import { t } from "../lib/i18n";
import { parseBlock } from "../templates/pte";
import { arrangeThread } from "./render-post";

type BoardOptions = {
  page: number;
};

type ThreadOptions = {
  resno: number;
  page: number | "RE_PAGE_MAX" | "all";
};

export async function renderBoardIndex(env: Env, options: BoardOptions = { page: 0 }): Promise<string> {
  const pio = new PioD1(env.DB);
  const title = await getConfig(env, "TITLE", env.TITLE || "Pixmicat!-PIO");
  const pageDef = await getNumberConfig(env, "PAGE_DEF", 15);
  const reDef = await getNumberConfig(env, "RE_DEF", 10);
  const threadCount = await pio.threadCount();
  const page = normalizePage(options.page, threadCount, pageDef);
  const threadNos = await pio.fetchThreadList(page * pageDef, pageDef);

  let threads = "";
  for (const threadNo of threadNos) {
    const tree = await pio.fetchPostList(threadNo);
    const replyCount = Math.max(tree.length - 1, 0);
    const replyStart = Math.max(replyCount - reDef + 1, 1);
    const treeCut = [threadNo, ...tree.slice(replyStart, replyStart + reDef)];
    const posts = orderThreadPosts(await pio.fetchPosts(treeCut), treeCut);
    threads += await arrangeThread(env, tree, treeCut, posts, replyStart - 1, 0);
  }

  return renderPage(title, threads, renderPageNav(page, threadCount, pageDef));
}

export async function renderThreadView(env: Env, options: ThreadOptions): Promise<string> {
  const pio = new PioD1(env.DB);
  const title = await getConfig(env, "TITLE", env.TITLE || "Pixmicat!-PIO");
  if (!(await pio.isThread(options.resno))) {
    return renderErrorPage(title, "欲回應之文章並不存在！");
  }

  const tree = await pio.fetchPostList(options.resno);
  const replyCount = Math.max(tree.length - 1, 0);
  const rePageDef = await getNumberConfig(env, "RE_PAGE_DEF", 30);
  const page = normalizeReplyPage(options.page, replyCount, rePageDef);
  const all = options.page === "all";
  const start = all || rePageDef === 0 ? 1 : page * rePageDef + 1;
  const amount = all || rePageDef === 0 ? replyCount : rePageDef;
  const treeCut = [options.resno, ...tree.slice(start, start + amount)];
  const posts = orderThreadPosts(await pio.fetchPosts(treeCut), treeCut);
  const threads = await arrangeThread(env, tree, treeCut, posts, 0, options.resno);

  return renderPage(title, threads, renderReplyPageNav(options.resno, page, replyCount, rePageDef, all), options.resno);
}

function renderPage(title: string, threads: string, pageNav: string, resno = 0): string {
  let html = "";
  const baseLabels = {
    "{$TITLE}": title,
    "{$RESTO}": "",
    "{$ALLOW_UPLOAD_EXT}": "GIF|JPG|JPEG|PNG|BMP|SWF",
    "{$JS_REGIST_WITHOUTCOMMENT}": t("regist_withoutcomment").replaceAll("'", "\\'"),
    "{$JS_REGIST_UPLOAD_NOTSUPPORT}": t("regist_upload_notsupport").replaceAll("'", "\\'"),
    "{$JS_CONVERT_SAKURA}": t("js_convert_sakura").replaceAll("'", "\\'"),
    "{$TOP_LINKS}": "",
    "{$HOME}": `[<a href="../" target="_top">${t("head_home")}</a>]`,
    "{$STATUS}": `[<a href="pixmicat.php?mode=status">${t("head_info")}</a>]`,
    "{$ADMIN}": `[<a href="pixmicat.php?mode=admin">${t("head_admin")}</a>]`,
    "{$REFRESH}": `[<a href="index.htm?">${t("head_refresh")}</a>]`,
    "{$SEARCH}": `[<a href="pixmicat.php?mode=search">${t("head_search")}</a>]`,
    "{$HOOKLINKS}": ""
  };

  html += parseBlock("HEADER", baseLabels);
  html += parseBlock("JSHEADER", baseLabels);
  html += "</head>";
  html += parseBlock("BODYHEAD", baseLabels);
  html += renderPostForm(resno);
  html += parseBlock("MAIN", {
    "{$THREADFRONT}": "",
    "{$THREADREAR}": "",
    "{$SELF}": "pixmicat.php",
    "{$THREADS}": threads,
    "{$PAGENAV}": pageNav,
    "{$DEL_HEAD_TEXT}": `<input type="hidden" name="mode" value="usrdel" />${t("del_head")}`,
    "{$DEL_IMG_ONLY_FIELD}": '<input type="checkbox" name="onlyimgdel" id="onlyimgdel" value="on" />',
    "{$DEL_IMG_ONLY_TEXT}": t("del_img_only"),
    "{$DEL_PASS_TEXT}": t("del_pass"),
    "{$DEL_PASS_FIELD}": '<input type="password" name="pwd" size="8" value="" />',
    "{$DEL_SUBMIT_BTN}": `<input type="submit" value="${t("del_btn")}" />`
  });
  html += parseBlock("FOOTER", {
    "{$FOOTER}":
      '<!-- GazouBBS v3.0 --><!-- ふたば改0.8 --><!-- Pixmicat! --><small>- <a rel="nofollow noreferrer license" href="http://php.s3.to" target="_blank">GazouBBS</a> + <a rel="nofollow noreferrer license" href="http://www.2chan.net/" target="_blank">futaba</a> + <a rel="nofollow noreferrer license" href="http://pixmicat.openfoundry.org/" target="_blank">Pixmicat!</a> -</small>'
  });
  return html;
}

function renderPostForm(resno = 0): string {
  const inputMax = 100;
  const commMax = 2000;
  const maxKb = 2000;
  return parseBlock("POSTFORM", {
    "{$SELF}": "pixmicat.php",
    "{$FORMTOP}": resno
      ? `[<a href="index.htm?${Date.now()}">${t("return")}</a>]<div class="bar_reply">回應模式</div>`
      : `\n[<span id="show" class="hide" onmouseover="showform();" onclick="showform();">${t("form_showpostform")}</span><span id="hide" class="show" onmouseover="hideform();" onclick="hideform();">${t("form_hidepostform")}</span>]`,
    "{$MODE}": "regist",
    "{$MAX_FILE_SIZE}": maxKb * 1024,
    "{$RESTO}": resno ? `<input type="hidden" name="resto" value="${resno}" />` : "",
    "{$FORM_NAME_TEXT}": t("form_name"),
    "{$FORM_NAME_FIELD}": `<input class="hide" type="text" name="name" value="spammer" /><input maxlength="${inputMax}" type="text" name="bvUFbdrIC" id="fname" size="28" value="" />`,
    "{$FORM_EMAIL_TEXT}": t("form_email"),
    "{$FORM_EMAIL_FIELD}": `<input maxlength="${inputMax}" type="text" name="ObHGyhdTR" id="femail" size="28" value="" /><input type="text" class="hide" name="email" value="foo@foo.bar" />`,
    "{$FORM_TOPIC_TEXT}": t("form_topic"),
    "{$FORM_TOPIC_FIELD}": `<input class="hide" value="DO NOT FIX THIS" type="text" name="sub" /><input maxlength="${inputMax}"  type="text" name="SJBgiFbhj" id="fsub" size="28" value="" />`,
    "{$FORM_SUBMIT}": `<input type="submit" name="sendbtn" value="${t("form_submit_btn")}" />`,
    "{$FORM_COMMENT_TEXT}": t("form_comment"),
    "{$FORM_COMMENT_FIELD}": `<textarea maxlength="${commMax}" name="pOBvrtyJK" id="fcom" cols="48" rows="4" style="width: 400px; height: 80px;"></textarea><textarea name="com" class="hide" cols="48" rows="4">EID OG SMAPS</textarea>`,
    "{$FORM_ATTECHMENT_TEXT}": t("form_attechment"),
    "{$FORM_ATTECHMENT_FIELD}": '<input type="file" name="upfile" id="fupfile"/><input class="hide" type="checkbox" name="reply" value="yes" />',
    "{$FORM_NOATTECHMENT_TEXT}": t("form_noattechment"),
    "{$FORM_NOATTECHMENT_FIELD}": '<input type="checkbox" name="noimg" id="noimg" value="on" />',
    "{$FORM_CONTPOST_FIELD}": '<input type="checkbox" name="up_series" id="up_series" value="on" />',
    "{$FORM_CONTPOST_TEXT}": t("form_contpost"),
    "{$FORM_CATEGORY_FIELD}": '<input type="text" name="category" size="28" value="" />',
    "{$FORM_CATEGORY_TEXT}": t("form_category"),
    "{$FORM_CATEGORY_NOTICE}": t("form_category_notice"),
    "{$FORM_DELETE_PASSWORD_FIELD}": '<input type="password" name="pwd" size="8" maxlength="8" value="" />',
    "{$FORM_DELETE_PASSWORD_TEXT}": t("form_delete_password"),
    "{$FORM_DELETE_PASSWORD_NOTICE}": t("form_delete_password_notice"),
    "{$FORM_EXTRA_COLUMN}": "",
    "{$FORM_NOTICE}": t("form_notice", "GIF, JPG, JPEG, PNG, BMP, SWF", maxKb, 250, 250),
    "{$FORM_NOTICE_STORAGE_LIMIT}": t("form_notice_storage_limit", 0, 30000),
    "{$HOOKPOSTINFO}": "",
    "{$ADDITION_INFO}": "",
    "{$FORM_NOTICE_NOSCRIPT}": t("form_notice_noscript"),
    "{$FORMBOTTOM}": resno ? "" : '<script type="text/javascript">hideform();</script>'
  });
}

function renderReplyPageNav(resno: number, page: number, replyCount: number, rePageDef: number, all: boolean): string {
  let nav = '<div id="page_switch">';
  if (rePageDef > 0) {
    const prev = page - 1;
    const next = page + 1;
    nav += '<table style="border: 1px solid gray" ><tr><td style="white-space: nowrap;">';
    nav += prev >= 0 ? `<a rel="prev" href="pixmicat.php?res=${resno}&amp;page_num=${prev}">${t("prev_page")}</a>` : t("first_page");
    nav += "</td><td>";
    if (replyCount === 0) {
      nav += "[<b>0</b>] ";
    } else {
      const len = Math.ceil(replyCount / rePageDef);
      for (let i = 0; i < len; i += 1) {
        nav += !all && page === i ? `[<b>${i}</b>] ` : `[<a href="pixmicat.php?res=${resno}&amp;page_num=${i}">${i}</a>] `;
      }
      nav += all ? "[<b>ALL</b>] " : replyCount > rePageDef ? `[<a href="pixmicat.php?res=${resno}&amp;page_num=all">ALL</a>] ` : "";
    }
    nav += '</td><td style="white-space: nowrap;">';
    nav += !all && replyCount > next * rePageDef ? `<a href="pixmicat.php?res=${resno}&amp;page_num=${next}">${t("next_page")}</a>` : t("last_page");
    nav += "</td></tr></table>\n";
  }
  nav += '<br style="clear: left;" />\n</div>';
  return nav;
}

function renderPageNav(page: number, threadCount: number, pageDef: number): string {
  const pageMax = Math.max(Math.ceil(threadCount / pageDef) - 1, 0);
  const prev = page - 1;
  const next = page + 1;
  let nav = '<div id="page_switch"><table style="border: 1px solid gray" ><tr>';
  if (prev >= 0) {
    nav += `<td><form action="${prev === 0 ? "index.htm" : `${prev}.htm`}" method="get"><div><input type="submit" value="${t("prev_page")}" /></div></form></td>`;
  } else {
    nav += `<td style="white-space: nowrap;">${t("first_page")}</td>`;
  }
  nav += "<td>";
  for (let i = 0; i <= pageMax; i += 1) {
    if (page === i) nav += `[<b>${i}</b>] `;
    else nav += i === 0 ? `[<a href="index.htm?">0</a>] ` : `[<a href="${i}.htm?">${i}</a>] `;
  }
  nav += "</td>";
  if (threadCount > next * pageDef) {
    nav += `<td><form action="${next}.htm" method="get"><div><input type="submit" value="${t("next_page")}" /></div></form></td>`;
  } else {
    nav += `<td style="white-space: nowrap;">${t("last_page")}</td>`;
  }
  nav += '</tr></table>\n<br style="clear: left;" />\n</div>';
  return nav;
}

function normalizePage(page: number, threadCount: number, pageDef: number): number {
  if (page < 0) return 0;
  if (threadCount === 0) return 0;
  const maxPage = Math.max(Math.ceil(threadCount / pageDef) - 1, 0);
  return Math.min(page, maxPage);
}

function normalizeReplyPage(page: ThreadOptions["page"], replyCount: number, rePageDef: number): number {
  if (page === "all" || rePageDef === 0) return 0;
  const maxPage = Math.max(Math.ceil(replyCount / rePageDef) - 1, 0);
  if (page === "RE_PAGE_MAX") return maxPage;
  if (page < 0) return 0;
  return Math.min(page, maxPage);
}

function renderErrorPage(title: string, message: string): string {
  return `${parseBlock("HEADER", { "{$TITLE}": title })}</head><body><div id="error"><div style="text-align: center; font-size: 1.5em; font-weight: bold;"><span style="color: red;">${message}</span><p /><a href="index.htm">${t("return")}</a></div><hr /></div></body></html>`;
}

function orderThreadPosts(posts: ImglogRow[], treeCut: number[]): ImglogRow[] {
  const byNo = new Map(posts.map((post) => [post.no, post]));
  return treeCut.map((no) => byNo.get(no)).filter((post): post is ImglogRow => Boolean(post));
}
