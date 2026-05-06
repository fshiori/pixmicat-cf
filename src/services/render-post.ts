import type { ImglogRow } from "../db/schema";
import { t } from "../lib/i18n";
import { parseBlock } from "../templates/pte";
import { r2ImageExists, resolveThumbName } from "./image";

export async function arrangeThread(env: Env, tree: number[], treeCut: number[], posts: ImglogRow[], hiddenReply: number, resno = 0): Promise<string> {
  let html = "";
  const treeSet = new Set(treeCut);
  const treeIndex = new Map<number, number>();
  tree.forEach((no, index) => treeIndex.set(no, index));

  for (let index = 0; index < posts.length; index += 1) {
    const post = posts[index];
    const isReply = index > 0;
    const rendered = await renderPost(env, post, isReply, tree, treeSet, treeIndex, hiddenReply, resno);
    html += rendered;
  }

  html += parseBlock("THREADSEPARATE", resno ? { "{$RESTO}": resno } : {});
  return html;
}

async function renderPost(
  env: Env,
  post: ImglogRow,
  isReply: boolean,
  tree: number[],
  treeSet: Set<number>,
  treeIndex: Map<number, number>,
  hiddenReply: number,
  resno: number
): Promise<string> {
  let name = post.name.replaceAll(`&${t("trip_pre")}`, `&amp;${t("trip_pre")}`);
  if (post.email) {
    name = `<a href="mailto:${post.email}">${name}</a>`;
  }

  let comment = autoLink(post.com);
  comment = quoteLight(comment);
  if (isReply) {
    comment = linkQuotes(comment, tree, treeSet, treeIndex);
  }

  const { imageBar, imageSource } = await renderImage(env, post);
  const category = renderCategory(post.category);
  const quoteButton = renderQuoteButton(post.no, tree[0] ?? post.no, resno, isReply);
  const replyButton = !isReply && !resno ? `[<a href="pixmicat.php?res=${post.no}">${t("reply_btn")}</a>]` : "";
  const warnEndReply = !isReply && post.status.includes("TS") ? `<span class="warn_txt">${t("warn_locked")}</span><br />\n` : "";
  const warnHidePost = !isReply && hiddenReply > 0 ? `<span class="warn_txt2">${t("notice_omitted", hiddenReply)}</span><br />\n` : "";

  const labels = {
    "{$NO}": post.no,
    "{$SUB}": post.sub,
    "{$NAME}": name,
    "{$NOW}": post.now,
    "{$CATEGORY}": category,
    "{$QUOTEBTN}": quoteButton,
    "{$REPLYBTN}": replyButton,
    "{$IMG_BAR}": imageBar,
    "{$IMG_SRC}": imageSource,
    "{$WARN_OLD}": "",
    "{$WARN_BEKILL}": "",
    "{$WARN_ENDREPLY}": warnEndReply,
    "{$WARN_HIDEPOST}": warnHidePost,
    "{$NAME_TEXT}": t("post_name"),
    "{$CATEGORY_TEXT}": t("post_category"),
    "{$SELF}": "pixmicat.php",
    "{$COM}": comment
  };

  return parseBlock(isReply ? "REPLY" : "THREAD", labels);
}

async function renderImage(env: Env, post: ImglogRow): Promise<{ imageBar: string; imageSource: string }> {
  if (!post.ext || !(await r2ImageExists(env, `${post.tim}${post.ext}`))) {
    return { imageBar: "", imageSource: "" };
  }

  const imageUrl = `src/${post.tim}${post.ext}`;
  let imageSource = `<a href="${imageUrl}" target="_blank" rel="nofollow"><img src="nothumb.gif" class="img" alt="${post.imgsize}" title="${post.imgsize}" /></a>`;
  let imageThumb = "";
  const thumbName = await resolveThumbName(env, post.tim);
  if (post.tw && post.th && thumbName) {
    const thumbUrl = `thumb/${thumbName}`;
    imageThumb = `<small>${t("img_sample")}</small>`;
    imageSource = `<a href="${imageUrl}" target="_blank" rel="nofollow"><img src="${thumbUrl}" style="width: ${post.tw}px; height: ${post.th}px;" class="img" alt="${post.imgsize}" title="${post.imgsize}" /></a>`;
  } else if (post.ext === ".swf") {
    imageSource = "";
  }

  const imageWh = post.imgw && post.imgh ? `, ${post.imgw}x${post.imgh}` : "";
  const imageBar = `${t("img_filename")}<a href="${imageUrl}" target="_blank" rel="nofollow">${post.tim}${post.ext}</a>-(${post.imgsize}${imageWh}) ${imageThumb}`;
  return { imageBar, imageSource };
}

function renderQuoteButton(no: number, threadNo: number, resno: number, isReply: boolean): string {
  if (resno) {
    return `<a href="javascript:quote(${no});" class="qlink">No.${no}</a>`;
  }
  if (isReply) {
    return `<a href="pixmicat.php?res=${threadNo}#q${no}" class="qlink">No.${no}</a>`;
  }
  return `<a href="pixmicat.php?res=${threadNo}#q${no}" class="qlink">No.${no}</a>`;
}

function renderCategory(category: string): string {
  return category
    .replaceAll("&#44;", ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<a href="pixmicat.php?mode=category&amp;c=${encodeURIComponent(part)}">${part}</a>`)
    .join(", ");
}

function autoLink(comment: string): string {
  return comment.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="nofollow noreferrer">$1</a>');
}

function quoteLight(comment: string): string {
  return comment.replace(/(^|<br \/>|<br>)(?:((?:&gt;|＞).*?))(?=<br \/>|<br>|$)/gu, '$1<span class="resquote">$2</span>');
}

function linkQuotes(comment: string, tree: number[], treeSet: Set<number>, treeIndex: Map<number, number>): string {
  return comment.replace(/((?:&gt;|＞)+)(?:No\.)?(\d+)/gi, (matched, prefix: string, noText: string) => {
    const no = Number.parseInt(noText, 10);
    if (!treeIndex.has(no)) return matched;
    if (treeSet.has(no)) {
      return `<a class="qlink" href="#r${no}" onclick="replyhl(${no});">${matched}</a>`;
    }
    return `<a class="qlink" href="pixmicat.php?res=${tree[0]}#r${no}">${prefix}${noText}</a>`;
  });
}
