const zhTw: Record<string, string> = {
  del_head: "【刪除文章】",
  del_img_only: "僅刪除附加圖檔",
  del_pass: "刪除用密碼: ",
  del_btn: " 執行 ",
  prev_page: "上一頁",
  first_page: "第一頁",
  next_page: "下一頁",
  last_page: "最後一頁",
  img_sample: "[以預覽圖顯示]",
  img_filename: "檔名：",
  reply_btn: "回應",
  warn_locked: "這篇討論串已被管理員標記為禁止回應。",
  notice_omitted: "有回應 %1$s 篇被省略。要閱讀所有回應請按下回應連結。",
  post_name: "名稱: ",
  post_category: "類別: ",
  regist_withoutcomment: "在沒有附加圖檔的情況下，請寫入內文",
  regist_upload_notsupport: "附加圖檔為系統不支援的格式",
  head_home: "回首頁",
  head_search: "搜尋",
  head_info: "系統資訊",
  head_admin: "管理區",
  head_refresh: "重新整理",
  form_showpostform: "投稿",
  form_hidepostform: "隱藏表單",
  form_name: "名 稱",
  form_email: "E-mail",
  form_topic: "標 題",
  form_submit_btn: "送 出",
  form_comment: "內 文",
  form_attechment: "附加圖檔",
  form_noattechment: "無貼圖",
  form_contpost: "連貼機能",
  form_category: "類別標籤",
  form_category_notice: "(請以 , 逗號分隔多個標籤)",
  form_delete_password: "刪除用密碼",
  form_delete_password_notice: "(刪除文章用。英數字8字元以內)",
  form_notice:
    "<li>可附加圖檔類型：%1$s，瀏覽器才能正常附加圖檔</li><li>附加圖檔最大上傳資料量為 %2$s KB。當回文時E-mail填入sage為不推文功能</li><li>當檔案超過寬 %3$s 像素、高 %4$s 像素時會自動縮小尺寸顯示</li>",
  form_notice_storage_limit: "<li>目前附加圖檔使用量大小： %1$s KB / %2$s KB</li>",
  form_notice_noscript: "＊您選擇關閉了JavaScript，但這對您的瀏覽及發文應無巨大影響",
  js_convert_sakura: "偵測到您有輸入櫻花日文假名的可能性，將自動為您轉換",
  return: "回到版面"
};

export function t(key: string, ...args: Array<string | number>): string {
  let value = zhTw[key] ?? key;
  args.forEach((arg, index) => {
    value = value.replaceAll(`%${index + 1}$s`, String(arg));
  });
  return value;
}
