import { escapeHtml } from "../lib/html";

export function renderShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" type="text/css" href="/mainstyle.css" />
</head>
<body>
${body}
</body>
</html>`;
}
