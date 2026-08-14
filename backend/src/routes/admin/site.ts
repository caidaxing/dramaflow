import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { requireAdmin } from "@/middleware/admin";
import { z } from "zod";
const router = express.Router();

// 站点配置可编辑键（品牌化/白标）
const SITE_KEYS = ["siteName", "logoUrl", "primaryColor", "icpNo", "customerService", "registerOpen", "announcement"] as const;

// 读取站点配置（返回 key-value 对象 + 原始行列表）
async function getSiteConfig(): Promise<{ config: Record<string, string>; list: any[] }> {
  const rows: any[] = await (u.db as any)("o_site_config").select("key", "value", "updateTime");
  const config: Record<string, string> = {};
  for (const r of rows) config[r.key] = r.value ?? "";
  return { config, list: rows };
}

// 管理端读取：POST /api/admin/site/get（管理员视角可看全）
router.post("/get", requireAdmin, async (req, res) => {
  res.status(200).send(success(await getSiteConfig()));
});

// 批量更新站点配置：POST /api/admin/site/update
router.post(
  "/update",
  requireAdmin,
  validateFields({
    siteName: z.string().optional(),
    logoUrl: z.string().optional(),
    primaryColor: z.string().optional(),
    icpNo: z.string().optional(),
    customerService: z.string().optional(),
    registerOpen: z.enum(["0", "1"]).optional(),
    announcement: z.string().optional(),
  }),
  async (req, res) => {
    const updates = SITE_KEYS.filter((key) => req.body[key] != null);
    if (updates.length === 0) return res.status(400).send(error("没有要更新的配置"));

    for (const key of updates) {
      const existing: any = await (u.db as any)("o_site_config").where("key", key).first();
      if (existing) {
        await (u.db as any)("o_site_config")
          .where("key", key)
          .update({ value: String(req.body[key]), updateTime: Date.now() });
      } else {
        await (u.db as any)("o_site_config").insert({ id: Date.now(), key, value: String(req.body[key]), updateTime: Date.now() });
      }
    }

    // 联动：注册开关同步到 o_setting（注册接口读取 o_setting.registerOpen 判断是否开放）
    if (req.body.registerOpen != null) {
      const setting = await u.db("o_setting").where("key", "registerOpen").first();
      if (setting) {
        await u.db("o_setting").where("key", "registerOpen").update({ value: String(req.body.registerOpen) });
      } else {
        await u.db("o_setting").insert({ key: "registerOpen", value: String(req.body.registerOpen) });
      }
    }

    res.status(200).send(success(await getSiteConfig(), "更新成功"));
  },
);

export default router;
