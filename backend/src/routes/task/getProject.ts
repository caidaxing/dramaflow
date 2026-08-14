import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
const router = express.Router();

export default router.post("/", async (req, res) => {
  const { role } = req.user as any;
  let query = u.db("o_project").select("id", "name");
  // 管理员可查看全部项目，普通用户只能查看自己的项目
  if (role !== "admin") {
    query = query.where("userId", req.user.id);
  }
  const list = await query.groupBy("name");
  const data = list.filter((item) => item.name);
  res.status(200).send(success(data));
});
