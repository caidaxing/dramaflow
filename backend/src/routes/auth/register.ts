import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

// 注册（默认开放；若 o_setting.registerOpen === "0" 则关闭）
export default router.post(
  "/",
  validateFields({
    username: z.string().min(1),
    password: z.string().min(6).max(20),
    email: z
      .string()
      .email()
      .or(z.literal(""))
      .optional(),
    nickname: z.string().optional(),
  }),
  async (req, res) => {
    const { username, password, email, nickname } = req.body;

    // 注册开关：o_setting.registerOpen 为 "0" 时拒绝注册（读不到默认开放）
    const registerSetting = await u.db("o_setting").where("key", "registerOpen").first();
    if (registerSetting && registerSetting.value === "0") {
      return res.status(400).send(error("暂未开放注册"));
    }

    // 用户名查重
    const exist = await u.db("o_user").where("name", "=", username).first();
    if (exist) return res.status(400).send(error("用户名已存在"));

    // 邮箱查重（选填）
    if (email) {
      const emailExist = await u.db("o_user").where("email", "=", email).first();
      if (emailExist) return res.status(400).send(error("邮箱已被使用"));
    }

    const hash = await u.auth.hashPassword(password);
    await u.db("o_user").insert({
      id: Date.now(),
      name: username,
      password: hash,
      email: email || null,
      nickname: nickname || username,
      role: "user",
      status: "enabled",
      balance: 0,
      createTime: Date.now(),
    });

    return res.status(200).send(success(null, "注册成功"));
  },
);
