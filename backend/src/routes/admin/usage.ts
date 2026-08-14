import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { requireAdmin } from "@/middleware/admin";
import { z } from "zod";
const router = express.Router();

// 平台用量总览：POST /api/admin/usage/summary
// 返回：总用户数、总充值、总消费、今日消费、本月消费、各 type 消费、近 7 天每日消费趋势
router.post("/summary", requireAdmin, async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const trendStart = todayStart - 6 * 86400000; // 含今天共 7 天

  const [userCount, rechargeRow, totalChargeRow, todayRow, monthRow] = await Promise.all([
    u.db("o_user").count({ c: "*" }).first(),
    u.db("o_recharge").where("status", "success").sum({ c: "amount" }).first(),
    u.db("o_usage_log").sum({ c: "charge" }).first(),
    u.db("o_usage_log").where("createTime", ">=", todayStart).sum({ c: "charge" }).first(),
    u.db("o_usage_log").where("createTime", ">=", monthStart).sum({ c: "charge" }).first(),
  ]);

  // 各 type（chat/image/video/tts）消费
  const byTypeRows: any[] = await u.db("o_usage_log").select("type").sum({ c: "charge" }).groupBy("type");
  const byType: Record<string, number> = {};
  for (const r of byTypeRows) if (r.type != null) byType[r.type] = Number(r.c ?? 0);

  // 近 7 天每日消费趋势（按本地自然日 JS 聚合）
  const trendRows: any[] = await u.db("o_usage_log").select("createTime", "charge").where("createTime", ">=", trendStart);
  const dailyTrend: { date: string; dateTime: number; charge: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = todayStart - i * 86400000;
    const dayEnd = dayStart + 86400000;
    let charge = 0;
    for (const r of trendRows) {
      const t = Number(r.createTime ?? 0);
      if (t >= dayStart && t < dayEnd) charge += Number(r.charge ?? 0);
    }
    const d = new Date(dayStart);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dailyTrend.push({ date: dateStr, dateTime: dayStart, charge });
  }

  res.status(200).send(
    success({
      totalUsers: Number((userCount as any)?.c ?? 0),
      totalRecharge: Number((rechargeRow as any)?.c ?? 0),
      totalCharge: Number((totalChargeRow as any)?.c ?? 0),
      todayCharge: Number((todayRow as any)?.c ?? 0),
      monthCharge: Number((monthRow as any)?.c ?? 0),
      byType,
      dailyTrend,
    }),
  );
});

// 用户消费排行：POST /api/admin/usage/users（按总消费倒序 top N，默认 20）
router.post(
  "/users",
  requireAdmin,
  validateFields({ n: z.number().optional() }),
  async (req, res) => {
    const n = Math.min(100, Math.max(1, Number(req.body?.n ?? 20) || 20));
    const rows: any[] = await u
      .db("o_usage_log")
      .select("userId")
      .sum({ totalCharge: "charge" })
      .count({ callCount: "*" })
      .groupBy("userId")
      .orderBy("totalCharge", "desc")
      .limit(n);

    const ids = rows.map((r) => r.userId).filter((id) => id != null);
    const users: any[] = ids.length
      ? await u.db("o_user").whereIn("id", ids).select("id", "name", "email", "nickname")
      : [];
    const userMap: Record<number, any> = {};
    for (const uu of users) userMap[uu.id] = uu;

    const list = rows.map((r) => ({
      userId: r.userId,
      name: userMap[r.userId]?.name ?? "",
      email: userMap[r.userId]?.email ?? "",
      nickname: userMap[r.userId]?.nickname ?? "",
      totalCharge: Number(r.totalCharge ?? 0),
      callCount: Number(r.callCount ?? 0),
    }));

    res.status(200).send(success({ list, total: list.length, n }));
  },
);

export default router;
