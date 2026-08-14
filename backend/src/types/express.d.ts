// Express Request 类型增强：鉴权中间件（app.ts）会把解析后的 token payload 挂到 req.user
import "express";

declare global {
  namespace Express {
    interface Request {
      user: { id: number; name?: string; role?: string };
    }
  }
}

export {};
