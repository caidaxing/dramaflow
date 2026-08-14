import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { requireAdmin } from "@/middleware/admin";
import { z } from "zod";
const router = express.Router();

// 用户分页列表：GET/POST /api/admin/users
// 参数：page/pageSize（默认 1/10），keyword 或 name/email 模糊搜索；按 createTime 时间倒序。
// 每项含 {id,name,email,nickname,role,status,balance,createTime} + 用量汇总(总消费 totalCharge、调用次数 callCount)
async function listUsers(req: express.Request): Promise<{ list: any[]; total: number; page: number; pageSize: number }> {
  const src: any = req.method === "GET" ? req.query : req.body;
  const page = Math.max(1, Number(src.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(src.pageSize ?? 10) || 10));
  const keyword = String(src.keyword ?? src.name ?? "").trim();

  let base = u.db("o_user");
  if (keyword) {
    const like = `%${keyword}%`;
    base = base.where((qb) => {
      qb.where("name", "like", like).orWhere("email", "like", like).orWhere("nickname", "like", like);
    });
  }

  const totalRow = await base.clone().count({ c: "*" }).first();
  const total = Number((totalRow as any)?.c ?? 0);
  const rows: any[] = await base.orderBy("createTime", "desc").limit(pageSize).offset((page - 1) * pageSize);

  // 用量汇总：按 userId 聚合总消费(charge)与调用次数
  const usageRows: any[] = await u
    .db("o_usage_log")
    .select("userId")
    .sum({ totalCharge: "charge" })
    .count({ callCount: "*" })
    .groupBy("userId");
  const usageMap: Record<number, { totalCharge: number; callCount: number }> = {};
  for (const r of usageRows) {
    if (r.userId != null) {
      usageMap[r.userId] = { totalCharge: Number(r.totalCharge ?? 0), callCount: Number(r.callCount ?? 0) };
    }
  }

  const list = rows.map((row: any) => {
    const { password, ...user } = row;
    const usage = usageMap[row.id] ?? { totalCharge: 0, callCount: 0 };
    return { ...user, totalCharge: usage.totalCharge, callCount: usage.callCount };
  });
  return { list, total, page, pageSize };
}

router.get("/", requireAdmin, async (req, res) => {
  res.status(200).send(success(await listUsers(req)));
});

router.post("/", requireAdmin, async (req, res) => {
  res.status(200).send(success(await listUsers(req)));
});

// 更新用户：POST /api/admin/users/update —— 改角色/禁用/启用/昵称
router.post(
  "/update",
  requireAdmin,
  validateFields({
    userId: z.number(),
    role: z.enum(["admin", "user"]).optional(),
    status: z.enum(["enabled", "disabled"]).optional(),
    nickname: z.string().optional(),
  }),
  async (req, res) => {
    const { userId, role, status, nickname } = req.body;
    const target = await u.db("o_user").where("id", userId).first();
    if (!target) return res.status(400).send(error("用户不存在"));

    const update: any = {};
    if (role != null) update.role = role;
    if (status != null) update.status = status;
    if (nickname != null) update.nickname = nickname;
    if (Object.keys(update).length === 0) return res.status(400).send(error("没有要更新的字段"));

    // 防呆：管理员不能把自己禁用或降级，避免锁死后台
    if (Number(userId) === Number(req.user.id)) {
      if (status === "disabled") return res.status(400).send(error("不能禁用当前登录的管理员账号"));
      if (role === "user") return res.status(400).send(error("不能将当前登录的管理员降级"));
    }

    await u.db("o_user").where("id", userId).update(update);
    res.status(200).send(success({ id: userId, ...update }, "更新成功"));
  },
);

// 加余额：POST /api/admin/users/add-balance（复用 u.billing.addBalance，写 o_recharge 流水）
router.post(
  "/add-balance",
  requireAdmin,
  validateFields({
    userId: z.number(),
    amount: z.number(),
    remark: z.string().optional(),
  }),
  async (req, res) => {
    const { userId, amount, remark } = req.body;
    const target = await u.db("o_user").where("id", userId).first();
    if (!target) return res.status(400).send(error("用户不存在"));
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).send(error("充值金额必须为正数"));
    }
    await u.billing.addBalance(u.db, userId, Number(amount), req.user.id, remark);
    const balance = await u.billing.getBalance(u.db, userId);
    res.status(200).send(success({ userId, balance }, "充值成功"));
  },
);

export default router;
