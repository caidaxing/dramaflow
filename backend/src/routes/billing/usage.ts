import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

// 当前用户用量明细（分页，时间倒序），返回 { list, total }
export default router.post(
  "/",
  validateFields({
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).optional(),
  }),
  async (req, res) => {
    const page = req.body.page ?? 1;
    const pageSize = req.body.pageSize ?? 20;

    const base = u.db("o_usage_log").where("userId", req.user.id);
    const total = Number(((await base.clone().count({ c: "*" }).first()) as any)?.c ?? 0);
    const list = await base
      .orderBy("createTime", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    res.status(200).send(success({ list, total }));
  },
);
