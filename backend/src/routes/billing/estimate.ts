import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

// 估价：根据 type/vendorId/model + 用量参数预估本次费用（单位：分）
export default router.post(
  "/",
  validateFields({
    type: z.string(),
    vendorId: z.string(),
    model: z.string(),
    params: z
      .object({
        tokens: z.number().optional(),
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        count: z.number().optional(),
        duration: z.number().optional(),
      })
      .optional(),
  }),
  async (req, res) => {
    const { type, vendorId, model, params = {} } = req.body;
    const estimate = await u.pricing.calcEstimate(u.db, type, vendorId, model, params);
    if (estimate.cost == null) {
      return res.status(200).send(
        success(estimate, "该模型未配置价格"),
      );
    }
    res.status(200).send(success(estimate, "估价成功"));
  },
);
