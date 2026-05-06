export interface ImglogRow {
  no: number;
  resto: number;
  root: string;
  time: number;
  md5chksum: string;
  category: string;
  tim: string;
  ext: string;
  imgw: number;
  imgh: number;
  imgsize: string;
  tw: number;
  th: number;
  pwd: string;
  now: string;
  name: string;
  email: string;
  sub: string;
  com: string;
  host: string;
  status: string;
}

export interface ConfigRow {
  key: string;
  value: string;
  description: string;
  updated_at: number;
}

export interface BanlistRow {
  id: number;
  type: string;
  pattern: string;
  reason: string;
  expires_at: number;
  created_at: number;
}

export interface ModerationLogRow {
  id: number;
  action: string;
  target_no: number | null;
  target_type: string;
  moderator: string;
  reason: string;
  created_at: number;
}

export interface Database {
  imglog: ImglogRow;
  configs: ConfigRow;
  banlist: BanlistRow;
  moderation_log: ModerationLogRow;
}
