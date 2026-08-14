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
    const scriptRows = await u.db("o_script").whereIn("id", ids).select("projectId");
    const projectIds = Array.from(new Set(scriptRows.map((s: any) => s.projectId)));
    for (const projectId of projectIds) {
      await u.tenant.assertProjectOwner(u.db, projectId, req.user.id);
    }
    const data = await u.db("o_script").whereIn("id", ids).whereNot("extractState", "生成中").select("id", "extractState", "errorReason");
    res.status(200).send(success(data));
  },
);
