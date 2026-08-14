import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { requireAdmin } from "@/middleware/admin";
const router = express.Router();

// 充值订单分页：GET/POST /api/admin/orders
// 参数：page/pageSize，userId/status 筛选；按 createTime 时间倒序。
// 返回 o_recharge 全部字段 + 关联用户名(userName)/邮箱(userEmail)
async function listOrders(req: express.Request): Promise<{ list: any[]; total: number; page: number; pageSize: number }> {
  const src: any = req.method === "GET" ? req.query : req.body;
  const page = Math.max(1, Number(src.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(src.pageSize ?? 10) || 10));
  const userId = src.userId != null ? Number(src.userId) : null;
  const status = src.status != null ? String(src.status) : "";

  let base = u.db("o_recharge").leftJoin("o_user", "o_user.id", "o_recharge.userId");
  if (userId != null && !Number.isNaN(userId)) base = base.where("o_recharge.userId", userId);
  if (status) base = base.where("o_recharge.status", status);

  const totalRow = await base.clone().count({ c: "o_recharge.id" }).first();
  const total = Number((totalRow as any)?.c ?? 0);

  const list = await base
    .select("o_recharge.*", "o_user.name as userName", "o_user.email as userEmail")
    .orderBy("o_recharge.createTime", "desc")
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { list, total, page, pageSize };
}

router.get("/", requireAdmin, async (req, res) => {
  res.status(200).send(success(await listOrders(req)));
});

router.post("/", requireAdmin, async (req, res) => {
  res.status(200).send(success(await listOrders(req)));
});

export default router;
