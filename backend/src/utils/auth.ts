// utils/auth.ts
// 密码哈希工具：封装 bcryptjs（纯 JS 实现，避免原生编译）。
// 提供 bcrypt 哈希 / 校验，并兼容存量明文密码（迁移未完成时可直接比对明文）。
import bcrypt from "bcryptjs";

const BCRYPT_PREFIX = "$2";

// 判断存储的密码是否为 bcrypt 格式（bcrypt 哈希以 $2a/$2b/$2y 等开头）
export function isBcryptHash(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(BCRYPT_PREFIX);
}

// 生成 bcrypt 哈希
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

// 校验密码：
// - 若 stored 为 bcrypt 格式，使用 bcrypt.compare
// - 若 stored 为明文（存量数据，迁移未跑完），直接比较明文
// 返回 true 时，调用方可用 needsPasswordMigration(stored) 判断是否需要触发密码迁移
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  if (isBcryptHash(stored)) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

// 是否需要对存量明文密码进行迁移
export function needsPasswordMigration(stored: string | null | undefined): boolean {
  return !!stored && !isBcryptHash(stored);
}
