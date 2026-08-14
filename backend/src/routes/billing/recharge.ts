import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

// 充值（仅 admin）：给指定用户增加余额（单位：分），并写 o_recharge 流水
export default router.post(
  "/",
  validateFields({
    userId: z.number(),
    amount: z.number(),
    remark: z.string().optional(),
  }),
  async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).send(error("无权限"));
    }
    const { userId, amount, remark } = req.body;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).send(error("充值金额必须为正数"));
    }
    const target = await u.db("o_user").where("id", userId).first();
    if (!target) return res.status(400).send(error("用户不存在"));

    await u.billing.addBalance(u.db, userId, Number(amount), req.user.id, remark);
    const balance = await u.billing.getBalance(u.db, userId);
    res.status(200).send(success({ balance }, "充值成功"));
  },
);
