// utils/tenant.ts
// 租户隔离工具：项目归属校验。
// 供多租户隔离模块使用，任何需要校验"某项目属于某用户"的接口均可调用。
import { Knex } from "knex";

// 校验指定项目存在且归属于当前用户。
// 不满足时抛出带明确中文信息与 status 的错误（与后端全局错误处理 err.status 约定一致）。
export async function assertProjectOwner(
  knex: Knex,
  projectId: number | string | null | undefined,
  userId: number | string,
): Promise<void> {
  if (projectId == null) {
    const err: any = new Error("项目不存在");
    err.status = 404;
    throw err;
  }
  const project = await knex("o_project")
    .where("id", projectId)
    .select("id", "userId")
    .first();

  if (!project) {
    const err: any = new Error(`项目不存在：${projectId}`);
    err.status = 404;
    throw err;
  }

  if (Number(project.userId) !== Number(userId)) {
    const err: any = new Error(`无权访问项目：${projectId}（该项目不属于当前用户）`);
    err.status = 403;
    throw err;
  }
}
