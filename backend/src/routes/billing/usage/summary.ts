import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
const router = express.Router();

// 当前用户用量汇总：总花费、本月花费、各 type 花费（单位：分，按 charge 统计）
export default router.post("/", async (req, res) => {
  const userId = req.user.id;

  const [totalRow, monthRow] = await Promise.all([
    u.db("o_usage_log").where("userId", userId).sum({ c: "charge" }).first(),
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return u
        .db("o_usage_log")
        .where("userId", userId)
        .where("createTime", ">=", monthStart)
        .sum({ c: "charge" })
        .first();
    })(),
  ]);

  const byTypeRows = await u
    .db("o_usage_log")
    .where("userId", userId)
    .select("type")
    .sum({ c: "charge" })
    .groupBy("type");

  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    if (row.type != null) byType[row.type] = Number(row.c ?? 0);
  }

  res.status(200).send(
    success({
      total: Number((totalRow as any)?.c ?? 0),
      month: Number((monthRow as any)?.c ?? 0),
      byType,
    }),
  );
});
