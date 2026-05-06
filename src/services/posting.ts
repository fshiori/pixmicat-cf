import { PioD1 } from "../db/pio";
import { getConfig, getNumberConfig } from "../lib/config";
import { cleanStr, escapeHtml } from "../lib/html";
import { md5Hex, postPasswordHash } from "../lib/hash";
import { t } from "../lib/i18n";
import { getCookie } from "./session";
import { decodeImage, encodeJpeg, resizeNearest } from "./thumbnail";
import unixCrypt from "unix-crypt-td-js";

type PostResult = {
  html: string;
  status: number;
  headers?: HeadersInit;
};

type ImageInfo = {
  tim: string;
  ext: string;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
  sizeText: string;
  md5: string;
};

type UploadFile = {
  size: number;
  name: string;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

export async function handleRegist(request: Request, env: Env): Promise<PostResult> {
  if (request.method !== "POST") return error("請使用此版提供的表單來上傳", 405);

  const form = await request.formData();
  if (
    form.get("name") !== "spammer" ||
    form.get("email") !== "foo@foo.bar" ||
    form.get("sub") !== "DO NOT FIX THIS" ||
    form.get("com") !== "EID OG SMAPS" ||
    (form.get("reply") ?? "") !== ""
  ) {
    return error("防止 Spambot 機制啟動！", 400);
  }

  const pio = new PioD1(env.DB);
  const inputMax = await getNumberConfig(env, "INPUT_MAX", 100);
  const commMax = await getNumberConfig(env, "COMM_MAX", 2000);
  const maxKb = await getNumberConfig(env, "MAX_KB", 2000);
  const defaultName = await getConfig(env, "DEFAULT_NONAME", "無名氏");
  const defaultTitle = await getConfig(env, "DEFAULT_NOTITLE", "無標題");
  const defaultComment = await getConfig(env, "DEFAULT_NOCOMMENT", "無內文");
  const allowExt = (await getConfig(env, "ALLOW_UPLOAD_EXT", "GIF|JPG|JPEG|PNG|BMP|SWF")).toLowerCase().split("|");
  const badStrings = await loadBanPatterns(env, ["BAD_STRING", "bad_string"]);

  let name = cleanStr(String(form.get("bvUFbdrIC") ?? ""));
  let email = cleanStr(String(form.get("ObHGyhdTR") ?? ""));
  let sub = cleanStr(String(form.get("SJBgiFbhj") ?? ""));
  let com = String(form.get("pOBvrtyJK") ?? "");
  const categoryInput = cleanStr(String(form.get("category") ?? ""));
  const resto = Number.parseInt(String(form.get("resto") ?? "0"), 10) || 0;
  const password = String(form.get("pwd") ?? "");
  const effectivePassword = password || randomPassword();
  const file = form.get("upfile");
  const uploadFile = isFileLike(file) && file.size > 0 ? file : null;

  if (hasBannedWord(badStrings, [name, email, sub, com])) return error("發出的文章中有被管理員列為限制的字句，送出失敗", 400);
  if (name.length > inputMax) return error("名稱過長", 400);
  if (email.length > inputMax) return error("E-mail過長", 400);
  if (sub.length > inputMax) return error("標題過長", 400);
  if (com.length > commMax) return error("內文過長", 400);
  if (resto && !(await pio.isThread(resto))) return error("欲回應之文章並不存在！", 404);
  if (resto && (await pio.isThreadLocked(resto))) return error("這篇討論串已被管理員標記為禁止回應！", 403);

  const hasUpload = uploadFile !== null;
  if (!resto && !hasUpload && !form.get("noimg")) {
    return error("因應防止Spam對策，發文無附加圖檔請勾選[無貼圖]核選框！", 400);
  }
  if (!com && !hasUpload) return error("在沒有附加圖檔的情況下，請寫入內文", 400);

  const identity = await applyNameIdentity(env, name, email);
  name = identity.name || defaultName;
  email = identity.email;
  sub = sub || defaultTitle;
  com = normalizeComment(com || defaultComment);
  const category = categoryInput ? `,${categoryInput.split(",").map((part) => part.trim()).join(",")},` : "";
  const pass = await postPasswordHash(effectivePassword);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tim = `${nowSeconds}${String(Date.now()).slice(-3)}`;
  const remote = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const now = await formatNow(env, nowSeconds, remote);
  const passCookie = await postPasswordHash(getCookie(request, "pwdc") || "");
  const renzoku = await getNumberConfig(env, "RENZOKU", 60);
  const renzokuImage = await getNumberConfig(env, "RENZOKU2", 60);
  if (await pio.isSuccessivePost(nowSeconds, com, pass, passCookie, remote, hasUpload, renzoku, renzokuImage)) {
    return error("連續投稿請稍候一段時間", 400);
  }

  let image: ImageInfo = { tim, ext: "", width: 0, height: 0, thumbWidth: 0, thumbHeight: 0, sizeText: "", md5: "" };

  if (hasUpload) {
    if (uploadFile.size > maxKb * 1024) return error("上傳失敗<br />上傳的附加圖檔容量超過上傳容量限制", 400);
    try {
      image = await validateAndStoreImage(env, pio, uploadFile, tim, allowExt, resto > 0);
    } catch (err) {
      return error(err instanceof Error ? err.message : "附加圖檔為系統不支援的格式", 400);
    }
  }

  const age = resto > 0 && !email.toLowerCase().includes("sage");
  const newNo = await pio.addPost({
    resto,
    root: resto ? "0" : utcDateTime(nowSeconds),
    time: nowSeconds,
    md5chksum: image.md5,
    category,
    tim,
    ext: image.ext,
    imgw: image.width,
    imgh: image.height,
    imgsize: image.sizeText,
    tw: image.thumbWidth,
    th: image.thumbHeight,
    pwd: pass,
    now,
    name,
    email,
    sub,
    com,
    host: remote,
    status: ""
  }, age);

  const redirectUrl = form.get("up_series")
    ? `pixmicat.php?res=${resto || newNo}&amp;upseries=1`
    : `index.htm?${tim}`;
  return redirect(redirectUrl, uploadFile ? `附加圖檔 ${escapeHtml(uploadFile.name)} 上傳完畢<br />` : "", effectivePassword, email);
}

function isFileLike(value: unknown): value is UploadFile {
  return typeof value === "object" && value !== null && "size" in value && "name" in value && "arrayBuffer" in value;
}

async function validateAndStoreImage(env: Env, pio: PioD1, file: UploadFile, tim: string, allowExt: string[], isReply: boolean): Promise<ImageInfo> {
  const buffer = await file.arrayBuffer();
  const info = readImageInfo(buffer, file.name);
  if (!allowExt.includes(info.ext.slice(1).toLowerCase())) {
    throw new Error("附加圖檔為系統不支援的格式");
  }
  const md5 = await md5Hex(buffer);
  const badFileMd5 = await loadBanPatterns(env, ["BAD_FILEMD5", "bad_filemd5"]);
  if (badFileMd5.includes(md5)) throw new Error("上傳失敗<br />此附加圖檔被管理員列為禁止上傳");
  if (await pio.isDuplicateAttachment(env, md5)) throw new Error("上傳失敗<br />近期已經有相同的附加圖檔");

  await env.R2.put(`${tim}${info.ext}`, buffer, {
    httpMetadata: { contentType: file.type || mimeFromExt(info.ext) }
  });
  const thumbSize = calculateThumbSize(info.width, info.height, isReply);
  if (thumbSize.width > 0 && thumbSize.height > 0 && info.ext !== ".swf") {
    const decoded = decodeImage(buffer, info.ext);
    const resized = resizeNearest(decoded, thumbSize.width, thumbSize.height);
    const jpegThumb = encodeJpeg(resized, 75);
    await env.R2.put(`${tim}s.jpg`, jpegThumb, {
      httpMetadata: { contentType: "image/jpeg" }
    });
  }
  return {
    tim,
    ext: info.ext,
    width: info.width,
    height: info.height,
    sizeText: formatFileSize(file.size),
    md5,
    thumbWidth: thumbSize.width,
    thumbHeight: thumbSize.height
  };
}

async function loadBanPatterns(env: Env, types: string[]): Promise<string[]> {
  const placeholders = types.map(() => "?").join(",");
  const result = await env.DB.prepare(`SELECT pattern FROM banlist WHERE type IN (${placeholders}) AND (expires_at = 0 OR expires_at > unixepoch())`).bind(...types).all<{ pattern: string }>();
  return result.results.map((row) => row.pattern).filter(Boolean);
}

function hasBannedWord(patterns: string[], values: string[]): boolean {
  return patterns.some((pattern) => values.some((value) => value.includes(pattern)));
}

function calculateThumbSize(width: number, height: number, isReply: boolean): { width: number; height: number } {
  if (!width || !height) return { width: 0, height: 0 };
  const maxWidth = isReply ? 125 : 250;
  const maxHeight = isReply ? 125 : 250;
  if (width <= maxWidth && height <= maxHeight) return { width, height };
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.ceil(width * ratio), height: Math.ceil(height * ratio) };
}

