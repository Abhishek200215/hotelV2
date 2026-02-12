import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "server", "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "foodieqr.sqlite");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

export function migrate(){
  db.exec(`
    CREATE TABLE IF NOT EXISTS hotels (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      theme_accent TEXT DEFAULT '#ff6b35',
      hero_image TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hotel_users (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','KITCHEN')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(hotel_id, email)
    );

    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      table_number TEXT NOT NULL,
      qr_token TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      UNIQUE(hotel_id, table_number)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      UNIQUE(hotel_id, name)
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      is_veg INTEGER DEFAULT 1,
      is_best INTEGER DEFAULT 0,
      is_spicy INTEGER DEFAULT 0,
      in_stock INTEGER DEFAULT 1,
      prep_minutes INTEGER DEFAULT 10,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      table_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('NEW','PREPARING','READY','DELIVERED','CANCELLED')),
      eta_minutes INTEGER DEFAULT 15,
      subtotal INTEGER NOT NULL,
      total INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      name_snapshot TEXT NOT NULL,
      price_snapshot INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}
