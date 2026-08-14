// utils/billing.ts
// 计费基础工具：余额查询 / 充值入账。
// 金额统一以"分"为单位的整数存储，避免浮点误差。
// 完整扣费（deductBalance）为预留接口，由后续计费模块实现。
import { Knex } from "knex";
// 使用真实 knex 实例执行事务（@/utils/db 默认导出的 dbClient 包装器未透传 transaction）
import { db as rawDb } from "@/utils/db";

export interface RechargeOptions {
  // 操作人（管理员/系统），为空表示用户自助充值
  operatorId?: number | string | null;
  // 备注
  remark?: string;
  // 充值方式，默认按 operatorId 推导：有 operatorId 为 manual_admin，否则 manual
  method?: string;
}

// 为用户增加余额（单位：分）。
// 在同一事务内写入 o_recharge 流水并更新 o_user.balance。
export async function addBalance(
  knex: Knex,
  userId: number | string,
  amount: number,
  operatorId: number | string | null = null,
  remark?: string,
): Promise<void> {
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error("充值金额必须为正数");
  }
  const userIdNum = Number(userId);
  const method = operatorId != null ? "manual_admin" : "manual";

  await rawDb.transaction(async (trx) => {
    await trx("o_recharge").insert({
      id: Date.now(),
      userId: userIdNum,
      amount: amountNum,
      method,
      operatorId: operatorId != null ? Number(operatorId) : null,
      status: "success",
      remark: remark ?? null,
      createTime: Date.now(),
    });
    await trx("o_user").where("id", userIdNum).increment("balance", amountNum);
  });
}

// 查询用户当前余额（单位：分）
export async function getBalance(knex: Knex, userId: number | string): Promise<number> {
  const row = await knex("o_user").where("id", Number(userId)).select("balance").first();
  if (!row) {
    const err: any = new Error(`用户不存在：${userId}`);
    err.status = 404;
    throw err;
  }
  return Number(row.balance ?? 0);
}

// 扣费明细参数：AI 调用侧（ai.ts 埋点）在扣费时传入，用于写 o_usage_log 用量明细。
export interface DeductOptions {
  projectId?: number | string | null;
  // 任务分类（如 scriptAgent / productionAgent / ttsDubbing 等）
  taskClass?: string | null;
  // 计费类型：chat/image/video/tts
  type?: string | null;
  model?: string | null;
  vendorId?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  // 图片张数 / 条目数（perImage/perItem）
  count?: number;
  // 视频时长（秒，perSecond）
  duration?: number;
  // 是否 BYOK（用户自带 key，扣费与否由调用方决定，仅记录）
  useUserKey?: boolean | number;
  remark?: string | null;
}

// 用户扣费（单位：分）。
// 在同一事务内：读取 o_user.balance 校验余额 → 余额不足抛错（含当前余额信息）→ 扣减余额 →
// 写一条 o_usage_log 用量明细（cost=amount 分，charge=amount 分，其余字段来自 opts）。
// SQLite 单写：检查与扣减在同一事务内完成，避免并发透支。
export async function deductBalance(
  _knex: Knex,
  userId: number | string,
  amount: number,
  options: DeductOptions = {},
): Promise<{ balance: number }> {
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum < 0) {
    throw new Error("扣费金额不合法");
  }
  const userIdNum = Number(userId);

  return rawDb.transaction(async (trx) => {
    const row = await trx("o_user").where("id", userIdNum).select("balance").first();
    if (!row) {
      const err: any = new Error(`用户不存在：${userId}`);
      err.status = 404;
      throw err;
    }
    const balance = Number(row.balance ?? 0);
    if (balance < amountNum) {
      const err: any = new Error(`余额不足，请先充值（当前余额 ${balance} 分，本次需 ${amountNum} 分）`);
      err.status = 400;
      err.balance = balance;
      throw err;
    }

    await trx("o_user").where("id", userIdNum).decrement("balance", amountNum);
    // id 省略，由 SQLite 自增 rowid 分配，避免高频并发下 Date.now() 撞唯一约束
    await trx("o_usage_log").insert({
      userId: userIdNum,
      projectId: options.projectId != null ? Number(options.projectId) : null,
      taskClass: options.taskClass ?? null,
      type: options.type ?? null,
      model: options.model ?? null,
      vendorId: options.vendorId ?? null,
      inputTokens: options.inputTokens != null ? Number(options.inputTokens) : 0,
      outputTokens: options.outputTokens != null ? Number(options.outputTokens) : 0,
      count: options.count != null ? Number(options.count) : 0,
      duration: options.duration != null ? Number(options.duration) : 0,
      cost: amountNum,
      charge: amountNum,
      useUserKey: options.useUserKey ? 1 : 0,
      createTime: Date.now(),
    });

    return { balance: balance - amountNum };
  });
}
