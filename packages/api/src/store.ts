import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Db, OrderRec } from "./types.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Photo files on disk (or in memory when no data directory is configured). */
export class PhotoStore {
  private mem = new Map<string, Buffer>();
  constructor(private dir: string | null) {}

  private file(orderId: string, mime: string) {
    return join(this.dir as string, `${orderId}.${EXT[mime] ?? "jpg"}`);
  }

  save(orderId: string, mime: string, data: Buffer) {
    if (!this.dir) return void this.mem.set(orderId, data);
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.file(orderId, mime), data);
  }

  readDataUrl(order: OrderRec): string | null {
    if (!order.photoMime) return null;
    let data: Buffer | undefined;
    if (!this.dir) data = this.mem.get(order.id);
    else {
      const f = this.file(order.id, order.photoMime);
      if (existsSync(f)) data = readFileSync(f);
    }
    return data ? `data:${order.photoMime};base64,${data.toString("base64")}` : null;
  }

  clear() {
    this.mem.clear();
    if (this.dir && existsSync(this.dir)) {
      for (const f of readdirSync(this.dir)) rmSync(join(this.dir, f), { force: true });
    }
  }
}

/** JSON file store. dbFile null means purely in memory (tests). */
export class Store {
  db: Db;
  dirty = false;
  photos: PhotoStore;

  constructor(private dbFile: string | null, seedFn: () => Db) {
    this.photos = new PhotoStore(dbFile ? join(dirname(dbFile), "photos") : null);
    if (dbFile && existsSync(dbFile)) {
      this.db = JSON.parse(readFileSync(dbFile, "utf8")) as Db;
      this.db.settings.quickCategories ??= []; // data files from before the quick selection existed
    } else {
      this.db = seedFn();
      this.save();
    }
  }

  replace(db: Db) {
    this.db = db;
    this.dirty = true;
  }

  /** Atomic write: temp file, then rename. */
  save() {
    this.dirty = false;
    if (!this.dbFile) return;
    mkdirSync(dirname(this.dbFile), { recursive: true });
    const tmp = `${this.dbFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    renameSync(tmp, this.dbFile);
  }
}
