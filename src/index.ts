/**
 * Pixmicat! Cloudflare Workers
 * 主入口檔案
 */

import { Router } from 'itty-router';
import { PIOD1 } from './lib/pio-d1';
import { FileIOR2 } from './lib/fileio-r2';
import { AdminSystem } from './lib/admin';
import { AntiSpamSystem } from './lib/anti-spam';
import { getHoneypotNames, validateHoneypot, getDefaultFieldTrapNames } from './lib/field-trap';

// 建立路由器
const router = Router();

// 中介軟體：CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 處理 OPTIONS 請求
router.options('*', () => new Response(null, { headers: corsHeaders }));

// 處理靜態檔案
router.get('/', async (request, env: Env) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const html = await getHomePage(env, page, request);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
  });
});

// API: 取得討論串列表
router.get('/api/threads', async (request, env: Env) => {
  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const threadNos = await pio.fetchThreadList(offset, limit, true);

  // 讀取 RE_DEF 設定（首頁顯示回應數量）
  const reDef = parseInt(await getConfigValue(env, 're_def', '5'));

  const threads = [];
  for (const no of threadNos) {
    const thread = await pio.getThread(no, reDef);
    if (thread) {
      threads.push(thread);
    }
  }

  return new Response(JSON.stringify({ success: true, data: threads }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});

// API: 取得單一討論串
router.get('/api/thread/:no', async (request, env: Env) => {
  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const no = parseInt(request.params.no || '0');
  const thread = await pio.getThread(no);

  if (!thread) {
    return new Response(
      JSON.stringify({ success: false, error: 'Thread not found' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  return new Response(JSON.stringify({ success: true, data: thread }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});

// API: 新增文章/回應
router.post('/api/post', async (request, env: Env) => {
  try {
    const formData = await request.formData();
    const pio = new PIOD1(env.DB);
    const fileio = new FileIOR2(env.STORAGE);

    await pio.prepare();
    await fileio.init();

    // Honeypot 驗證：檢查蜜罐欄位是否被修改
    const hpName = formData.get('hp_name')?.toString() || '';
    const hpEmail = formData.get('hp_email')?.toString() || '';
    const hpSub = formData.get('hp_sub')?.toString() || '';
    const hpCom = formData.get('hp_com')?.toString() || '';
    const hpReply = formData.get('hp_reply')?.toString() || '';

    // 如果蜜罐欄位被修改，判定為 spam bot
    if (hpName !== 'spammer' ||
        hpEmail !== 'foo@foo.bar' ||
        hpSub !== 'DO NOT FIX THIS' ||
        hpCom !== 'EID OG SMAPS' ||
        hpReply !== '') {
      return new Response(
        JSON.stringify({ success: false, error: '偵測到自動發文程式，請停止此行為' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 取得真正的欄位（使用 Field Trap 隨機名稱）
    const fieldTrapNames = getDefaultFieldTrapNames();
    
    const resto = parseInt(formData.get('resto')?.toString() || '0');
    let name = formData.get(fieldTrapNames.name)?.toString() || '無名氏';
    const email = formData.get(fieldTrapNames.email)?.toString() || '';
    let sub = formData.get(fieldTrapNames.subject)?.toString() || '';
    let com = formData.get(fieldTrapNames.comment)?.toString() || '';
    const password = formData.get('password')?.toString() || '';
    const category = formData.get('category')?.toString() || '';
    const file = formData.get('file') as File | null;
    const continualPost = formData.get('continual_post')?.toString() === '1';

    // 處理 2ch Tripcode（名稱#密碼 → 名稱◆Tripcode）
    if (name.includes('#')) {
      const nameParts = name.split('#');
      const baseName = nameParts[0] || '無名氏';
      const tripKey = nameParts.slice(1).join('#'); // 支援 #..#.. 格式
      
      // 生成 Tripcode
      const tripcode = await generateTripcode(tripKey);
      name = `${baseName}◆${tripcode}`;
    }

    // 字數限制檢查
    const maxCommentLength = parseInt(await getConfigValue(env, 'max_comment_length', '2000'));
    const maxFieldLength = parseInt(await getConfigValue(env, 'max_field_length', '100'));

    if (com.length > maxCommentLength) {
      return new Response(
        JSON.stringify({ success: false, error: `內文過長，最大 ${maxCommentLength} 字` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (name.length > maxFieldLength || email.length > maxFieldLength || 
        sub.length > maxFieldLength || category.length > maxFieldLength) {
      return new Response(
        JSON.stringify({ success: false, error: `欄位過長，最大 ${maxFieldLength} 字` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 連續投稿限制檢查
    const postInterval = parseInt(await getConfigValue(env, 'post_interval', '60'));
    const imagePostInterval = parseInt(await getConfigValue(env, 'image_post_interval', '60'));
    
    // 取得客戶端 IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For')?.split(',')[0] || 
                     'unknown';

    // 檢查連續投稿限制
    if (postInterval > 0 || imagePostInterval > 0) {
      const lastPostKey = `last_post:${clientIP}`;
      const lastImagePostKey = `last_image_post:${clientIP}`;
      
      const currentTime = Math.floor(Date.now() / 1000);
      
      // 檢查一般投稿間隔
      if (postInterval > 0) {
        const lastPostTime = await env.KV.get(lastPostKey);
        if (lastPostTime) {
          const elapsed = currentTime - parseInt(lastPostTime);
          if (elapsed < postInterval) {
            const remaining = postInterval - elapsed;
            return new Response(
              JSON.stringify({ success: false, error: `請等待 ${remaining} 秒後再發文` }),
              {
                status: 429,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              }
            );
          }
        }
      }

      // 檢查貼圖間隔
      if (file && file.size > 0 && imagePostInterval > 0) {
        const lastImagePostTime = await env.KV.get(lastImagePostKey);
        if (lastImagePostTime) {
          const elapsed = currentTime - parseInt(lastImagePostTime);
          if (elapsed < imagePostInterval) {
            const remaining = imagePostInterval - elapsed;
            return new Response(
              JSON.stringify({ success: false, error: `請等待 ${remaining} 秒後再貼圖` }),
              {
                status: 429,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              }
            );
          }
        }
      }
    }

    // 檢查管理員 Cap
    const admin = new AdminSystem(env);
    const capResult = await admin.verifyCap(name, email);
    let processedName = name;
    let processedCom = com;

    if (capResult.isAdmin && capResult.capName) {
      const config = await admin.getCapConfig();
      processedName = `${capResult.capName}${config.suffix}`;

      // 如果允許 HTML，保留原始內容
      if (!config.allowHtml) {
        processedCom = htmlEscape(com);
      }
    } else {
      // 普通用戶，轉義 HTML
      processedCom = htmlEscape(com);
    }

    // 處理自動連結和引用系統
    const autoLinkUrls = await getConfigValue(env, 'auto_link_urls', '1') === '1';
    const enableQuotes = await getConfigValue(env, 'enable_quote_system', '1') === '1';
    processedCom = processComment(processedCom, autoLinkUrls, enableQuotes);

    // 檢查是否允許回應附加圖片
    if (resto > 0 && file) {
      const config = await getConfigValue(env, 'allow_res_img', '1');
      if (config !== '1') {
        return new Response(
          JSON.stringify({ success: false, error: '回應不允許附加圖片' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    }

    // 處理圖片上傳
    let imageData;
    let fileMD5: string | undefined;
    if (file && file.size > 0) {
      const valid = await fileio.validateImage(file);
      if (!valid) {
        return new Response(
          JSON.stringify({ success: false, error: '不支援的圖片格式' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      const maxSize = parseInt(await getConfigValue(env, 'max_file_size', '10485760'));
      if (file.size > maxSize) {
        return new Response(
          JSON.stringify({ success: false, error: '檔案太大' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // 讀取檔案內容（只讀取一次）
      let fileBuffer: ArrayBuffer;
      try {
        fileBuffer = await file.arrayBuffer();
      } catch (e) {
        // 如果 file.arrayBuffer() 不可用，嘗試其他方法
        const fileBytes = await file.bytes();
        fileBuffer = fileBytes.buffer;
      }
      const fileUint8Array = new Uint8Array(fileBuffer);

      // 檔案重複檢查（基於 MD5）
      const enableDuplicateCheck = await getConfigValue(env, 'enable_duplicate_check', '1') === '1';
      if (enableDuplicateCheck) {
        const md5Hash = await fileio.calculateMD5(fileUint8Array);
        fileMD5 = md5Hash;
        const existingPost = await pio.getPostByMD5(md5Hash);

        if (existingPost) {
          // 檔案重複，拒絕上傳
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `此檔案已經存在（No.${existingPost.no}）`,
              existingPost: {
                no: existingPost.no,
                tim: existingPost.tim,
                ext: existingPost.ext,
                filename: existingPost.filename
              }
            }),
            {
              status: 409, // Conflict
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
      }

    // 反垃圾訊息檢查（在檔案處理後以取得 MD5）
    const antiSpam = new AntiSpamSystem(env);
    const antiSpamResult = await antiSpam.checkSpam(
      name,
      email,
      sub,
      com,
      fileMD5,
      request
    );

    if (antiSpamResult.isSpam) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `發文失敗：${antiSpamResult.reason}`,
          details: antiSpamResult.details
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 重新創建 File 物件用於後續處理
      const reusedFile = new File([fileBuffer], file.name, { type: file.type });

      const now = Date.now();
      const tim = now.toString();
      imageData = await fileio.saveImage(reusedFile, reusedFile.name, tim);

      // 生成縮圖（使用資料庫設定）
      const thumbMaxWidth = parseInt(await getConfigValue(env, 'thumb_max_width', '250'));
      const thumbMaxHeight = parseInt(await getConfigValue(env, 'thumb_max_height', '250'));

      if (imageData.width > thumbMaxWidth || imageData.height > thumbMaxHeight) {
        const thumbnail = await fileio.resizeImage(fileBuffer, thumbMaxWidth, thumbMaxHeight);
        await fileio.saveThumbnail(thumbnail, tim);
      } else {
        // 使用原圖作為縮圖
        await fileio.saveThumbnail(reusedFile, tim);
      }
    }

    // 檢查是否為 sage（不推文）
    let isSage = email.toLowerCase() === 'sage';

    // 檢討論串回應數量（MAX_RES 設定：超過此數量自動 sage）
    if (resto > 0 && !isSage) {
      const maxRes = parseInt(await getConfigValue(env, 'max_res', '0'));
      if (maxRes > 0) {
        const thread = await pio.getThread(resto, 0);
        if (thread && thread.reply_count >= maxRes) {
          isSage = true;
        }
      }
    }

    // 檢查討論串年齡（MAX_AGE_TIME 設定：超過此時間自動 sage）
    if (resto > 0 && !isSage) {
      const maxAgeTime = parseInt(await getConfigValue(env, 'max_age_time', '0'));
      if (maxAgeTime > 0) {
        // 取得 OP 文章時間
        const opPost = await pio.fetchPosts(resto);
        if (opPost.length > 0) {
          const opTime = opPost[0].time;
          const currentTime = Math.floor(Date.now() / 1000);
          const ageHours = (currentTime - opTime) / 3600;

          if (ageHours > maxAgeTime) {
            isSage = true;
          }
        }
      }
    }

    // 新增文章
    const postNo = await pio.addPost({
      resto,
      name: processedName,
      email,
      sub,
      com: processedCom,
      password: password ? await hashPassword(password) : '',
      category,
      is_sage: isSage ? 1 : 0,
      ...(imageData && {
        md5: imageData.md5,
        filename: imageData.originalName,
        ext: imageData.extension,
        w: imageData.width,
        h: imageData.height,
        tn_w: imageData.thumbnailWidth || imageData.width,
        tn_h: imageData.thumbnailHeight || imageData.height,
        tim: imageData.tim,
        filesize: imageData.size,
      }),
    });

    // 檢查儲存空間並清理舊檔案
    const storageMax = parseInt(await getConfigValue(env, 'storage_max', '0'));
    if (storageMax > 0) {
      const totalSize = await fileio.getTotalSize();
      if (totalSize > storageMax) {
        await pio.delOldAttachments(totalSize, storageMax, false);
      }
    }

    // 檢查文章數量限制
    const maxPosts = parseInt(await getConfigValue(env, 'max_posts', '0'));
    if (maxPosts > 0) {
      const postCount = await pio.postCount();
      if (postCount > maxPosts) {
        // 刪除最舊的文章
        const oldPosts = await pio.fetchPostList(0, 0, postCount - maxPosts);
        await pio.removePosts(oldPosts);
      }
    }

    // 記錄最後發文時間（用於連續投稿限制）
    if (postInterval > 0 || imagePostInterval > 0) {
      const currentTime = Math.floor(Date.now() / 1000);
      const clientIP = request.headers.get('CF-Connecting-IP') || 
                       request.headers.get('X-Forwarded-For')?.split(',')[0] || 
                       'unknown';
      
      // 記錄一般投稿時間
      if (postInterval > 0) {
        await env.KV.put(`last_post:${clientIP}`, currentTime.toString(), {
          expirationTtl: postInterval + 60, // 多加 60 秒緩衝
        });
      }

      // 記錄貼圖時間
      if (file && file.size > 0 && imagePostInterval > 0) {
        await env.KV.put(`last_image_post:${clientIP}`, currentTime.toString(), {
          expirationTtl: imagePostInterval + 60,
        });
      }
    }

    // 決定重導向目標（連貼機能不重導向）
    let redirectTarget: string | null = null;
    if (!continualPost) {
      redirectTarget = resto > 0 ? `/res/${resto}.htm` : '/';
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          no: postNo, 
          redirect: redirectTarget,
          continual_post: continualPost
        } 
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Post error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// API: 刪除文章
router.post('/api/delete', async (request, env: Env) => {
  try {
    const formData = await request.formData();
    const pio = new PIOD1(env.DB);
    const fileio = new FileIOR2(env.STORAGE);

    await pio.prepare();

    const no = parseInt(formData.get('no')?.toString() || '0');
    const password = formData.get('password')?.toString() || '';
    const onlyFile = formData.get('onlyfile')?.toString() === '1';

    const posts = await pio.fetchPosts(no);
    if (posts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: '文章不存在' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const post = posts[0];

    // 取得客戶端 IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For')?.split(',')[0] || 
                     'unknown';

    // 驗證刪除權限
    let hasPermission = false;

    // 1. 檢查密碼
    if (post.password && password && (await verifyPassword(password, post.password))) {
      hasPermission = true;
    }

    // 2. 如果沒有密碼或密碼驗證失敗，檢查 IP
    if (!hasPermission && post.ip === clientIP) {
      hasPermission = true;
    }

    // 3. 檢查是否為管理員
    if (!hasPermission) {
      const adminSystem = new AdminSystem(env);
      const isAdmin = await adminSystem.isAdminRequest(request);
      if (isAdmin) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ success: false, error: '刪除權限不足（密碼錯誤或 IP 不符）' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 僅刪除附件
    if (onlyFile) {
      if (post.tim && post.ext) {
        await fileio.deleteImage(post.tim, post.ext);
        // 清除附件欄位
        await pio.updatePost(no, {
          tim: '',
          ext: '',
          filename: '',
          md5: '',
          w: 0,
          h: 0,
          tn_w: 0,
          tn_h: 0,
          filesize: 0
        });
      }
    } else {
      // 刪除附件
      if (post.tim && post.ext) {
        await fileio.deleteImage(post.tim, post.ext);
      }

      // 刪除文章
      await pio.removePosts([no]);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: onlyFile ? '附件已刪除' : '文章已刪除' 
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// API: 更新（取得新文章）
router.get('/api/update', async (request, env: Env) => {
  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const url = new URL(request.url);
  const threadNo = parseInt(url.searchParams.get('thread') || '0');
  const lastTime = parseInt(url.searchParams.get('time') || '0');

  if (threadNo <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: '無效的討論串編號' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  // 取得指定時間之後的新回應
  const result = await env.DB.prepare(
    'SELECT * FROM posts WHERE resto = ? AND time > ? ORDER BY time ASC'
  )
    .bind(threadNo, lastTime)
    .all();

  const posts = result.results || [];

  return new Response(JSON.stringify({
    success: true,
    data: {
      posts,
      count: posts.length,
      lastTime: posts.length > 0 ? posts[posts.length - 1].time : lastTime
    }
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});

// API: 搜尋
router.get('/api/search', async (request, env: Env) => {
  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const type = (url.searchParams.get('type') || 'all') as 'all' | 'subject' | 'content';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  const useSearch = await getConfigValue(env, 'use_search', '1');
  if (useSearch !== '1') {
    return new Response(
      JSON.stringify({ success: false, error: '搜尋功能未開啟' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  if (!query) {
    return new Response(
      JSON.stringify({ success: false, error: '請輸入搜尋關鍵字' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const posts = await pio.searchPosts(query, type, { limit, offset: (page - 1) * limit });

  return new Response(JSON.stringify({ success: true, data: posts }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});

// 分類瀏覽 API
router.get('/api/category/:name', async (request, env: Env) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '15');
  const categoryName = request.params.name;

  const useCategory = await getConfigValue(env, 'use_category', '1');
  if (useCategory !== '1') {
    return new Response(
      JSON.stringify({ success: false, error: '分類功能未開啟' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const pio = new PIOD1(env.DB);
  const result = await pio.getPostsByCategory(categoryName, {
    limit,
    offset: (page - 1) * limit,
  });

  return new Response(JSON.stringify({ success: true, data: result }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});

// RSS 輸出
router.get('/rss.xml', async (request, env: Env) => {
  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');

  // 取得最近的討論串
  const threadNos = await pio.fetchThreadList(0, limit, true);
  const threads = [];
  for (const no of threadNos) {
    const thread = await pio.getThread(no, 5);
    if (thread) {
      threads.push(thread);
    }
  }

  // 生成 RSS XML
  const rss = await generateRSS(env, threads);

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300', // 5 分鐘快取
    },
  });
});

// API: RSS (JSON 格式)
router.get('/api/rss', async (request, env: Env) => {
  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');

  // 取得最近的討論串
  const threadNos = await pio.fetchThreadList(0, limit, true);
  const threads = [];
  for (const no of threadNos) {
    const thread = await pio.getThread(no, 5);
    if (thread) {
      threads.push(thread);
    }
  }

  return new Response(JSON.stringify({ success: true, data: threads }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});

// 圖片代理路由
router.get('/img/:filename', async (request, env: Env) => {
  const object = await env.STORAGE.get(request.params.filename);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Length', object.size.toString());
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000');

  // 使用 arrayBuffer 來確保正確讀取數據
  const data = await object.arrayBuffer();
  return new Response(data, { headers });
});

// 縮圖代理路由
// 生產環境：使用 Cloudflare Image Resizing API
// 本地開發：直接從 R2 返回原始圖片
router.get('/thumb/:filename', async (request, env: Env) => {
  // 提取 tim（去掉 's' 後綴）
  const filename = request.params.filename;
  const tim = filename.replace(/s\.jpg$/, '');

  // 嘗試從 R2 取得原始圖片
  let object: R2Object | null = null;
  const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  
  for (const ext of extensions) {
    object = await env.STORAGE.get(tim + ext);
    if (object) break;
  }

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  // 檢查是否為本地開發環境
  const isLocalDev = request.url.includes('localhost') || request.url.includes('127.0.0.1');

  if (!isLocalDev) {
    // 生產環境：使用 Cloudflare Image Resizing
    const url = new URL(request.url);
    const originalExt = object.key?.split('.').pop() || 'jpg';
    const cfImageUrl = `${url.protocol}//${url.host}/cdn-cgi/image/width=250,height=250,quality=75,format=auto,fit=cover/img/${tim}.${originalExt}`;
    
    // 返回 307 重定向到 Cloudflare Image Resizing URL
    return Response.redirect(cfImageUrl, 307);
  }

  // 本地開發環境：直接返回原始圖片
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Content-Length', object.size.toString());
  headers.set('etag', object.httpEtag || '');
  headers.set('Cache-Control', 'public, max-age=31536000');

  const data = await object.arrayBuffer();
  return new Response(data, { headers });
});

// 單一討論串頁面
router.get('/res/:no.htm', async (request, env: Env) => {
  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const no = parseInt(request.params.no.replace('.htm', '') || '0');
  const url = new URL(request.url);
  
  // 取得分頁參數
  const page = parseInt(url.searchParams.get('page') || '1');
  const rePageDef = parseInt(await getConfigValue(env, 're_page_def', '0')); // 0 = 不分頁
  const reDef = parseInt(await getConfigValue(env, 're_def', '5')); // 首頁顯示回應數

  // 如果 rePageDef > 0，啟用分頁；否則使用 reDef 限制回應數
  const thread = await pio.getThread(
    no,
    rePageDef > 0 ? 0 : reDef, // maxReplies (分頁模式時為 0)
    page,
    rePageDef // perPage
  );

  if (!thread) {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>找不到討論串</title></head>
<body>
  <h1>找不到討論串 #${no}</h1>
  <a href="/">返回首頁</a>
</body>
</html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 404,
    });
  }

  const title = await getConfigValue(env, 'title', 'Pixmicat!-CF');
  const defaultName = await getConfigValue(env, 'default_name', '無名氏');

  // 取得欄位陷阱名稱
  const fieldTrapNames = getDefaultFieldTrapNames();
  const honeypotNames = getHoneypotNames();

  const html = `<!DOCTYPE html>
<html lang="${env.DEFAULT_LANGUAGE || 'zh-TW'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${htmlEscape(thread.posts[0]?.sub || '無標題')} - ${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "MS PGothic", "ＭＳ Ｐゴシック", Arial, sans-serif; font-size: 12px; line-height: 1.5; background: #f0e0d6; color: #800000; }
    .container { max-width: 900px; margin: 0 auto; padding: 10px; }
    .header { background: #ea8; border: 1px solid #d9bfb7; padding: 5px; margin-bottom: 10px; }
    .header h1 { font-size: 18px; color: #800000; }
    .thread-nav { margin-bottom: 10px; text-align: center; }
    .thread-nav a { color: #800000; margin: 0 5px; }
    .post { margin-bottom: 20px; padding: 10px; border: 1px solid #d9bfb7; background: #f0e0d6; }
    .post.op { background: #f0e0d6; border: 2px solid #d9bfb7; }
    .post.reply { margin-left: 20px; }
    .post-header { margin-bottom: 5px; }
    .post-subject { color: #cc1105; font-weight: bold; }
    .post-name { color: #117743; font-weight: bold; }
    .post-date { color: #800000; }
    .post-id { color: #800000; }
    .post-content { margin: 10px 0; word-wrap: break-word; }
    .post-image { float: left; margin: 0 10px 10px 0; max-width: 250px; }
    .post-image img { max-width: 250px; height: auto; }
    .file-info { font-size: 10px; margin: 2px 0; }
    .clearfix::after { content: ""; display: table; clear: both; }
    hr { border: none; border-top: 1px solid #d9bfb7; margin: 10px 0; }
    .reply-form { background: #f0e0d6; border: 1px solid #d9bfb7; padding: 10px; margin: 10px 0; }
    .reply-form table { width: 100%; }
    .reply-form td { padding: 2px; }
    .reply-form input[type="text"], .reply-form input[type="file"], .reply-form textarea {
      width: 100%; padding: 2px; border: 1px solid #d9bfb7; font-size: 12px;
    }
    .reply-form button { background: #f0e0d6; border: 1px solid #d9bfb7; padding: 5px 15px; cursor: pointer; }
    .sticky-badge { background: #ff0; color: #000; padding: 2px 5px; font-weight: bold; margin-right: 5px; }
    .locked-badge { background: #f00; color: #fff; padding: 2px 5px; font-weight: bold; margin-right: 5px; }
    .hp-hide { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="thread-nav">
      <a href="/">返回首頁</a>
      <a href="#" onclick="location.reload()">重新載入</a>
    </div>

    ${thread.posts.map((post, index) => `
      <div class="post ${index === 0 ? 'op' : 'reply'} clearfix">
        <div class="post-header">
          ${index === 0 && thread.sticky ? '<span class="sticky-badge">固定</span>' : ''}
          ${index === 0 && thread.locked ? '<span class="locked-badge">鎖定</span>' : ''}
          ${post.sub ? `<span class="post-subject">${htmlEscape(post.sub)}</span>` : ''}
          <span class="post-name">${htmlEscape(post.name)}</span>
          <span class="post-date">${new Date(post.time * 1000).toLocaleString('zh-TW')}</span>
          <span class="post-id">No.${post.no}</span>
        </div>

        ${post.tim && post.ext ? `
          <div class="post-image">
            <a href="/img/${post.tim}${post.ext}" target="_blank">
              <img src="/thumb/${post.tim}s.jpg" alt="${htmlEscape(post.filename)}">
            </a>
            <div class="file-info">
              ${htmlEscape(post.filename)} (${post.w}x${post.h})<br>
              ${post.filesize} bytes
            </div>
          </div>
        ` : ''}

        <div class="post-content">${post.com || ''}</div>
      </div>

      ${index === 0 ? `<hr><div class="reply-form">
        <form id="replyForm" enctype="multipart/form-data">
          <input type="hidden" name="resto" value="${post.no}">
          <!-- Honeypot 欄位：防止 spam bot -->
          <input type="text" name="${honeypotNames.name}" value="spammer" class="hp-hide" tabindex="-1" autocomplete="off">
          <input type="text" name="${honeypotNames.email}" value="foo@foo.bar" class="hp-hide" tabindex="-1" autocomplete="off">
          <input type="text" name="${honeypotNames.subject}" value="DO NOT FIX THIS" class="hp-hide" tabindex="-1" autocomplete="off">
          <textarea name="${honeypotNames.comment}" class="hp-hide" tabindex="-1" autocomplete="off">EID OG SMAPS</textarea>
          <input type="checkbox" name="${honeypotNames.reply}" value="yes" class="hp-hide" tabindex="-1">
          <!-- 真正的欄位（使用隨機名稱） -->
          <table>
            <tr>
              <td><label>名稱</label></td>
              <td><input type="text" name="${fieldTrapNames.name}" id="name" value="${defaultName}"></td>
            </tr>
            <tr>
              <td><label>E-mail</label></td>
              <td><input type="text" name="${fieldTrapNames.email}" id="email"></td>
            </tr>
            <tr>
              <td><label>標題</label></td>
              <td><input type="text" name="${fieldTrapNames.subject}" id="sub"></td>
            </tr>
            <tr>
              <td><label>內容</label></td>
              <td><textarea name="${fieldTrapNames.comment}" id="com" rows="4"></textarea></td>
            </tr>
            <tr>
              <td><label>檔案</label></td>
              <td><input type="file" name="file" id="file"></td>
            </tr>
            <tr>
              <td><label>密碼</label></td>
              <td><input type="password" name="password" id="password"></td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center;">
                <button type="submit">送出</button>
                <button type="reset">重設</button>
              </td>
            </tr>
          </table>
        </form>
      </div><hr>` : ''}
    `).join('')}

    ${thread.pagination ? `
      <div class="pagination" style="text-align: center; margin: 20px 0; padding: 10px; background: #f0e0d6; border: 1px solid #d9bfb7;">
        ${(thread.pagination.current_page || 1) > 1 ? `
          <a href="/res/${no}.htm?page=${(thread.pagination.current_page || 1) - 1}" style="margin: 0 5px;">&lt; 上一頁</a>
        ` : ''}
        
        ${Array.from({ length: Math.min(thread.pagination?.total_pages || 10, 10) }, (_, i) => {
          let pageNum;
          const totalPages = thread.pagination?.total_pages || 1;
          const currentPage = thread.pagination?.current_page || 1;
          
          if (totalPages <= 10) {
            pageNum = i + 1;
          } else {
            // 顯示當前頁附近的頁碼
            const start = Math.max(1, currentPage - 4);
            const end = Math.min(totalPages, start + 9);
            pageNum = start + i;
            if (pageNum > end) return '';
          }
          
          const isActive = pageNum === currentPage;
          return isActive 
            ? `<strong style="margin: 0 5px;">[${pageNum}]</strong>`
            : `<a href="/res/${no}.htm?page=${pageNum}" style="margin: 0 5px;">${pageNum}</a>`;
        }).join('')}
        
        ${(thread.pagination?.current_page || 1) < (thread.pagination?.total_pages || 1) ? `
          <a href="/res/${no}.htm?page=${(thread.pagination?.current_page || 1) + 1}" style="margin: 0 5px;">下一頁 &gt;</a>
        ` : ''}
        
        <span style="margin-left: 10px; color: #800000;">
          共 ${thread.pagination?.total_items || 0} 則回應，${thread.pagination?.total_pages || 1} 頁
        </span>
      </div>
    ` : ''}

    <div style="text-align: center; margin-top: 20px;">
      <a href="/">返回首頁</a>
    </div>
  </div>

  <script>
    let lastUpdateTime = Math.floor(Date.now() / 1000);
    const threadNo = ${no};

    document.getElementById('replyForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      try {
        const response = await fetch('/api/post', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          location.reload();
        } else {
          alert('發文失敗：' + result.error);
        }
      } catch (error) {
        alert('發文失敗');
      }
    });

    // 處理引用連結點擊
    function handleQuoteClick(event, postNo) {
      event.preventDefault();
      
      // 找到回應表單的內文欄位
      const comTextarea = document.getElementById('com');
      if (comTextarea) {
        // 在游標位置插入引用
        const currentValue = comTextarea.value;
        const quoteText = \`>>No.\${postNo}\\n\`;
        
        // 在游標位置插入
        const startPos = comTextarea.selectionStart;
        const endPos = comTextarea.selectionEnd;
        
        comTextarea.value = currentValue.substring(0, startPos) + 
                           quoteText + 
                           currentValue.substring(endPos, currentValue.length);
        
        // 設定新的游標位置
        const newPosition = startPos + quoteText.length;
        comTextarea.setSelectionRange(newPosition, newPosition);
        
        // 聚焦到內文欄位
        comTextarea.focus();
      }
    }

    // 將函數暴露到全局作用域
    window.handleQuoteClick = handleQuoteClick;

    // 自動更新功能
    async function checkUpdates() {
      try {
        const response = await fetch(\`/api/update?thread=\${threadNo}&time=\${lastUpdateTime}\`);
        const result = await response.json();

        if (result.success && result.data.count > 0) {
          const updateBtn = document.getElementById('updateBtn');
          if (updateBtn) {
            updateBtn.textContent = \`新回應 (\${result.data.count})\`;
            updateBtn.style.background = '#28a745';
          }

          lastUpdateTime = result.data.lastTime;
        }
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }

    // 每 30 秒檢查一次更新
    setInterval(checkUpdates, 30000);

    // 手動更新按鈕
    function manualUpdate() {
      location.reload();
    }

    // 新增更新按鈕到導航列
    const nav = document.querySelector('.thread-nav');
    if (nav) {
      const updateBtn = document.createElement('a');
      updateBtn.id = 'updateBtn';
      updateBtn.href = '#';
      updateBtn.textContent = '重新載入';
      updateBtn.onclick = manualUpdate;
      updateBtn.style.marginLeft = '10px';
      nav.appendChild(updateBtn);
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// 分類瀏覽頁面
router.get('/category/:name', async (request, env: Env) => {
  const categoryName = decodeURIComponent(request.params.name);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');

  const useCategory = await getConfigValue(env, 'use_category', '1');
  if (useCategory !== '1') {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>分類功能未開啟</title></head>
<body>
  <h1>分類功能未開啟</h1>
  <a href="/">返回首頁</a>
</body>
</html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 403,
    });
  }

  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const limit = 15;
  const posts = await pio.getPostsByCategory(categoryName, {
    limit,
    offset: (page - 1) * limit,
  });

  const title = await getConfigValue(env, 'title', 'Pixmicat!-CF');
  const defaultName = await getConfigValue(env, 'default_name', '無名氏');
  const timeZone = await getConfigValue(env, 'time_zone', '+8');

  // 時間格式化函數
  const formatTime = (timestamp: number, tz: string): string => {
    const date = new Date(timestamp * 1000);
    const offset = parseInt(tz);
    date.setHours(date.getHours() + offset);
    return date.toISOString().replace('T', ' ').substring(0, 19);
  };

  const html = `<!DOCTYPE html>
<html lang="${env.DEFAULT_LANGUAGE || 'zh-TW'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分類: ${htmlEscape(categoryName)} - ${title}</title>
  <style>
    body { font-family: "MS PGothic", "MSP ゴシック", sans-serif; margin: 0; padding: 20px; background: #f0e0d6; }
    .thread { background: #f0e0d6; border: 1px solid #d9bfb7; margin: 10px 0; padding: 10px; }
    .post { background: #f0e0d6; border: 1px solid #d9bfb7; margin: 10px 0; padding: 10px; }
    .post-info { margin-bottom: 10px; }
    .post-header { font-size: 0.9em; color: #800000; }
    .post-content { margin: 10px 0; }
    .nav { text-align: center; margin: 20px 0; }
    .nav a { margin: 0 5px; padding: 5px 10px; background: #f0e0d6; border: 1px solid #d9bfb7; text-decoration: none; }
    .nav a:hover { background: #e0d0c6; }
    .thumbnail { float: left; margin: 0 10px 10px 0; max-width: 250px; }
    a { color: #800000; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="nav">
    <a href="/">返回首頁</a>
  </div>
  <h1>分類: ${htmlEscape(categoryName)}</h1>
  <p>找到 ${posts.length} 篇文章</p>
  ${posts.map(post => {
    const isThread = post.resto === 0;
    const postUrl = isThread ? `/res/${post.no}.htm` : `#r${post.no}`;
    return `
      <div class="post">
        <div class="post-header">
          ${post.thumbnail ? `<img src="/thumb/${post.tim}s.jpg" class="thumbnail" alt="縮圖">` : ''}
          <strong>No.${post.no}</strong>
          ${post.name !== defaultName ? `<strong>${htmlEscape(post.name)}</strong>` : htmlEscape(post.name)}
          ${post.email ? `<span style="color: #800000;">&lt;${htmlEscape(post.email)}&gt;</span>` : ''}
          ${formatTime(post.time, timeZone)}
          ${post.ext ? `<span>${post.ext.toUpperCase()}</span>` : ''}
          <a href="${postUrl}">回應</a>
        </div>
        ${post.sub ? `<h3>${htmlEscape(post.sub)}</h3>` : ''}
        <div class="post-content">${post.com}</div>
        ${isThread ? `<p>回應: ${post.reply_count || 0}</p>` : ''}
      </div>
    `;
  }).join('')}
  <div class="nav">
    ${page > 1 ? `<a href="/category/${encodeURIComponent(categoryName)}?page=${page - 1}">上一頁</a>` : ''}
    <span>第 ${page} 頁</span>
    ${posts.length === limit ? `<a href="/category/${encodeURIComponent(categoryName)}?page=${page + 1}">下一頁</a>` : ''}
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// ==================== 管理員路由 ====================

// 管理員登入頁面
router.get('/admin', async (request, env: Env) => {
  const admin = new AdminSystem(env);
  const isAdmin = await admin.isAdminRequest(request);

  if (isAdmin) {
    // 已登入，重定向到管理面板
    return Response.redirect(new URL('/admin/dashboard', request.url), 302);
  }

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理員登入 - Pixmicat!-CF</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f0e0d6; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .login-box { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    h1 { text-align: center; color: #800000; margin-bottom: 20px; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; color: #333; }
    input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    button { width: 100%; padding: 10px; background: #800000; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
    button:hover { background: #a00000; }
    .error { color: red; text-align: center; margin-top: 10px; display: none; }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>管理員登入</h1>
    <form id="loginForm">
      <div class="form-group">
        <label for="password">密碼</label>
        <input type="password" id="password" name="password" required autofocus>
      </div>
      <button type="submit">登入</button>
      <div class="error" id="error"></div>
    </form>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');

      try {
        const response = await fetch('/admin/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        const result = await response.json();

        if (result.success) {
          window.location.href = '/admin/dashboard';
        } else {
          errorDiv.textContent = result.error || '登入失敗';
          errorDiv.style.display = 'block';
        }
      } catch (error) {
        errorDiv.textContent = '登入失敗，請重試';
        errorDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// API: 管理員登入
router.post('/admin/api/login', async (request, env: Env) => {
  try {
    const { password } = await request.json() as { password: string };

    if (!password) {
      return new Response(
        JSON.stringify({ success: false, error: '請輸入密碼' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const admin = new AdminSystem(env);
    const isValid = await admin.verifyAdminPassword(password);

    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: '密碼錯誤' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 產生 session token
    const token = await admin.generateSessionToken();
    await admin.createSession(token);

    // 設定 cookie
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set(
      'Set-Cookie',
      `admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ success: false, error: '登入失敗' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// API: 管理員登出
router.post('/admin/api/logout', async (request, env: Env) => {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/admin_session=([^;]+)/);

  if (match) {
    const admin = new AdminSystem(env);
    await admin.deleteSession(match[1]);
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Set-Cookie', 'admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
});

// 管理員儀表板
router.get('/admin/dashboard', async (request, env: Env) => {
  const admin = new AdminSystem(env);
  const isAdmin = await admin.isAdminRequest(request);

  if (!isAdmin) {
    return Response.redirect(new URL('/admin', request.url), 302);
  }

  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const postCount = await pio.postCount();
  const threadCount = await pio.threadCount();

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理面板 - Pixmicat!-CF</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .header { background: #800000; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { margin: 0; }
    .logout-btn { background: #a00000; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; text-decoration: none; }
    .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
    .stat-card .value { font-size: 32px; font-weight: bold; color: #800000; }
    .section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .section h2 { color: #800000; margin-bottom: 15px; }
    .btn { background: #800000; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn:hover { background: #a00000; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎨 Pixmicat!-CF 管理面板</h1>
    <button class="logout-btn" onclick="logout()">登出</button>
  </div>

  <div class="container">
    <div class="stats">
      <div class="stat-card">
        <h3>總文章數</h3>
        <div class="value">${postCount}</div>
      </div>
      <div class="stat-card">
        <h3>討論串數</h3>
        <div class="value">${threadCount}</div>
      </div>
    </div>

    <div class="section">
      <h2>文章管理</h2>
      <a href="/admin/posts" class="btn">管理文章</a>
    </div>

    <div class="section">
      <h2>系統設定</h2>
      <a href="/admin/settings" class="btn">修改設定</a>
    </div>

    <div class="section">
      <h2>IP 封鎖管理</h2>
      <a href="/admin/bans" class="btn">管理封鎖</a>
    </div>

    <div class="section">
      <h2>資料匯入/匯出</h2>
      <a href="/admin/backup" class="btn">備份管理</a>
    </div>

    <div class="section">
      <h2>系統資訊</h2>
      <a href="/admin/status" class="btn">📊 系統狀態</a>
    </div>
  </div>

  <script>
    async function logout() {
      if (confirm('確定要登出嗎？')) {
        await fetch('/admin/api/logout', { method: 'POST' });
        window.location.href = '/admin';
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// 文章管理頁面
router.get('/admin/posts', async (request, env: Env) => {
  const admin = new AdminSystem(env);
  const isAdmin = await admin.isAdminRequest(request);

  if (!isAdmin) {
    return Response.redirect(new URL('/admin', request.url), 302);
  }

  const pio = new PIOD1(env.DB);
  await pio.prepare();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const postNos = await pio.fetchPostList(0, offset, limit);
  const posts = await pio.fetchPosts(postNos);

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文章管理 - Pixmicat!-CF</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .header { background: #800000; color: white; padding: 20px; }
    .header h1 { margin: 0; }
    .container { max-width: 1400px; margin: 20px auto; padding: 0 20px; }
    .toolbar { margin-bottom: 20px; }
    .btn { background: #800000; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin-right: 10px; }
    .btn:hover { background: #a00000; }
    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #c82333; }
    table { width: 100%; background: white; border-collapse: collapse; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: bold; color: #333; }
    tr:hover { background: #f5f5f5; }
    .post-content { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    .badge-op { background: #28a745; color: white; }
    .badge-reply { background: #6c757d; color: white; }
    .badge-sticky { background: #ffc107; color: #000; }
    .badge-locked { background: #dc3545; color: white; }
    .btn-sm { padding: 5px 10px; font-size: 12px; margin: 2px; }
    .btn-sticky { background: #ffc107; color: #000; }
    .btn-sticky:hover { background: #e0a800; }
    .btn-sticky.active { background: #e0a800; }
    .btn-locked { background: #dc3545; }
    .btn-locked.active { background: #c82333; }
    .pagination { margin-top: 20px; text-align: center; }
    .pagination a { display: inline-block; padding: 8px 12px; margin: 0 4px; background: white; border: 1px solid #ddd; text-decoration: none; }
    .pagination a:hover { background: #f5f5f5; }
    .pagination .current { background: #800000; color: white; border-color: #800000; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📝 文章管理</h1>
  </div>

  <div class="container">
    <div class="toolbar">
      <a href="/admin/dashboard" class="btn">← 返回儀表板</a>
      <button class="btn btn-danger" onclick="deleteSelected()">刪除選取</button>
    </div>

    <table>
      <thead>
        <tr>
          <th><input type="checkbox" id="selectAll" onclick="toggleAll()"></th>
          <th>No.</th>
          <th>類型</th>
          <th>名稱</th>
          <th>標題</th>
          <th>內容</th>
          <th>時間</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${posts.map(post => `
          <tr data-no="${post.no}">
            <td><input type="checkbox" class="post-checkbox" value="${post.no}"></td>
            <td>${post.no}</td>
            <td>
              <span class="badge ${post.resto === 0 ? 'badge-op' : 'badge-reply'}">${post.resto === 0 ? 'OP' : 'RE'}</span>
              ${post.sticky ? '<span class="badge badge-sticky">固定</span>' : ''}
              ${post.locked ? '<span class="badge badge-locked">鎖定</span>' : ''}
            </td>
            <td>${htmlEscape(post.name)}</td>
            <td>${htmlEscape(post.sub || '')}</td>
            <td class="post-content">${htmlEscape(post.com || '')}</td>
            <td>${new Date(post.time * 1000).toLocaleString('zh-TW')}</td>
            <td>
              ${post.resto === 0 ? `
                <button class="btn btn-sm btn-sticky ${post.sticky ? 'active' : ''}" onclick="toggleSticky(${post.no})">
                  ${post.sticky ? '解除固定' : '固定'}
                </button>
                <button class="btn btn-sm btn-locked ${post.locked ? 'active' : ''}" onclick="toggleLocked(${post.no})">
                  ${post.locked ? '解除鎖定' : '鎖定'}
                </button>
              ` : ''}
              <button class="btn btn-sm" onclick="viewPost(${post.no})">查看</button>
              <button class="btn btn-sm btn-danger" onclick="deletePost(${post.no})">刪除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="pagination">
      ${page > 1 ? `<a href="/admin/posts?page=${page - 1}">上一頁</a>` : ''}
      <span class="current">第 ${page} 頁</span>
      <a href="/admin/posts?page=${page + 1}">下一頁</a>
    </div>
  </div>

  <script>
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    function toggleAll() {
      const checkboxes = document.querySelectorAll('.post-checkbox');
      const selectAll = document.getElementById('selectAll');
      checkboxes.forEach(cb => cb.checked = selectAll.checked);
    }

    async function deletePost(no) {
      if (!confirm(\`確定要刪除文章 \${no} 嗎？\`)) return;

      try {
        const response = await fetch('/admin/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posts: [no] })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('刪除失敗：' + result.error);
        }
      } catch (error) {
        alert('刪除失敗');
      }
    }

    async function toggleSticky(no) {
      try {
        const response = await fetch('/admin/api/toggle-sticky', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ no })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('操作失敗：' + result.error);
        }
      } catch (error) {
        alert('操作失敗');
      }
    }

    async function toggleLocked(no) {
      try {
        const response = await fetch('/admin/api/toggle-locked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ no })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('操作失敗：' + result.error);
        }
      } catch (error) {
        alert('操作失敗');
      }
    }

    async function deleteSelected() {
      const checkboxes = document.querySelectorAll('.post-checkbox:checked');
      if (checkboxes.length === 0) {
        alert('請先選擇要刪除的文章');
        return;
      }

      if (!confirm(\`確定要刪除選取的 \${checkboxes.length} 篇文章嗎？\`)) return;

      const posts = Array.from(checkboxes).map(cb => parseInt(cb.value));

      try {
        const response = await fetch('/admin/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posts })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('刪除失敗：' + result.error);
        }
      } catch (error) {
        alert('刪除失敗');
      }
    }

    function viewPost(no) {
      window.open('/res/' + no + '.htm', '_blank');
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// API: 管理員刪除文章
router.post('/admin/api/delete', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const { posts } = await request.json() as { posts: number[] };

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: '無效的文章列表' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const pio = new PIOD1(env.DB);
    const fileio = new FileIOR2(env.STORAGE);

    await pio.prepare();

    // 刪除附件
    const attachments = await pio.removeAttachments(posts, false);

    // 從 R2 刪除檔案
    for (const file of attachments) {
      await env.STORAGE.delete(file);
    }

    // 刪除文章
    await pio.removePosts(posts);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// 設定管理頁面
router.get('/admin/settings', async (request, env: Env) => {
  const admin = new AdminSystem(env);
  const isAdmin = await admin.isAdminRequest(request);

  if (!isAdmin) {
    return Response.redirect(new URL('/admin', request.url), 302);
  }

  const pio = new PIOD1(env.DB);
  await pio.prepare();

  // 取得所有設定
  const configResult = await env.DB.prepare('SELECT key, value FROM configs ORDER BY key').all<{ key: string; value: string }>();
  const configs = configResult.results || [];

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>系統設定 - Pixmicat!-CF</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .header { background: #800000; color: white; padding: 20px; }
    .header h1 { margin: 0; }
    .container { max-width: 900px; margin: 20px auto; padding: 0 20px; }
    .toolbar { margin-bottom: 20px; }
    .btn { background: #800000; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin-right: 10px; }
    .btn:hover { background: #a00000; }
    .btn-primary { background: #28a745; }
    .btn-primary:hover { background: #218838; }
    table { width: 100%; background: white; border-collapse: collapse; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: bold; color: #333; }
    tr:hover { background: #f5f5f5; }
    .key-col { width: 30%; font-family: monospace; color: #800000; }
    .value-col { width: 50%; }
    .actions-col { width: 20%; text-align: center; }
    input[type="text"], textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    textarea { resize: vertical; min-height: 60px; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
    .modal.show { display: flex; justify-content: center; align-items: center; }
    .modal-content { background: white; padding: 30px; border-radius: 8px; width: 90%; max-width: 500px; }
    .modal h2 { color: #800000; margin-bottom: 20px; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
    .modal-actions { text-align: right; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚙️ 系統設定</h1>
  </div>

  <div class="container">
    <div class="toolbar">
      <a href="/admin/dashboard" class="btn">← 返回儀表板</a>
      <button class="btn btn-primary" onclick="showAddModal()">+ 新增設定</button>
      <button class="btn" onclick="performMaintenance('optimize')">🔧 優化資料庫</button>
      <button class="btn" onclick="performMaintenance('check')">✅ 檢查資料庫</button>
      <button class="btn" onclick="performMaintenance('repair')">🔨 修復資料庫</button>
    </div>

    <table>
      <thead>
        <tr>
          <th>設定鍵</th>
          <th>設定值</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${configs.map(config => `
          <tr>
            <td class="key-col">${htmlEscape(config.key)}</td>
            <td class="value-col">${htmlEscape(config.value)}</td>
            <td class="actions-col">
              <button class="btn" onclick="editConfig('${htmlEscape(config.key)}', '${htmlEscape(config.value)}')">編輯</button>
              <button class="btn btn-danger" style="background:#dc3545" onclick="deleteConfig('${htmlEscape(config.key)}')">刪除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- 編輯/新增 Modal -->
  <div id="configModal" class="modal">
    <div class="modal-content">
      <h2 id="modalTitle">編輯設定</h2>
      <form id="configForm">
        <div class="form-group">
          <label for="configKey">設定鍵</label>
          <input type="text" id="configKey" required>
        </div>
        <div class="form-group">
          <label for="configValue">設定值</label>
          <textarea id="configValue" required></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">儲存</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const modal = document.getElementById('configModal');
    const form = document.getElementById('configForm');
    let originalKey = '';

    function showAddModal() {
      document.getElementById('modalTitle').textContent = '新增設定';
      document.getElementById('configKey').value = '';
      document.getElementById('configKey').disabled = false;
      document.getElementById('configValue').value = '';
      originalKey = '';
      modal.classList.add('show');
    }

    function editConfig(key, value) {
      document.getElementById('modalTitle').textContent = '編輯設定';
      document.getElementById('configKey').value = key;
      document.getElementById('configKey').disabled = true;
      document.getElementById('configValue').value = value;
      originalKey = key;
      modal.classList.add('show');
    }

    function closeModal() {
      modal.classList.remove('show');
    }

    async function performMaintenance(action) {
      const actionNames = {
        'optimize': '優化',
        'check': '檢查',
        'repair': '修復'
      };

      if (!confirm(\`確定要\${actionNames[action]}資料庫嗎？\`)) return;

      try {
        const response = await fetch('/admin/api/maintenance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });

        const result = await response.json();
        if (result.success) {
          alert(\`\${actionNames[action]}完成！\\n\\n結果：\${result.data.result ? '成功' : '失敗'}\`);
        } else {
          alert(\`\${actionNames[action]}失敗：\${result.error}\`);
        }
      } catch (error) {
        alert(\`\${actionNames[action]}失敗：\${error.message}\`);
      }
    }

    async function deleteConfig(key) {
      if (!confirm(\`確定要刪除設定 \${key} 嗎？\`)) return;

      try {
        const response = await fetch('/admin/api/config/' + encodeURIComponent(key), {
          method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('刪除失敗：' + result.error);
        }
      } catch (error) {
        alert('刪除失敗');
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = document.getElementById('configKey').value;
      const value = document.getElementById('configValue').value;

      try {
        const isEdit = originalKey !== '';
        const url = isEdit
          ? '/admin/api/config/' + encodeURIComponent(originalKey)
          : '/admin/api/config';

        const response = await fetch(url, {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('儲存失敗：' + result.error);
        }
      } catch (error) {
        alert('儲存失敗');
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// API: 新增設定
router.post('/admin/api/config', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const { key, value } = await request.json() as { key: string; value: string };

    if (!key || value === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少必要欄位' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 插入或更新
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO configs (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?')
      .bind(key, value, now, value, now)
      .run();

    // 清除快取
    await env.KV.delete(`config:${key}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Config create error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// API: 更新設定
router.put('/admin/api/config/:key', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const key = decodeURIComponent(request.params.key || '');
    const { value } = await request.json() as { value: string };

    if (!key || value === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少必要欄位' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('UPDATE configs SET value = ?, updated_at = ? WHERE key = ?')
      .bind(value, now, key)
      .run();

    // 清除快取
    await env.KV.delete(`config:${key}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Config update error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// API: 刪除設定
router.delete('/admin/api/config/:key', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const key = decodeURIComponent(request.params.key || '');

    if (!key) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少設定鍵' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    await env.DB.prepare('DELETE FROM configs WHERE key = ?')
      .bind(key)
      .run();

    // 清除快取
    await env.KV.delete(`config:${key}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Config delete error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// IP 封鎖管理頁面
router.get('/admin/bans', async (request, env: Env) => {
  const admin = new AdminSystem(env);
  const isAdmin = await admin.isAdminRequest(request);

  if (!isAdmin) {
    return Response.redirect(new URL('/admin', request.url), 302);
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const banResult = await env.DB.prepare('SELECT * FROM bans ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<{ id: number; ip: string; reason: string; created_at: number; expires_at: number | null; created_by: string }>();

  const bans = banResult.results || [];

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IP 封鎖管理 - Pixmicat!-CF</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .header { background: #800000; color: white; padding: 20px; }
    .header h1 { margin: 0; }
    .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
    .toolbar { margin-bottom: 20px; }
    .btn { background: #800000; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin-right: 10px; }
    .btn:hover { background: #a00000; }
    .btn-primary { background: #28a745; }
    .btn-primary:hover { background: #218838; }
    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #c82333; }
    table { width: 100%; background: white; border-collapse: collapse; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: bold; color: #333; }
    tr:hover { background: #f5f5f5; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
    .modal.show { display: flex; justify-content: center; align-items: center; }
    .modal-content { background: white; padding: 30px; border-radius: 8px; width: 90%; max-width: 500px; }
    .modal h2 { color: #800000; margin-bottom: 20px; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    .modal-actions { text-align: right; margin-top: 20px; }
    .expired { color: #dc3545; font-weight: bold; }
    .active { color: #28a745; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚫 IP 封鎖管理</h1>
  </div>

  <div class="container">
    <div class="toolbar">
      <a href="/admin/dashboard" class="btn">← 返回儀表板</a>
      <button class="btn btn-primary" onclick="showAddModal()">+ 新增封鎖</button>
    </div>

    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>IP 位址</th>
          <th>原因</th>
          <th>建立時間</th>
          <th>過期時間</th>
          <th>建立者</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${bans.map(ban => {
          const isExpired = ban.expires_at && ban.expires_at < Math.floor(Date.now() / 1000);
          return `
            <tr>
              <td>${ban.id}</td>
              <td>${htmlEscape(ban.ip)}</td>
              <td>${htmlEscape(ban.reason || '')}</td>
              <td>${new Date(ban.created_at * 1000).toLocaleString('zh-TW')}</td>
              <td class="${isExpired ? 'expired' : 'active'}">${ban.expires_at ? new Date(ban.expires_at * 1000).toLocaleString('zh-TW') : '永久'}</td>
              <td>${htmlEscape(ban.created_by || '')}</td>
              <td>
                <button class="btn btn-danger" onclick="deleteBan(${ban.id})">刪除</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    ${bans.length === 0 ? '<p style="text-align: center; padding: 20px; color: #666;">目前沒有封鎖的 IP</p>' : ''}
  </div>

  <!-- 新增封鎖 Modal -->
  <div id="banModal" class="modal">
    <div class="modal-content">
      <h2>新增 IP 封鎖</h2>
      <form id="banForm">
        <div class="form-group">
          <label for="banIp">IP 位址</label>
          <input type="text" id="banIp" placeholder="例: 127.0.0.1 或 192.168.1.*" required>
        </div>
        <div class="form-group">
          <label for="banReason">原因</label>
          <textarea id="banReason" rows="3" placeholder="封鎖原因"></textarea>
        </div>
        <div class="form-group">
          <label for="banDuration">有效期</label>
          <select id="banDuration">
            <option value="3600">1 小時</option>
            <option value="86400">1 天</option>
            <option value="604800">1 週</option>
            <option value="2592000">1 個月</option>
            <option value="0">永久</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">新增</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const modal = document.getElementById('banModal');
    const form = document.getElementById('banForm');

    function showAddModal() {
      modal.classList.add('show');
    }

    function closeModal() {
      modal.classList.remove('show');
      form.reset();
    }

    async function deleteBan(id) {
      if (!confirm(\`確定要解除封鎖嗎？\`)) return;

      try {
        const response = await fetch('/admin/api/bans/' + id, {
          method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('刪除失敗：' + result.error);
        }
      } catch (error) {
        alert('刪除失敗');
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ip = document.getElementById('banIp').value;
      const reason = document.getElementById('banReason').value;
      const duration = parseInt(document.getElementById('banDuration').value);

      try {
        const response = await fetch('/admin/api/bans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip, reason, duration })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('新增失敗：' + result.error);
        }
      } catch (error) {
        alert('新增失敗');
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// API: 新增 IP 封鎖
router.post('/admin/api/bans', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const { ip, reason, duration } = await request.json() as { ip: string; reason?: string; duration: number };

    if (!ip) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少 IP 位址' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = duration > 0 ? now + duration : null;

    await env.DB.prepare('INSERT INTO bans (ip, reason, expires_at, created_by) VALUES (?, ?, ?, ?)')
      .bind(ip, reason || '', expiresAt, 'admin')
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Ban create error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// API: 刪除 IP 封鎖
router.delete('/admin/api/bans/:id', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const id = parseInt(request.params.id || '0');

    await env.DB.prepare('DELETE FROM bans WHERE id = ?')
      .bind(id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Ban delete error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// API: 切換討論串固定
router.post('/admin/api/toggle-sticky', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const { no } = await request.json() as { no: number };

    if (!no) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少文章編號' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 取得當前狀態
    const post = await env.DB.prepare('SELECT sticky FROM posts WHERE no = ?')
      .bind(no)
      .first<{ sticky: number }>();

    if (!post) {
      return new Response(
        JSON.stringify({ success: false, error: '文章不存在' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const newSticky = post.sticky === 1 ? 0 : 1;

    await env.DB.prepare('UPDATE posts SET sticky = ? WHERE no = ?')
      .bind(newSticky, no)
      .run();

    return new Response(JSON.stringify({ success: true, data: { sticky: newSticky } }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Toggle sticky error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// API: 切換討論串鎖定
router.post('/admin/api/toggle-locked', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const { no } = await request.json() as { no: number };

    if (!no) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少文章編號' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 取得當前狀態
    const post = await env.DB.prepare('SELECT locked FROM posts WHERE no = ?')
      .bind(no)
      .first<{ locked: number }>();

    if (!post) {
      return new Response(
        JSON.stringify({ success: false, error: '文章不存在' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const newLocked = post.locked === 1 ? 0 : 1;

    await env.DB.prepare('UPDATE posts SET locked = ? WHERE no = ?')
      .bind(newLocked, no)
      .run();

    return new Response(JSON.stringify({ success: true, data: { locked: newLocked } }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Toggle locked error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// 資料庫維護功能
router.post('/admin/api/maintenance', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    if (!(await admin.isAuthenticated(request))) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const { action } = await request.json() as { action: string };

    if (!action || !['optimize', 'check', 'repair'].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: '無效的動作' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const pio = new PIOD1(env.DB);
    await pio.prepare();

    const result = await pio.maintenance(action, true);

    return new Response(JSON.stringify({ 
      success: true, 
      data: { action, result }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Database maintenance error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// 系統狀態頁面
router.get('/admin/status', async (request, env: Env) => {
  const admin = new AdminSystem(env);
  const isAdmin = await admin.isAdminRequest(request);

  if (!isAdmin) {
    return Response.redirect(new URL('/admin', request.url), 302);
  }

  const pio = new PIOD1(env.DB);
  await pio.prepare();

  // 取得統計數據
  const postCount = await pio.postCount();
  const threadCount = await pio.threadCount();
  const replyCount = postCount - threadCount;

  // 取得最新文章
  const latestPosts = await env.DB.prepare(`
    SELECT no, resto, time, name, sub, com, category, sticky, locked
    FROM posts
    ORDER BY time DESC
    LIMIT 10
  `).all();

  // 取得分類統計
  const categoryStats = await env.DB.prepare(`
    SELECT category, COUNT(*) as count
    FROM posts
    WHERE category != ''
    GROUP BY category
    ORDER BY count DESC
  `).all();

  // 取得今日文章數
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = Math.floor(today.getTime() / 1000);
  
  const todayPosts = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM posts
    WHERE time >= ?
  `).bind(todayTimestamp).first<{ count: number }>();

  // 計算儲存空間使用（從 R2 取得）
  let storageUsed = 0;
  let storageLimit = 0;
  try {
    // 這裡可以添加 R2 儲存空間查詢
    // 目前使用設定值
    const limitPercent = parseInt(await getConfigValue(env, 'limit_storage_percent', '0'));
    if (limitPercent > 0) {
      // 模擬計算（實際需要從 R2 API 獲取）
      storageLimit = limitPercent;
    }
  } catch (error) {
    console.error('Failed to get storage info:', error);
  }

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>系統狀態 - Pixmicat!-CF</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .header { background: #800000; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { margin: 0; }
    .logout-btn { background: #a00000; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; text-decoration: none; }
    .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
    .stat-card .value { font-size: 32px; font-weight: bold; color: #800000; }
    .section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .section h2 { color: #800000; margin-bottom: 15px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: bold; color: #333; }
    tr:hover { background: #f5f5f5; }
    .btn { background: #800000; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn:hover { background: #a00000; }
    .progress-bar { width: 100%; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden; }
    .progress-fill { height: 100%; background: #800000; transition: width 0.3s; }
    .auto-refresh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .auto-refresh label { margin-right: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 系統狀態</h1>
    <button class="logout-btn" onclick="logout()">登出</button>
  </div>

  <div class="container">
    <div class="auto-refresh">
      <a href="/admin/dashboard" class="btn">← 返回儀表板</a>
      <div>
        <label>
          <input type="checkbox" id="autoRefresh" onchange="toggleAutoRefresh()">
          自動重新整理 (30秒)
        </label>
        <button class="btn" onclick="location.reload()">🔄 重新整理</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat-card">
        <h3>總文章數</h3>
        <div class="value">${postCount}</div>
      </div>
      <div class="stat-card">
        <h3>討論串數</h3>
        <div class="value">${threadCount}</div>
      </div>
      <div class="stat-card">
        <h3>回應數</h3>
        <div class="value">${replyCount}</div>
      </div>
      <div class="stat-card">
        <h3>今日文章</h3>
        <div class="value">${todayPosts?.count || 0}</div>
      </div>
    </div>

    ${storageLimit > 0 ? `
    <div class="section">
      <h2>💾 儲存空間</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${storageUsed}%"></div>
      </div>
      <p style="margin-top: 10px;">已使用: ${storageUsed}% / ${storageLimit}%</p>
    </div>
    ` : ''}

    <div class="section">
      <h2>📁 分類統計</h2>
      <table>
        <thead>
          <tr>
            <th>分類名稱</th>
            <th>文章數量</th>
          </tr>
        </thead>
        <tbody>
          ${categoryStats.results?.map(stat => `
            <tr>
              <td>${htmlEscape(stat.category)}</td>
              <td>${stat.count}</td>
            </tr>
          `).join('') || '<tr><td colspan="2">尚無分類數據</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>📝 最新文章</h2>
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>標題</th>
            <th>名稱</th>
            <th>分類</th>
            <th>時間</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          ${latestPosts.results?.map(post => {
            const date = new Date(post.time * 1000);
            const timeStr = date.toISOString().replace('T', ' ').substring(0, 19);
            return `
              <tr>
                <td>${post.no}</td>
                <td>${post.sub ? htmlEscape(post.sub) : '(無標題)'}</td>
                <td>${htmlEscape(post.name)}</td>
                <td>${post.category || '-'}</td>
                <td>${timeStr}</td>
                <td>
                  ${post.sticky ? '📌 置頂' : ''}
                  ${post.locked ? '🔒 鎖定' : ''}
                  ${!post.sticky && !post.locked ? '正常' : ''}
                </td>
              </tr>
            `;
          }).join('') || '<tr><td colspan="6">尚無文章</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    function logout() {
      if (confirm('確定要登出嗎？')) {
        fetch('/admin/logout', { method: 'POST' })
          .then(() => window.location.href = '/admin');
      }
    }

    let refreshInterval;
    function toggleAutoRefresh() {
      const checkbox = document.getElementById('autoRefresh');
      if (checkbox.checked) {
        refreshInterval = setInterval(() => {
          location.reload();
        }, 30000);
      } else {
        clearInterval(refreshInterval);
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// 備份管理頁面
router.get('/admin/backup', async (request, env: Env) => {
  const admin = new AdminSystem(env);
  const isAdmin = await admin.isAdminRequest(request);

  if (!isAdmin) {
    return Response.redirect(new URL('/admin', request.url), 302);
  }

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>備份管理 - Pixmicat!-CF</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .header { background: #800000; color: white; padding: 20px; }
    .header h1 { margin: 0; }
    .container { max-width: 1000px; margin: 20px auto; padding: 0 20px; }
    .toolbar { margin-bottom: 20px; }
    .btn { background: #800000; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin-right: 10px; }
    .btn:hover { background: #a00000; }
    .btn-primary { background: #28a745; }
    .btn-primary:hover { background: #218838; }
    .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .card h2 { color: #800000; margin-bottom: 15px; }
    .card p { color: #666; margin-bottom: 20px; }
    .import-area { border: 2px dashed #ddd; padding: 20px; text-align: center; border-radius: 4px; margin-top: 15px; }
    .import-area.dragover { border-color: #28a745; background: #f0fff0; }
    textarea { width: 100%; min-height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 12px; }
    .status { padding: 10px; border-radius: 4px; margin-top: 10px; display: none; }
    .status.success { background: #d4edda; color: #155724; }
    .status.error { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="header">
    <h1>💾 備份管理</h1>
  </div>

  <div class="container">
    <div class="toolbar">
      <a href="/admin/dashboard" class="btn">← 返回儀表板</a>
    </div>

    <div class="card">
      <h2>📤 匯出資料</h2>
      <p>將所有文章匯出為 JSON 格式，可用於備份或遷移。</p>
      <button class="btn btn-primary" onclick="exportData()">匯出所有文章</button>
    </div>

    <div class="card">
      <h2>📥 匯入資料</h2>
      <p>從 JSON 格式匯入文章。支援新增與更新已存在的文章。</p>
      
      <div class="import-area" id="importArea">
        <p style="margin-bottom: 10px;">貼上 JSON 資料或選擇檔案：</p>
        <input type="file" id="importFile" accept=".json" style="margin-bottom: 10px;">
        <textarea id="importData" placeholder='{"version": "1.0", "posts": [...]}'></textarea>
        <div style="margin-top: 15px;">
          <button class="btn btn-primary" onclick="importData()">匯入資料</button>
          <button class="btn" onclick="clearImport()">清除</button>
        </div>
      </div>

      <div class="status" id="status"></div>
    </div>

    <div class="card">
      <h2>⚠️ 注意事項</h2>
      <ul style="margin-left: 20px; color: #666; line-height: 1.8;">
        <li>匯出會包含所有文章資料（含圖片元資料，但不含圖片檔案本身）</li>
        <li>匯入時會根據文章編號 (no) 自動判斷是新增或更新</li>
        <li>圖片檔案需要另外從 R2 備份</li>
        <li>建議定期匯出資料作為備份</li>
      </ul>
    </div>
  </div>

  <script>
    async function exportData() {
      try {
        const response = await fetch('/admin/api/export');
        
        if (!response.ok) {
          throw new Error('匯出失敗');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`pixmicat-export-\${Date.now()}.json\`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        alert('匯出失敗：' + error.message);
      }
    }

    async function importData() {
      const textarea = document.getElementById('importData');
      const fileInput = document.getElementById('importFile');
      const statusDiv = document.getElementById('status');
      
      let data;
      
      // 優先使用檔案
      if (fileInput.files.length > 0) {
        try {
          const text = await fileInput.files[0].text();
          data = JSON.parse(text);
        } catch (error) {
          showStatus('檔案解析失敗', 'error');
          return;
        }
      } else if (textarea.value.trim()) {
        try {
          data = JSON.parse(textarea.value);
        } catch (error) {
          showStatus('JSON 格式錯誤', 'error');
          return;
        }
      } else {
        showStatus('請選擇檔案或輸入 JSON 資料', 'error');
        return;
      }

      if (!confirm(\`確定要匯入 \${data.posts?.length || 0} 篇文章嗎？\`)) {
        return;
      }

      try {
        const response = await fetch('/admin/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
          showStatus(\`匯入成功！共匯入 \${result.data.imported} 篇文章\`, 'success');
          clearImport();
        } else {
          showStatus('匯入失敗：' + result.error, 'error');
        }
      } catch (error) {
        showStatus('匯入失敗：' + error.message, 'error');
      }
    }

    function clearImport() {
      document.getElementById('importData').value = '';
      document.getElementById('importFile').value = '';
      document.getElementById('status').style.display = 'none';
    }

    function showStatus(message, type) {
      const statusDiv = document.getElementById('status');
      statusDiv.textContent = message;
      statusDiv.className = 'status ' + type;
      statusDiv.style.display = 'block';
    }

    // 檔案選擇時自動讀取
    document.getElementById('importFile').addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        try {
          const text = await e.target.files[0].text();
          document.getElementById('importData').value = text;
        } catch (error) {
          console.error('File read error:', error);
        }
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// API: 匯出文章
router.get('/admin/api/export', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const pio = new PIOD1(env.DB);
    await pio.prepare();

    const allPosts = await pio.fetchPostList(0, 0, 0);
    const posts = await pio.fetchPosts(allPosts);

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      totalPosts: posts.length,
      posts: posts.map(post => ({
        no: post.no,
        resto: post.resto,
        name: post.name,
        email: post.email,
        sub: post.sub,
        com: post.com,
        time: post.time,
        md5: post.md5,
        filename: post.filename,
        ext: post.ext,
        w: post.w,
        h: post.h,
        tn_w: post.tn_w,
        tn_h: post.tn_h,
        tim: post.tim,
        filesize: post.filesize,
        category: post.category,
        sticky: post.sticky,
        locked: post.locked,
        status: post.status,
      }))
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="pixmicat-export-${Date.now()}.json"`,
        ...corsHeaders
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// API: 匯入文章
router.post('/admin/api/import', async (request, env: Env) => {
  try {
    const admin = new AdminSystem(env);
    const isAdmin = await admin.isAdminRequest(request);

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const importData = await request.json() as {
      version?: string;
      posts?: any[];
    };

    if (!importData.posts || !Array.isArray(importData.posts)) {
      return new Response(
        JSON.stringify({ success: false, error: '無效的匯入格式' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    let successCount = 0;
    let errorCount = 0;

    for (const post of importData.posts) {
      try {
        await env.DB.prepare(`
          INSERT INTO posts (
            no, resto, name, email, sub, com, password,
            time, md5, filename, ext, w, h, tn_w, tn_h,
            tim, filesize, category, sticky, locked, status, ip, uid
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '')
          ON CONFLICT(no) DO UPDATE SET
            resto = excluded.resto,
            name = excluded.name,
            email = excluded.email,
            sub = excluded.sub,
            com = excluded.com,
            md5 = excluded.md5,
            filename = excluded.filename,
            ext = excluded.ext,
            w = excluded.w,
            h = excluded.h,
            tn_w = excluded.tn_w,
            tn_h = excluded.tn_h,
            tim = excluded.tim,
            filesize = excluded.filesize,
            category = excluded.category,
            sticky = excluded.sticky,
            locked = excluded.locked,
            status = excluded.status
        `).bind(
          post.no, post.resto, post.name, post.email || '', post.sub || '', post.com || '', '',
          post.time, post.md5 || '', post.filename || '', post.ext || '', post.w || 0, post.h || 0,
          post.tn_w || 0, post.tn_h || 0, post.tim || '', post.filesize || 0,
          post.category || '', post.sticky || 0, post.locked || 0, post.status || 0
        ).run();

        successCount++;
      } catch (error) {
        console.error('Import post error:', error);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        imported: successCount,
        errors: errorCount,
        total: importData.posts.length
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// 匯出
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    router.handle(request, env, ctx).catch((err) => {
      console.error(err);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }),
};

// 輔助函數

async function getHomePage(env: Env, page: number = 1, request?: Request): Promise<string> {
  const title = await getConfigValue(env, 'title', 'Pixmicat!-CF');
  const defaultName = await getConfigValue(env, 'default_name', '無名氏');
  const threadsPerPage = parseInt(await getConfigValue(env, 'threads_per_page', '15'));

  // 檢查是否為管理員
  const adminSystem = new AdminSystem(env);
  const isAdmin = request ? await adminSystem.isAdminRequest(request) : false;

  // 取得欄位陷阱名稱
  const fieldTrapNames = getDefaultFieldTrapNames();
  const honeypotNames = getHoneypotNames();

  return `<!DOCTYPE html>
<html lang="${env.DEFAULT_LANGUAGE || 'zh-TW'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "MS PGothic", "ＭＳ Ｐゴシック", Arial, sans-serif; font-size: 12px; line-height: 1.5; background: #f0e0d6; color: #800000; }
    .container { max-width: 900px; margin: 0 auto; padding: 10px; }
    .post-form { background: #f0e0d6; border: 1px solid #d9bfb7; padding: 5px; margin-bottom: 20px; border-radius: 5px; }
    .post-form table { width: 100%; }
    .post-form td { padding: 2px; }
    .post-form input[type="text"], .post-form textarea { width: 100%; border: 1px solid #aaa; padding: 2px; }
    .post-form textarea { height: 80px; resize: vertical; }
    .post-form input[type="submit"] { cursor: pointer; padding: 2px 10px; }
    .thread { background: #f0e0d6; border: 1px solid #d9bfb7; margin: 10px 0; padding: 10px; border-radius: 5px; }
    .post { margin: 10px 0; padding: 5px; }
    .post.op { background: #f0e0d6; }
    .post.reply { margin-left: 20px; }
    .post-header { margin-bottom: 5px; }
    .post-subject { color: #cc1105; font-weight: bold; }
    .post-name { color: #117743; font-weight: bold; }
    .post-date { color: #800000; }
    .post-id { color: #800000; }
    .post-content { margin: 10px 0; }
    .post-image { float: left; margin: 0 10px 10px 0; max-width: 250px; }
    .post-image img { max-width: 250px; height: auto; }
    .file-info { font-size: 10px; margin: 2px 0; }
    .clearfix::after { content: ""; display: table; clear: both; }
    hr { border: none; border-top: 1px solid #d9bfb7; margin: 10px 0; }
    .hp-hide { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1 style="text-align: center; color: #800000;">${title}</h1>

    <div class="post-form">
      <form id="postForm" action="/api/post" method="POST" enctype="multipart/form-data">
        <input type="hidden" name="resto" id="resto" value="">
        <!-- Honeypot 欄位：防止 spam bot -->
        <input type="text" name="${honeypotNames.name}" value="spammer" class="hp-hide" tabindex="-1" autocomplete="off">
        <input type="text" name="${honeypotNames.email}" value="foo@foo.bar" class="hp-hide" tabindex="-1" autocomplete="off">
        <input type="text" name="${honeypotNames.subject}" value="DO NOT FIX THIS" class="hp-hide" tabindex="-1" autocomplete="off">
        <textarea name="${honeypotNames.comment}" class="hp-hide" tabindex="-1" autocomplete="off">EID OG SMAPS</textarea>
        <input type="checkbox" name="${honeypotNames.reply}" value="yes" class="hp-hide" tabindex="-1">
        <!-- 真正的欄位（使用隨機名稱） -->
        <table>
          <tr>
            <td><label>名稱</label></td>
            <td><input type="text" name="${fieldTrapNames.name}" id="name" value="${defaultName}"></td>
          </tr>
          <tr>
            <td><label>E-mail</label></td>
            <td><input type="text" name="${fieldTrapNames.email}" id="email"></td>
          </tr>
          <tr>
            <td><label>標題</label></td>
            <td><input type="text" name="${fieldTrapNames.subject}" id="sub"></td>
          </tr>
          <tr>
            <td><label>附檔</label></td>
            <td>
              <input type="file" name="file" id="file" accept="image/*">
              <label style="margin-left: 10px;">
                <input type="checkbox" name="continual_post" value="1"> 連貼機能
              </label>
            </td>
          </tr>
          <tr>
            <td><label>內文</label></td>
            <td><textarea name="${fieldTrapNames.comment}" id="com"></textarea></td>
          </tr>
          <tr>
            <td><label>刪除用密碼</label></td>
            <td><input type="password" name="password" id="password"></td>
          </tr>
          <tr>
            <td></td>
            <td><input type="submit" value="送出"></td>
          </tr>
        </table>
      </form>
    </div>

    <!-- 警告提示系統 -->
    <div id="warningSystem"></div>

    <!-- 刪除文章區塊 -->
    <div id="deletePostSection" style="background: #f0e0d6; border: 1px solid #d9bfb7; padding: 10px; margin: 20px 0; border-radius: 5px; display: none;">
      <h3 style="margin: 0 0 10px 0; color: #800000;">【刪除文章】</h3>
      <div style="margin-bottom: 10px;">
        <label>
          <input type="checkbox" id="onlyFileCheckbox" name="onlyfile" value="1">
          僅刪除附加檔案
        </label>
      </div>
      <div style="margin-bottom: 10px;">
        <label>刪除用密碼: </label>
        <input type="password" id="deletePassword" style="padding: 2px; border: 1px solid #aaa;">
      </div>
      <button id="deleteBtn" style="padding: 5px 15px; cursor: pointer; background: #cc0000; color: white; border: none; border-radius: 3px;">刪除</button>
    </div>

    ${isAdmin ? `
    <div class="admin-panel" style="background: #f0e0d6; border: 1px solid #d9bfb7; padding: 10px; margin-bottom: 20px; border-radius: 5px;">
      <h3 style="margin: 0 0 10px 0; color: #800000;">管理員面板</h3>
      <div style="margin-bottom: 10px;">
        <button id="selectAllBtn" style="padding: 5px 10px; margin-right: 5px;">全選</button>
        <button id="deselectAllBtn" style="padding: 5px 10px; margin-right: 5px;">取消全選</button>
        <button id="deleteSelectedBtn" style="padding: 5px 10px; background: #cc0000; color: white; border: none; cursor: pointer;">刪除選中</button>
      </div>
      <div id="adminStatus" style="color: #800000; font-weight: bold;"></div>
    </div>
    ` : ''}

    <div id="threads"></div>
  </div>

  <script>
    const API_BASE = '/api';
    const currentPage = ${page};
    const threadsPerPage = ${threadsPerPage};

    // Cookie 處理函數
    function setCookie(name, value, days) {
      const expires = days ? '; expires=' + new Date(Date.now() + days * 864e5).toGMTString() : '';
      document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/';
    }

    function getCookie(name) {
      const value = '; ' + document.cookie;
      const parts = value.split('; ' + name + '=');
      if (parts.length == 2) {
        const cookieValue = parts.pop().split(';').shift();
        return decodeURIComponent(cookieValue);
      }
      return null;
    }

    // 頁面載入時恢復 Cookie 中的密碼和名稱
    document.addEventListener('DOMContentLoaded', function() {
      const savedPassword = getCookie('pixmicat_password');
      if (savedPassword) {
        document.getElementById('password').value = savedPassword;
      }

      const savedName = getCookie('pixmicat_name');
      if (savedName) {
        document.getElementById('name').value = savedName;
      }

      const savedEmail = getCookie('pixmicat_email');
      if (savedEmail) {
        document.getElementById('email').value = savedEmail;
      }
    });

    // 發文前保存到 Cookie
    const postForm = document.querySelector('form[action="/api/post"]');
    if (postForm) {
      postForm.addEventListener('submit', function(e) {
        const password = document.getElementById('password').value;
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;

        if (password) setCookie('pixmicat_password', password, 30);
        if (name && name !== '無名氏') setCookie('pixmicat_name', name, 30);
        if (email) setCookie('pixmicat_email', email, 30);

        // 處理連貼機能（不跳轉）
        const continualPost = document.querySelector('input[name="continual_post"]').checked;
        if (continualPost) {
          e.preventDefault();
          
          const formData = new FormData(this);
          
          fetch('/api/post', {
            method: 'POST',
            body: formData
          })
          .then(response => response.json())
          .then(result => {
            if (result.success) {
              alert('發文成功！');
              this.reset();
              document.getElementById('name').value = getCookie('pixmicat_name') || '無名氏';
              document.getElementById('email').value = getCookie('pixmicat_email') || '';
              document.getElementById('password').value = getCookie('pixmicat_password') || '';
              loadThreads();
            } else {
              alert('發文失敗：' + result.error);
            }
          })
          .catch(error => {
            alert('發文失敗：' + error.message);
          });
        }
      });
    }

    async function loadThreads() {
      const url = API_BASE + '/threads?page=' + currentPage + '&limit=' + threadsPerPage;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        const container = document.getElementById('threads');
        container.innerHTML = result.data.map(thread => renderThread(thread)).join('');
        
        // 添加分頁導航
        renderPagination(currentPage, threadsPerPage);
      }
    }

    // 警告提示系統
    async function checkWarnings() {
      const warningDiv = document.getElementById('warningSystem');
      const warnings = [];

      try {
        // 檢查檔案大小限制
        const maxFileSize = 10485760; // 10MB
        const fileInput = document.getElementById('file');
        if (fileInput && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          if (file.size > maxFileSize) {
            const maxSizeMB = (maxFileSize / 1024 / 1024).toFixed(1);
            const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
            warnings.push({
              type: 'error',
              message: '檔案過大！最大支援 ' + maxSizeMB + ' MB，當前檔案 ' + fileSizeMB + ' MB'
            });
          }
        }

        // 檢查舊討論串（如果是最後回應超過 30 天）
        const response = await fetch(API_BASE + '/threads?limit=20');
        const result = await response.json();
        
        if (result.success && result.data) {
          const thirtyDaysAgo = Math.floor((Date.now() / 1000) - (30 * 24 * 60 * 60));
          
          result.data.forEach(thread => {
            if (thread.last_reply_time && thread.last_reply_time < thirtyDaysAgo) {
              warnings.push({
                type: 'warning',
                message: '討論串 No.' + thread.no + ' 已超過 30 天未回應'
              });
            }
            
            // 檢查鎖定討論串
            if (thread.locked) {
              warnings.push({
                type: 'info',
                message: '討論串 No.' + thread.no + ' 已鎖定，無法回應'
              });
            }
          });
        }

        // 顯示警告
        if (warnings.length > 0) {
          const uniqueWarnings = warnings.filter((v, i, a) => 
            a.findIndex(t => t.message === v.message) === i
          );

          warningDiv.innerHTML = uniqueWarnings.map(warning => {
            const colors = {
              error: '#dc3545',
              warning: '#ffc107',
              info: '#17a2b8'
            };
            const bgColor = {
              error: '#f8d7da',
              warning: '#fff3cd',
              info: '#d1ecf1'
            };
            
            return '<div style="background:' + bgColor[warning.type] + 
                   ';border:1px solid ' + colors[warning.type] +
                   ';color:' + colors[warning.type] +
                   ';padding:10px;margin:10px 0;border-radius:5px;font-size:12px;">' +
                   '<strong>' + warning.type.toUpperCase() + ':</strong> ' + 
                   warning.message + '</div>';
          }).join('');
        } else {
          warningDiv.innerHTML = '';
        }
      } catch (error) {
        console.error('Warning check error:', error);
      }
    }

    // 頁面載入時檢查警告
    checkWarnings();

    // 檔案選擇時重新檢查
    const fileInput = document.getElementById('file');
    if (fileInput) {
      fileInput.addEventListener('change', checkWarnings);
    }

    // 管理員面板功能
      ${isAdmin ? `
      const adminPanel = document.querySelector('.admin-panel');
      if (adminPanel) {
        const selectAllBtn = document.getElementById('selectAllBtn');
        const deselectAllBtn = document.getElementById('deselectAllBtn');
        const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        const adminStatus = document.getElementById('adminStatus');

        // 全選
        selectAllBtn.addEventListener('click', () => {
          document.querySelectorAll('.admin-checkbox').forEach(cb => cb.checked = true);
        });

        // 取消全選
        deselectAllBtn.addEventListener('click', () => {
          document.querySelectorAll('.admin-checkbox').forEach(cb => cb.checked = false);
        });

        // 刪除選中的文章
        deleteSelectedBtn.addEventListener('click', async () => {
          const selected = Array.from(document.querySelectorAll('.admin-checkbox:checked'))
            .map(cb => cb.dataset.postNo);

          if (selected.length === 0) {
            adminStatus.textContent = '請選擇要刪除的文章';
            return;
          }

          if (!confirm('確定要刪除 ' + selected.length + ' 篇文章嗎？')) {
            return;
          }

          adminStatus.textContent = '刪除中...';

          try {
            for (const postNo of selected) {
              const response = await fetch(API_BASE + '/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ no: parseInt(postNo) })
              });

              const result = await response.json();
              if (!result.success) {
                throw new Error(result.error || '刪除失敗');
              }
            }

            adminStatus.textContent = '刪除成功！';
            setTimeout(() => {
              adminStatus.textContent = '';
              loadThreads(); // 重新載入討論串
            }, 1500);
          } catch (error) {
            adminStatus.textContent = '刪除失敗：' + error.message;
          }
        });

        // 單獨刪除按鈕
        document.addEventListener('click', async (e) => {
          if (e.target.classList.contains('admin-delete-btn')) {
            e.preventDefault();
            const postNo = e.target.dataset.postNo;
            
            if (!confirm('確定要刪除這篇文章嗎？')) {
              return;
            }

            try {
              const response = await fetch(API_BASE + '/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ no: parseInt(postNo) })
              });

              const result = await response.json();
              if (result.success) {
                alert('刪除成功！');
                loadThreads();
              } else {
                alert('刪除失敗：' + result.error);
              }
            } catch (error) {
              alert('刪除失敗：' + error.message);
            }
          }
        });
      }
      ` : ''}

    function renderThread(thread) {
      const op = thread.posts[0];
      let html = '<div class="thread">';

      html += '<div class="post op clearfix">';
      html += renderPost(op);
      html += '</div>';

      thread.posts.slice(1).forEach(post => {
        html += '<div class="post reply clearfix">';
        html += renderPost(post);
        html += '</div>';
      });

      html += '</div>';
      return html;
    }

    function renderPost(post) {
      let html = '<div class="post-header">';
      
      // 為所有使用者顯示勾選框（用於刪除）
      html += '<input type="checkbox" class="delete-checkbox" data-post-no="' + post.no + '" style="margin-right: 5px;">';
      
      if (post.sub) html += '<span class="post-subject">' + escapeHtml(post.sub) + '</span> ';
      html += '<span class="post-name">' + escapeHtml(post.name) + '</span> ';
      html += '<span class="post-date">' + formatDate(post.time) + '</span> ';
      if (post.uid) html += '<span class="post-id">ID:' + escapeHtml(post.uid) + '</span>';
      
      html += '</div>';

      if (post.tim && post.ext) {
        html += '<div class="post-image">';
        html += '<a href="/img/' + post.tim + post.ext + '" target="_blank">';
        html += '<img src="/thumb/' + post.tim + 's.jpg" alt="">';
        html += '</a>';
        html += '<div class="file-info">' + escapeHtml(post.filename || '') + ' (' + formatSize(post.filesize) + ')</div>';
        html += '</div>';
      }

      html += '<div class="post-content">' + formatComment(post.com) + '</div>';

      return html;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    function formatDate(timestamp) {
      const date = new Date(timestamp * 1000);
      return date.toISOString().replace('T', ' ').substring(0, 19);
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function formatComment(text) {
      if (!text) return '';
      return escapeHtml(text)
        .replace(/>>(\\d+)/g, '<a href="#$1">>>$1</a>')
        .replace(/\\n/g, '<br>');
    }

    function renderPagination(currentPage, perPage) {
      fetch(API_BASE + '/threads?page=' + currentPage + '&limit=' + perPage)
        .then(res => res.json())
        .then(result => {
          if (!result.success) return;
          
          // 計算總頁數（假設總數可以從 result 獲取）
          // 目前我們假設如果返回的資料少於 perPage，表示是最後一頁
          const hasMore = result.data.length === perPage;
          
          const nav = document.createElement('div');
          nav.className = 'pagination';
          nav.style.cssText = 'text-align: center; margin: 20px 0;';
          
          if (currentPage > 1) {
            const prevBtn = document.createElement('a');
            prevBtn.href = '?page=' + (currentPage - 1);
            prevBtn.textContent = '◄ 上一頁';
            prevBtn.style.cssText = 'margin: 0 5px; padding: 5px 10px; background: #f0e0d6; border: 1px solid #d9bfb7; text-decoration: none; color: #800000;';
            nav.appendChild(prevBtn);
          }
          
          const pageSpan = document.createElement('span');
          pageSpan.textContent = '第 ' + currentPage + ' 頁';
          pageSpan.style.cssText = 'margin: 0 10px; font-weight: bold;';
          nav.appendChild(pageSpan);
          
          if (hasMore) {
            const nextBtn = document.createElement('a');
            nextBtn.href = '?page=' + (currentPage + 1);
            nextBtn.textContent = '下一頁 ►';
            nextBtn.style.cssText = 'margin: 0 5px; padding: 5px 10px; background: #f0e0d6; border: 1px solid #d9bfb7; text-decoration: none; color: #800000;';
            nav.appendChild(nextBtn);
          }
          
          const threadsContainer = document.getElementById('threads');
          threadsContainer.parentNode.insertBefore(nav, threadsContainer.nextSibling);
        });
    }

    document.getElementById('postForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      try {
        const response = await fetch(API_BASE + '/post', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          if (result.data.continual_post) {
            // 連貼機能：清空表單但保留連貼勾選，顯示成功訊息
            document.getElementById('sub').value = '';
            document.getElementById('com').value = '';
            document.getElementById('file').value = '';
            alert('發文成功！文章 No.' + result.data.no);
            
            // 重新載入討論串列表
            if (typeof loadThreads === 'function') {
              loadThreads();
            }
          } else if (result.data.redirect) {
            window.location.href = result.data.redirect;
          } else {
            window.location.reload();
          }
        } else {
          alert('錯誤: ' + result.error);
        }
      } catch (error) {
        alert('發送失敗: ' + error.message);
      }
    });

    // 刪除文章功能
    const deleteSection = document.getElementById('deletePostSection');
    const deleteBtn = document.getElementById('deleteBtn');
    let selectedPosts = new Set();

    // 監聽勾選框變化
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('delete-checkbox')) {
        const postNo = e.target.getAttribute('data-post-no');
        
        if (e.target.checked) {
          selectedPosts.add(postNo);
        } else {
          selectedPosts.delete(postNo);
        }

        // 顯示或隱藏刪除區塊
        if (selectedPosts.size > 0) {
          deleteSection.style.display = 'block';
        } else {
          deleteSection.style.display = 'none';
        }
      }
    });

    // 刪除按鈕點擊
    deleteBtn.addEventListener('click', async () => {
      if (selectedPosts.size === 0) {
        alert('請選擇要刪除的文章');
        return;
      }

      const onlyFile = document.getElementById('onlyFileCheckbox').checked;
      const password = document.getElementById('deletePassword').value;

      if (!password) {
        alert('請輸入刪除用密碼（或留空使用 IP 認證）');
        return;
      }

      if (!confirm('確定要刪除選中的文章嗎？')) {
        return;
      }

      try {
        // 逐一刪除文章
        for (const postNo of selectedPosts) {
          const formData = new FormData();
          formData.append('no', postNo);
          formData.append('password', password);
          if (onlyFile) {
            formData.append('onlyfile', '1');
          }

          const response = await fetch(API_BASE + '/delete', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (!result.success) {
            alert('刪除文章 No.' + postNo + ' 失敗: ' + result.error);
            return;
          }
        }

        alert('刪除成功！');
        selectedPosts.clear();
        deleteSection.style.display = 'none';
        
        // 取消所有勾選
        document.querySelectorAll('.delete-checkbox').forEach(cb => {
          cb.checked = false;
        });

        // 重新載入討論串
        if (typeof loadThreads === 'function') {
          loadThreads();
        }
      } catch (error) {
        alert('刪除失敗: ' + error.message);
      }
    });

    loadThreads();
  </script>
</body>
</html>`;
}

async function getConfigValue(env: Env, key: string, defaultValue: string): Promise<string> {
  // 先從 KV 讀取
  const cached = await env.KV.get(`config:${key}`);
  if (cached) return cached;

  // 從 D1 讀取
  const result = await env.DB
    .prepare('SELECT value FROM configs WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();

  const value = result?.value || defaultValue;

  // 快取到 KV
  await env.KV.put(`config:${key}`, value, { expirationTtl: 3600 });

  return value;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'pixmicat-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 生成 2ch 風格 Tripcode
 * 使用 crypt() 兼容的雜湊演算法
 */
async function generateTripcode(key: string): Promise<string> {
  // 2ch Tripcode 使用特殊的 salt 處理
  // 將密碼和 salt 組合後進行雜湊
  const salt = generateTripcodeSalt(key);
  const combined = key + salt;
  
  // 使用 SHA-1 並轉換為 base64（類似 2ch 的處理方式）
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hash = await crypto.subtle.digest('SHA-1', data);
  
  // 取雜湊的前 10 個字元作為 Tripcode
  const tripArray = Array.from(new Uint8Array(hash)).slice(0, 10);
  return tripArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 10);
}

/**
 * 生成 Tripcode 使用的 salt
 * 2ch 風格：從 key 中提取字元，替換特殊字元
 */
function generateTripcodeSalt(key: string): string {
  // 2ch Tripcode salt 規則
  // 從 key 的後半部分提取，並替換特殊字元
  const specialChars = ':;<=>?@[\\]^_`';
  const replacements = 'ABCDEFGabcdef';
  
  let salt = '';
  const keyStr = key.substring(Math.floor(key.length / 2));
  
  for (let i = 0; i < keyStr.length && salt.length < 8; i++) {
    const char = keyStr[i];
    const idx = specialChars.indexOf(char);
    if (idx !== -1) {
      salt += replacements[idx % replacements.length];
    } else if (/[a-zA-Z0-9.]/.test(char)) {
      salt += char;
    }
  }
  
  // 確保 salt 至少有 2 個字元，前面加上 H.
  if (salt.length < 2) {
    salt = 'H.';
  } else {
    salt = 'H.' + salt.substring(0, 8);
  }
  
  return salt.substring(0, 12); // 限制長度
}

/**
 * 自動將 URL 轉換為超連結
 */
function autoLinkUrls(text: string): string {
  // 匹配 HTTP/HTTPS URL
  const urlRegex = /(https?:\/\/[^\s<>]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}

/**
 * 處理引用系統 (>>No.xxx)
 */
function processQuotes(text: string): string {
  // 匹配 >>No.123 或 >>123 格式
  const quoteRegex = /&gt;&gt;No\\.(\\d+)|&gt;&gt;(\\d+)/g;
  return text.replace(quoteRegex, (match, p1, p2) => {
    const postNo = p1 || p2;
    // 使用 data 屬性和點擊事件，支援在單一討論串頁面自動填入回應表單
    return `<a href=\"#r${postNo}\" 
               class=\"quote-link\" 
               data-post-no=\"${postNo}\"
               onclick=\"handleQuoteClick(event, ${postNo})\"
              >&gt;&gt;No.${postNo}</a>`;
  });
}

/**
 * 處理內容（自動連結 + 引用系統）
 */
function processComment(text: string, enableAutoLink: boolean, enableQuotes: boolean): string {
  let processed = text;

  if (enableAutoLink) {
    processed = autoLinkUrls(processed);
  }

  if (enableQuotes) {
    processed = processQuotes(processed);
  }

  return processed;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

function htmlEscape(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 生成 RSS XML
 * @param env 環境變數
 * @param threads 討論串列表
 * @returns RSS XML 字串
 */
async function generateRSS(env: Env, threads: any[]): Promise<string> {
  // 取得基本設定
  const siteName = await getConfigValue(env, 'site_name', 'Pixmicat!');
  const baseUrl = await getConfigValue(env, 'base_url', 'https://pixmicat.example.com');
  const siteDescription = await getConfigValue(env, 'meta_description', 'Pixmicat! Image Board');

  const now = new Date().toUTCString();

  // RSS XML
  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${htmlEscape(siteName)}</title>
    <link>${baseUrl}</link>
    <description>${htmlEscape(siteDescription)}</description>
    <language>zh-TW</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
`;

  // 添加每個討論串
  for (const thread of threads) {
    const post = thread.posts[0]; // 第一篇文章是 OP
    const threadUrl = `${baseUrl}/res/${post.no}.htm`;
    // 使用 tim 或 time 計算日期
    const timestamp = post.tim ? parseInt(post.tim) : post.time * 1000;
    const pubDate = new Date(timestamp).toUTCString();
    const description = post.com ? post.com : '(無內容)';
    const hasImage = post.ext && post.tim;

    // 建立內容描述
    let content = '';
    if (hasImage) {
      content += `<img src="${baseUrl}/img/${post.tim}${post.ext}" alt="${htmlEscape(post.filename)}" /><br/>`;
      content += `<p>檔案: ${htmlEscape(post.filename)} (${post.w}x${post.h})</p>`;
    }
    content += `<p>${htmlEscape(description)}</p>`;

    // 添加回應摘要
    if (thread.posts && thread.posts.length > 1) {
      content += `<p><strong>回應 (${thread.reply_count || thread.posts.length - 1}):</strong></p>`;
      thread.posts.slice(1, 6).forEach((reply: any) => {
        content += `<p>>>${reply.no}: ${htmlEscape(reply.com || '(無內容)').substring(0, 100)}...</p>`;
      });
    }

    rss += `    <item>
      <title>No.${post.no} - ${htmlEscape(post.sub || '(無標題)')}</title>
      <link>${threadUrl}</link>
      <description><![CDATA[${content}]]></description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${threadUrl}</guid>
    </item>
`;
  }

  rss += `  </channel>
</rss>`;

  return rss;
}
