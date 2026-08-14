import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    edges: z.any(),
    nodes: z.any(),
    flowId: z.number(),
  }),
  async (req, res) => {
    const { edges, nodes, flowId } = req.body;
    const flowRow = await u.db("o_storyboard").where("flowId", flowId).select("projectId").first();
    const flowRow2 = flowRow ? null : await u.db("o_assets").where("flowId", flowId).select("projectId").first();
    const projectId = flowRow?.projectId ?? flowRow2?.projectId;
    if (projectId != null) await u.tenant.assertProjectOwner(u.db, projectId, req.user.id);
    nodes.forEach((node: any) => {
      if (node.type == "upload") {
        node.data.image = node.data.image ? u.replaceUrl(node.data.image) : "";
      }

      if (node.type == "generated") {
        node.data.generatedImage = node.data.generatedImage ? u.replaceUrl(node.data.generatedImage) : "";
        node.data.references.forEach((item: { image: string }) => {
          item.image = item.image ? u.replaceUrl(item.image) : "";
        });
      }
    });

    await u
      .db("o_imageFlow")
      .where("id", flowId)
      .update({
        flowData: JSON.stringify({ edges, nodes }),
      });
    return res.status(200).send(success());
  },
);
