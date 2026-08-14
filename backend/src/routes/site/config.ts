import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
const router = express.Router();

// 公开站点配置：GET/POST /api/site/config（无需登录，供前端动态品牌使用）
// 返回 { config: {siteName, logoUrl, primaryColor, ...}, list: [{key,value},...] }
async function getPublicConfig(): Promise<{ config: Record<string, string>; list: { key: string; value: string }[] }> {
  const rows: any[] = await (u.db as any)("o_site_config").select("key", "value");
  const config: Record<string, string> = {};
  for (const r of rows) config[r.key] = r.value ?? "";
  return { config, list: rows.map((r) => ({ key: r.key, value: r.value ?? "" })) };
}

router.get("/", async (req, res) => {
  res.status(200).send(success(await getPublicConfig()));
});

router.post("/", async (req, res) => {
  res.status(200).send(success(await getPublicConfig()));
});

export default router;
