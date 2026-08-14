import express from "express";
import u from "@/utils";
import jwt from "jsonwebtoken";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

export function setToken(payload: string | object, expiresIn: string | number, secret: string): string {
  if (!payload || typeof secret !== "string" || !secret) {
    throw new Error("参数不合法");
  }
  return (jwt.sign as any)(payload, secret, { expiresIn });
}

// 登录
export default router.post(
  "/",
  validateFields({
    username: z.string(),
    password: z.string(),
  }),
  async (req, res) => {
    const { username, password } = req.body;

    const data = await u.db("o_user").where("name", "=", username).first();
    if (!data) return res.status(400).send(error("用户名或密码错误"));

    // 账号禁用检查
    if (data!.status === "disabled") return res.status(400).send(error("账号已被禁用"));

    // 密码校验（兼容 bcrypt hash 与存量明文）
    const ok = await u.auth.verifyPassword(password, data!.password);
    if (!ok) return res.status(400).send(error("用户名或密码错误"));

    const tokenData = await u.db("o_setting").where("key", "tokenKey").first();
    if (!tokenData) return res.status(400).send(error("未找到tokenKey"));
    const token = setToken(
      {
        id: data!.id,
        name: data!.name,
        role: data!.role,
      },
      "180Days",
      tokenData?.value as string,
    );

    return res
      .status(200)
      .send(
        success(
          {
            token: "Bearer " + token,
            name: data!.name,
            id: data!.id,
            role: data!.role,
            email: data!.email,
          },
          "登录成功",
        ),
      );
  },
);
