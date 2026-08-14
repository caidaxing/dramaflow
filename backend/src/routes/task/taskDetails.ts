import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    taskId: z.number(),
  }),
  async (req, res) => {
    const { taskId } = req.body;
    const task = await u.db("o_tasks").where("id", taskId).select("projectId", "userId").first();
    if (!task) return res.status(404).send(success(null));
    const { role } = req.user as any;
    if (role !== "admin" && Number(task.userId) !== Number(req.user.id)) {
      return res.status(403).send(success(null));
    }
    const data = await u.db("o_tasks").where("id", taskId).select("*").first();
    res.status(200).send(success(data));
  }
);
