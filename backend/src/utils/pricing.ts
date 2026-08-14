// utils/pricing.ts
// 价格工具：查询 o_price 单价、按 unit 计算成本/估价。
// 金额统一以"分"为单位的整数，价格表 pricePerUnit 存"每计价单位的单价（分）"。
import { Knex } from "knex";

export interface PriceRow {
  id: number;
  type: string;
  vendorId: string;
  model: string;
  pricePerUnit: number;
  unit: string;
  enabled: boolean | number;
}

// 成本计算入参（三者按需取其一，取决于 unit）：
// - tokens: 总 token 数（或使用 inputTokens + outputTokens）
// - count: 图片张数 / 条目数
// - duration: 视频时长（秒）
export interface CostParams {
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  count?: number;
  duration?: number;
}

// 查询模型单价。
// 匹配顺序：精确 (type,vendorId,model) → (type,vendorId,'*') → 全局兜底 (type,'*','*') → null；
// 只取 enabled=1 的价格。
export async function getModelPrice(
  knex: Knex,
  type: string,
  vendorId: string,
  model: string,
): Promise<PriceRow | null> {
  const base = knex("o_price")
    .where("type", type)
    .where("enabled", true);
  const exact = await base.clone().where("vendorId", vendorId).where("model", model).first();
  if (exact) return exact as PriceRow;
  const vendorFallback = await base.clone().where("vendorId", vendorId).where("model", "*").first();
  if (vendorFallback) return vendorFallback as PriceRow;
  const globalFallback = await base.clone().where("vendorId", "*").where("model", "*").first();
  return (globalFallback as PriceRow) ?? null;
}

// 纯计算：给定价格行与用量参数，按 unit 计算成本（分，四舍五入为整数）。
// - per1kToken → (tokens / 1000) * price
// - perImage → count * price
// - perSecond → duration * price
// - perItem → 1 * price
export function computeCost(price: PriceRow, params: CostParams): number {
  const per = Number(price.pricePerUnit) || 0;
  switch (price.unit) {
    case "per1kToken": {
      const tokens =
        Number(params.tokens) ||
        (Number(params.inputTokens) || 0) + (Number(params.outputTokens) || 0);
      return Math.round((tokens / 1000) * per);
    }
    case "perImage":
      return Math.round((Number(params.count) || 0) * per);
    case "perSecond":
      return Math.round((Number(params.duration) || 0) * per);
    case "perItem":
      return Math.round(per);
    default:
      return 0;
  }
}

// 计算成本（分）：内部查价后调用 computeCost；无价格返回 null。
export async function calcCost(
  knex: Knex,
  type: string,
  vendorId: string,
  model: string,
  params: CostParams,
): Promise<number | null> {
  const price = await getModelPrice(knex, type, vendorId, model);
  if (!price) return null;
  return computeCost(price, params);
}

// 预估价：给前端 estimate 使用。容忍无价格（cost 为 null），并附带价格信息。
export async function calcEstimate(
  knex: Knex,
  type: string,
  vendorId: string,
  model: string,
  params: CostParams,
): Promise<{
  cost: number | null;
  pricePerUnit: number | null;
  unit: string | null;
  modelName: string;
}> {
  const price = await getModelPrice(knex, type, vendorId, model);
  if (!price) {
    return { cost: null, pricePerUnit: null, unit: null, modelName: model };
  }
  return {
    cost: computeCost(price, params),
    pricePerUnit: Number(price.pricePerUnit),
    unit: price.unit,
    modelName: model,
  };
}
