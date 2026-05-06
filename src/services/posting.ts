import { PioD1 } from "../db/pio";
import { getConfig, getNumberConfig } from "../lib/config";
import { cleanStr, escapeHtml } from "../lib/html";
import { md5Hex, postPasswordHash } from "../lib/hash";

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

  if (name.length > inputMax) return error("名稱過長", 400);
  if (email.length > inputMax) return error("E-mail過長", 400);
  if (sub.length > inputMax) return error("標題過長", 400);
  if (com.length > commMax) return error("內文過長", 400);
  if (resto && !(await pio.isThread(resto))) return error("欲回應之文章並不存在！", 404);

  const hasUpload = uploadFile !== null;
  if (!resto && !hasUpload && !form.get("noimg")) {
    return error("因應防止Spam對策，發文無附加圖檔請勾選[無貼圖]核選框！", 400);
  }
  if (!com && !hasUpload) return error("在沒有附加圖檔的情況下，請寫入內文", 400);

  name = name || defaultName;
  sub = sub || defaultTitle;
  com = normalizeComment(com || defaultComment);
  const category = categoryInput ? `,${categoryInput.split(",").map((part) => part.trim()).join(",")},` : "";
  const pass = await postPasswordHash(effectivePassword);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tim = `${nowSeconds}${String(Date.now()).slice(-3)}`;
  const remote = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const now = await formatNow(env, nowSeconds, remote);
  let image: ImageInfo = { tim, ext: "", width: 0, height: 0, sizeText: "", md5: "" };

  if (hasUpload) {
    if (uploadFile.size > maxKb * 1024) return error("上傳失敗<br />上傳的附加圖檔容量超過上傳容量限制", 400);
    try {
      image = await validateAndStoreImage(env, uploadFile, tim, allowExt);
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
    tw: 0,
    th: 0,
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

async function validateAndStoreImage(env: Env, file: UploadFile, tim: string, allowExt: string[]): Promise<ImageInfo> {
  const buffer = await file.arrayBuffer();
  const info = readImageInfo(buffer, file.name);
  if (!allowExt.includes(info.ext.slice(1).toLowerCase())) {
    throw new Error("附加圖檔為系統不支援的格式");
  }
  await env.R2.put(`${tim}${info.ext}`, buffer, {
    httpMetadata: { contentType: file.type || mimeFromExt(info.ext) }
  });
  return {
    tim,
    ext: info.ext,
    width: info.width,
    height: info.height,
    sizeText: formatFileSize(file.size),
    md5: await md5Hex(buffer)
  };
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
