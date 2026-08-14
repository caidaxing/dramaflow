import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

// 价格管理（仅 admin）：o_price 的查询 / 增改 / 启停 / 删除
// 全部子接口均校验 admin，非 admin 返回 403。

function requireAdmin(req: express.Request, res: express.Response): boolean {
  if (req.user.role !== "admin") {
    res.status(403).send(error("无权限"));
    return false;
  }
  return true;
}

// 列表：返回全部 o_price（GET/POST 均可）
router.all("/", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const list = await u.db("o_price").orderBy("type", "asc").orderBy("vendorId", "asc").orderBy("model", "asc");
  res.status(200).send(success({ list }));
});

// 新增 / 修改：按 (type,vendorId,model) 唯一约束 upsert
router.post(
  "/upsert",
  validateFields({
    type: z.string(),
    vendorId: z.string(),
    model: z.string(),
    pricePerUnit: z.number(),
    unit: z.string(),
    enabled: z.union([z.boolean(), z.number()]).optional(),
  }),
  async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { type, vendorId, model, pricePerUnit, unit } = req.body;
    const enabled = req.body.enabled == null ? true : !!req.body.enabled;
    const now = Date.now();

    const exist = await u
      .db("o_price")
      .where({ type, vendorId, model })
      .first();
    if (exist) {
      await u
        .db("o_price")
        .where("id", exist.id)
        .update({ pricePerUnit, unit, enabled, updateTime: now });
    } else {
      await u.db("o_price").insert({
        type,
        vendorId,
        model,
        pricePerUnit,
        unit,
        enabled: !!enabled,
        createTime: now,
        updateTime: now,
      });
    }
    res.status(200).send(success(null, "保存成功"));
  },
);

// 启停：id + enabled
router.post(
  "/setEnabled",
  validateFields({
    id: z.number(),
    enabled: z.union([z.boolean(), z.number()]),
  }),
  async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { id, enabled } = req.body;
    const exist = await u.db("o_price").where("id", id).first();
    if (!exist) return res.status(400).send(error("价格记录不存在"));
    await u
      .db("o_price")
      .where("id", id)
      .update({ enabled: !!enabled, updateTime: Date.now() });
    res.status(200).send(success(null, "更新成功"));
  },
);

// 删除：id
router.post(
  "/del",
  validateFields({
    id: z.number(),
  }),
  async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { id } = req.body;
    await u.db("o_price").where("id", id).del();
    res.status(200).send(success(null, "删除成功"));
  },
);

export default router;
