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

    const eventChapters = await u.db("o_eventChapter").whereIn("eventId", ids).select("novelId");
    const novelIds = Array.from(new Set(eventChapters.map((ec: any) => ec.novelId)));
    if (novelIds.length) {
      const novelRows = await u.db("o_novel").whereIn("id", novelIds).select("projectId");
      const projectIds = Array.from(new Set(novelRows.map((n: any) => n.projectId)));
      for (const projectId of projectIds) {
        await u.tenant.assertProjectOwner(u.db, projectId, req.user.id);
      }
    }
    await u.db("o_event").whereIn("id", ids).del();
    await u.db("o_eventChapter").whereIn("eventId", ids).del();

    res.status(200).send(success({ message: "删除事件成功" }));
  },
);
