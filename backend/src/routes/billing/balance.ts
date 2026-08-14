import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
const router = express.Router();

// 查询当前用户余额（单位：分）
export default router.post("/", async (req, res) => {
  const balance = await u.billing.getBalance(u.db, req.user.id);
  res.status(200).send(success({ balance }));
});
