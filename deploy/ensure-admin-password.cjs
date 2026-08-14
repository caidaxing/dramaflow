#!/usr/bin/env node
// 通过 ADMIN_PASSWORD 覆盖内置管理员（o_user.name='admin'）密码。
// 用法: node ensure-admin-password.cjs <dbPath> <password>
// 依赖：bcryptjs、better-sqlite3（生产镜像 node_modules 内）
"use strict";

const path = require("path");
const { hashSync } = require("/app/node_modules/bcryptjs");

const [, , dbPath, password] = process.argv;
if (!dbPath || !password) {
  console.error("usage: ensure-admin-password.cjs <dbPath> <password>");
  process.exit(1);
}

let Database;
try {
  // 脚本位于 /usr/local/bin，Node 从脚本目录解析模块；显式指向应用依赖目录
  Database = require("/app/node_modules/better-sqlite3");
} catch (e) {
  console.error("better-sqlite3 不可用: " + e.message);
  process.exit(1);
}

try {
  const db = new Database(dbPath, { readonly: false });
  const existing = db.prepare("SELECT id FROM o_user WHERE name = 'admin'").get();
  if (!existing) {
    db.close();
    process.exit(1);
  }
  const hash = hashSync(password, 10);
  db.prepare("UPDATE o_user SET password = ? WHERE name = 'admin'").run(hash);
  db.close();
  process.exit(0);
} catch (e) {
  console.error("管理员密码设置失败: " + e.message);
  process.exit(1);
}