function readImageInfo(buffer: ArrayBuffer, filename: string): { ext: string; width: number; height: number } {
  const view = new DataView(buffer);
  if (view.byteLength >= 10 && view.getUint16(0) === 0x4749) {
    return { ext: ".gif", width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (view.byteLength >= 24 && view.getUint32(0) === 0x89504e47) {
    return { ext: ".png", width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (view.byteLength >= 26 && view.getUint16(0, false) === 0x424d) {
    return { ext: ".bmp", width: view.getInt32(18, true), height: Math.abs(view.getInt32(22, true)) };
  }
  if (view.byteLength >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const length = view.getUint16(offset + 2);
      if (marker === 0xc0 || marker === 0xc2) {
        return { ext: ".jpg", width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  if (filename.toLowerCase().endsWith(".swf")) return { ext: ".swf", width: 0, height: 0 };
  throw new Error("上傳失敗<br />不接受圖片以外的檔案");
}

function normalizeComment(comment: string): string {
  return escapeHtml(comment)
    .replace(/\r\n|\r/g, "\n")
    .replace(/\n((　| )*\n){3,}/g, "\n")
    .replaceAll("\n", "<br />");
}

async function applyNameIdentity(env: Env, rawName: string, rawEmail: string): Promise<{ name: string; email: string; isAdmin: boolean }> {
  const tripPre = t("trip_pre");
  const tripPreFake = t("trip_pre_fake");
  const capCharFake = t("cap_char_fake");
  const capSuffix = await getConfig(env, "CAP_SUFFIX", " ★");
  let name = rawName.replaceAll(tripPre, tripPreFake).replaceAll(capSuffix, capCharFake).replace(/\r\n|\r|\n/g, "");
  let email = rawEmail.replace(/\r\n|\r|\n/g, "");
  let nameOri = name;
  let isAdmin = false;

  const tripMatch = /(.*?)[#＃](.*)/u.exec(name);
  if (tripMatch) {
    name = nameOri = tripMatch[1];
    const tripKey = tripMatch[2].replaceAll("&amp;", "&");
    const salt = (tripKey + "H.")
      .slice(1, 3)
      .replace(/[^\.-z]/g, ".")
      .replace(/[:;<=>?@[\\\]^_`]/g, (char) => "ABCDEFGabcdef"[":;<=>?@[\\]^_`".indexOf(char)] ?? ".");
    name = `${name}${tripPre}${unixCrypt(tripKey, salt).slice(-10)}`;
  }

  const capEnabled = await getNumberConfig(env, "CAP_ENABLE", 1);
  const capMatch = /(.*?)[#＃](.*)/u.exec(email);
  if (capEnabled && capMatch) {
    const capName = await getConfig(env, "CAP_NAME", "futaba");
    const capPass = await getConfig(env, "CAP_PASS", "futaba");
    const capPassword = capMatch[2].replaceAll("&amp;", "&");
    if (nameOri === capName && capPassword === capPass) {
      name = `<span class="admin_cap">${name}${capSuffix}</span>`;
      email = capMatch[1];
      isAdmin = true;
    }
  }

  if (!isAdmin) {
    name = name.replaceAll(t("admin"), `"${t("admin")}"`).replaceAll(t("deletor"), `"${t("deletor")}"`);
  }
  name = name.replaceAll(`&${tripPre}`, `&amp;${tripPre}`);
  return { name, email, isAdmin };
}

async function formatNow(env: Env, seconds: number, remote: string): Promise<string> {
  const offset = Number.parseInt(await getConfig(env, "TIME_ZONE", "+8"), 10) || 0;
  const date = new Date((seconds + offset * 3600) * 1000);
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const id = (await md5Hex(`${remote}${date.getUTCFullYear()}${mm}${dd}`)).slice(0, 8);
  return `${yy}/${mm}/${dd}(${weekdays[date.getUTCDay()]})${hh}:${mi} ID:${id}`;
}

function utcDateTime(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 19).replace("T", " ");
}

function formatFileSize(bytes: number): string {
  return bytes >= 1024 ? `${Math.floor(bytes / 1024)} KB` : `${bytes} B`;
}

function mimeFromExt(ext: string): string {
  if (ext === ".jpg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";
  return "application/octet-stream";
}

function randomPassword(): string {
  return String(Math.floor(Math.random() * 100000000)).slice(0, 8);
}

function redirect(url: string, message: string, password: string, email: string): PostResult {
  const jsUrl = url.replaceAll("&amp;", "&");
  const headers = new Headers();
  headers.append("set-cookie", `pwdc=${encodeURIComponent(password)}; Max-Age=604800; Path=/; SameSite=Lax`);
  headers.append("set-cookie", `emailc=${encodeURIComponent(email)}; Max-Age=604800; Path=/; SameSite=Lax`);
  return {
    status: 200,
    headers,
    html: `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<title></title>
<meta http-equiv="Refresh" content="1;URL=${url}" />
<script type="text/javascript">
// <![CDATA[
function redir(){
	location.href = "${jsUrl}";
}
setTimeout("redir()", 1000);
// ]]>
</script>
</head>
<body>
<div>${message} 畫面正在切換 <p>如果瀏覽器沒有自動切換，請手動按連結前往：<a href="${url}">回到版面</a></p></div>
</body>
</html>`
  };
}

function error(message: string, status: number): PostResult {
  return {
    status,
    html: `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title></title></head><body><div id="error"><div style="text-align: center; font-size: 1.5em; font-weight: bold;"><span style="color: red;">${message}</span><p /><a href="index.htm">回到版面</a>　<a href="javascript:history.back();">回上頁</a></div><hr /></div></body></html>`
  };
}
