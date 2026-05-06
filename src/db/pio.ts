import type { ImglogRow } from "./schema";

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
}
