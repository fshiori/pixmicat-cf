import type { ImglogRow } from "./schema";

type NewPost = Omit<ImglogRow, "no">;

export class PioD1 {
  constructor(private readonly db: D1Database) {}

  async threadCount(): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(no) AS count FROM imglog WHERE resto = 0").first<{ count: number }>();
    return row?.count ?? 0;
  }

  async postCount(resno = 0): Promise<number> {
    if (resno > 0) {
      const row = await this.db.prepare("SELECT COUNT(no) AS count FROM imglog WHERE resto = ?").bind(resno).first<{ count: number }>();
      return (row?.count ?? 0) + 1;
    }
    const row = await this.db.prepare("SELECT COUNT(no) AS count FROM imglog").first<{ count: number }>();
    return row?.count ?? 0;
  }

  async fetchThreadList(start = 0, amount = 0, isDesc = false): Promise<number[]> {
    const order = isDesc ? "no" : "root";
    const sql = `SELECT no FROM imglog WHERE resto = 0 ORDER BY ${order} DESC${amount > 0 ? " LIMIT ? OFFSET ?" : ""}`;
    const result = amount > 0
      ? await this.db.prepare(sql).bind(amount, start).all<{ no: number }>()
      : await this.db.prepare(sql).all<{ no: number }>();
    return result.results.map((row) => row.no);
  }

  async fetchPostList(resno: number): Promise<number[]> {
    const result = await this.db
      .prepare("SELECT no FROM imglog WHERE no = ? OR resto = ? ORDER BY no")
      .bind(resno, resno)
      .all<{ no: number }>();
    return result.results.map((row) => row.no);
  }

  async fetchPosts(postList: number[]): Promise<ImglogRow[]> {
    if (postList.length === 0) return [];
    const placeholders = postList.map(() => "?").join(",");
    const order = postList.length > 1 && postList[0] > postList[1] ? " DESC" : "";
    const result = await this.db
      .prepare(`SELECT * FROM imglog WHERE no IN (${placeholders}) ORDER BY no${order}`)
      .bind(...postList)
      .all<ImglogRow>();
    return result.results;
  }

  async isThread(no: number): Promise<boolean> {
    const row = await this.db.prepare("SELECT no FROM imglog WHERE no = ? AND resto = 0").bind(no).first<{ no: number }>();
    return Boolean(row);
  }

  async addPost(post: NewPost, age: boolean): Promise<number> {
    if (post.resto && age) {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await this.db.prepare("UPDATE imglog SET root = ? WHERE no = ?").bind(now, post.resto).run();
    }

    const result = await this.db
      .prepare(
        `INSERT INTO imglog (resto,root,time,md5chksum,category,tim,ext,imgw,imgh,imgsize,tw,th,pwd,now,name,email,sub,com,host,status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        post.resto,
        post.root,
        post.time,
        post.md5chksum,
        post.category,
        post.tim,
        post.ext,
        post.imgw,
        post.imgh,
        post.imgsize,
        post.tw,
        post.th,
        post.pwd,
        post.now,
        post.name,
        post.email,
        post.sub,
        post.com,
        post.host,
        post.status
      )
      .run();

    return Number(result.meta.last_row_id);
  }

  async removePosts(posts: number[]): Promise<ImglogRow[]> {
    if (posts.length === 0) return [];
    const files = await this.fetchPostsAndReplies(posts);
    const placeholders = posts.map(() => "?").join(",");
    await this.db.prepare(`DELETE FROM imglog WHERE no IN (${placeholders}) OR resto IN (${placeholders})`).bind(...posts, ...posts).run();
    return files.filter((post) => post.ext);
  }

  async removeAttachments(posts: number[], recursive = false): Promise<ImglogRow[]> {
    if (posts.length === 0) return [];
    const placeholders = posts.map(() => "?").join(",");
    const where = recursive ? `no IN (${placeholders}) OR resto IN (${placeholders})` : `no IN (${placeholders})`;
    const bind = recursive ? [...posts, ...posts] : posts;
    const result = await this.db.prepare(`SELECT * FROM imglog WHERE (${where}) AND ext <> ''`).bind(...bind).all<ImglogRow>();
    return result.results;
  }

  async fetchPostsAndReplies(posts: number[]): Promise<ImglogRow[]> {
    const placeholders = posts.map(() => "?").join(",");
    const result = await this.db.prepare(`SELECT * FROM imglog WHERE no IN (${placeholders}) OR resto IN (${placeholders})`).bind(...posts, ...posts).all<ImglogRow>();
    return result.results;
  }

  async searchPost(keywords: string[], field: "com" | "name" | "sub" | "no", method: "AND" | "OR"): Promise<ImglogRow[]> {
    if (keywords.length === 0) return [];
    const column = field === "no" ? "CAST(no AS TEXT)" : field;
    const clauses = keywords.map(() => `${column} LIKE ?`).join(` ${method} `);
    const binds = keywords.map((keyword) => `%${keyword}%`);
    const result = await this.db.prepare(`SELECT * FROM imglog WHERE ${clauses} ORDER BY no DESC`).bind(...binds).all<ImglogRow>();
    return result.results;
  }

  async searchCategory(category: string): Promise<ImglogRow[]> {
    const result = await this.db
      .prepare("SELECT * FROM imglog WHERE lower(category) LIKE ? ORDER BY no DESC")
      .bind(`%,${category.toLowerCase()},%`)
      .all<ImglogRow>();
    return result.results;
  }
}
