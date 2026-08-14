import { Request, Response, NextFunction } from "express";
import { error } from "@/lib/responseFormat";

// 运营后台接口统一鉴权中间件：仅 admin 角色可访问，否则返回 403。
// 用法：router.post("/xxx", requireAdmin, handler)
// 依赖 app.ts 的 JWT 中间件已把解码后的 payload 挂到 req.user（含 role）。
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).send(error("无权限"));
    return;
  }
  next();
}
