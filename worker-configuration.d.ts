interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  ASSETS: Fetcher;
  TIME_ZONE: string;
  PIXMICAT_LANGUAGE: string;
  TITLE: string;
  ENVIRONMENT: string;
  SESSION_SECRET?: string;
  ADMIN_HASH?: string;
}
