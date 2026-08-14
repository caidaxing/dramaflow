import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 编辑剧本
export default router.post(
  "/",
  validateFields({
    id: z.number(),
    name: z.string(),
    content: z.string(),
    assets: z.array(z.number()),
  }),
  async (req, res) => {
    const { id, name, content, assets } = req.body;
    const script = await u.db("o_script").where("id", id).select("projectId").first();
    if (!script) return res.status(404).send(success({ message: "剧本不存在" }));
    await u.tenant.assertProjectOwner(u.db, script.projectId, req.user.id);
    await u.db("o_script").where({ id }).update({
      name,
      content,
    });
    if (assets.length) {
      const assetsData = await u.db("o_assets").whereIn("id", assets).select();
      await u.db("o_scriptAssets").where({ scriptId: id }).delete();
      if (assetsData.length) {
        const insertData = assetsData.map((item) => {
          return {
            scriptId: id,
            assetId: item.id,
          };
        });
        await u.db("o_scriptAssets").insert(insertData);
      }
    }

    res.status(200).send(success({ message: "编辑剧本成功" }));
  },
);
