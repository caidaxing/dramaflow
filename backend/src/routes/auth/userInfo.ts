import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
const router = express.Router();

// 获取当前登录用户信息（不含 password）
export default router.post("/", async (req, res) => {
  const user = await u.db("o_user").where("id", req.user.id).first();
  if (!user) return res.status(400).send(error("用户不存在"));

  const { password, ...info } = user;
  res.status(200).send(success(info));
});
