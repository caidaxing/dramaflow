import express from "express";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { z } from "zod";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
    data: z.object({
      storySkeleton: z.string(),
      adaptationStrategy: z.string(),
      script: z.array(
        z.object({
          id: z.number(),
          content: z.string(),
        }),
      ),
    }),
  }),
  async (req, res) => {
    const { id, data } = req.body;
    const work = await u.db("o_agentWorkData").where("id", id).select("projectId").first();
    if (!work) return res.status(404).send(success("数据不存在"));
    await u.tenant.assertProjectOwner(u.db, work.projectId, req.user.id);
    await u
      .db("o_agentWorkData")
      .where({ id: id })
      .update({
        data: JSON.stringify(data),
      });
    res.status(200).send(success("更新成功"));
  },
);
