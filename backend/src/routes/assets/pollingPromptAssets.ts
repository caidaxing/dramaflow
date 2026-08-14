import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    ids: z.array(z.number()),
  }),
  async (req, res) => {
    const { ids } = req.body;
    const rows = await u.db("o_assets").whereIn("id", ids).select("projectId");
    const projectIds = Array.from(new Set(rows.map((r: any) => r.projectId)));
    for (const projectId of projectIds) {
      await u.tenant.assertProjectOwner(u.db, projectId, req.user.id);
    }
    const data = await u.db("o_assets").whereIn("id", ids).whereNot("promptState", "生成中").select("*");
    res.status(200).send(success(data));
  },
);
