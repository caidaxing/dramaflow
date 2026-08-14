import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
  }),
  async (req, res) => {
    const { id } = req.body;

    const eventChapter = await u.db("o_eventChapter").where("eventId", id).select("novelId").first();
    if (eventChapter) {
      const novel = await u.db("o_novel").where("id", eventChapter.novelId).select("projectId").first();
      if (novel) await u.tenant.assertProjectOwner(u.db, novel.projectId, req.user.id);
    }
    await u.db("o_event").where("id", id).del();
    await u.db("o_eventChapter").where("eventId", id).del();

    res.status(200).send(success({ message: "删除事件成功" }));
  },
);
