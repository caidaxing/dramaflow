import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

// 充值流水：当前用户自己的记录；admin 可传 userId 查看指定用户，或不传查看全部。按时间倒序。
export default router.post(
  "/",
  validateFields({
    userId: z.number().optional(),
  }),
  async (req, res) => {
    const { userId } = req.body;
    let query = u.db("o_recharge");
    if (req.user.role === "admin") {
      if (userId != null) query = query.where("userId", userId);
    } else {
      query = query.where("userId", req.user.id);
    }
    const list = await query.orderBy("createTime", "desc");
    res.status(200).send(success({ list }));
  },
);
