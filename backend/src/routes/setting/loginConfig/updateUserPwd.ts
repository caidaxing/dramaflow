import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    name: z.string(),
    password: z.string(),
    oldPassword: z.string(),
    id: z.number(),
  }),
  async (req, res) => {
    const { name, password, oldPassword, id } = req.body;
    const user = await u.db("o_user").where("id", id).first();
    if (!user) return res.status(400).send(error("用户不存在"));

    // 校验旧密码（兼容 bcrypt hash 与存量明文）
    const ok = await u.auth.verifyPassword(oldPassword, user.password);
    if (!ok) return res.status(400).send(error("旧密码错误"));

    // 新密码以 bcrypt hash 存储
    const hash = await u.auth.hashPassword(password);
    await u.db("o_user").where("id", id).update({
      name,
      password: hash,
    });
    res.status(200).send(success("保存设置成功"));
  },
);
