import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { id } from "zod/locales";
const router = express.Router();

// 批量删除资产
export default router.post(
  "/",
  validateFields({
    id: z.array(z.number()),
  }),
  async (req, res) => {
    const { id } = req.body;
    const rows = await u.db("o_assets").whereIn("id", id).select("projectId");
    const projectIds = Array.from(new Set(rows.map((r: any) => r.projectId)));
    for (const projectId of projectIds) {
      await u.tenant.assertProjectOwner(u.db, projectId, req.user.id);
    }
    await u.db("o_assets").whereIn("id", id).delete();
    res.status(200).send(success({ message: "删除资产成功" }));
  },
);
