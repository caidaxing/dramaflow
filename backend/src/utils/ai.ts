import { generateText, streamText, wrapLanguageModel, stepCountIs, extractReasoningMiddleware } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import axios from "axios";
import { transform } from "sucrase";
import u from "@/utils";

type AiType =
  | "scriptAgent"
  | "productionAgent"
  | "universalAi"
  | "scriptAgent:decisionAgent"
  | "scriptAgent:supervisionAgent"
  | "scriptAgent:storySkeletonAgent"
  | "scriptAgent:adaptationStrategyAgent"
  | "scriptAgent:scriptAgent"
  | "productionAgent:decisionAgent"
  | "productionAgent:supervisionAgent"
  | "productionAgent:deriveAssetsAgent"
  | "productionAgent:generateAssetsAgent"
  | "productionAgent:directorPlanAgent"
  | "productionAgent:storyboardGenAgent"
  | "productionAgent:storyboardPanelAgent"
  | "productionAgent:storyboardTableAgent";

type FnName = "textRequest" | "imageRequest" | "videoRequest" | "ttsRequest";

const AiTypeValues: AiType[] = [
  "scriptAgent",
  "productionAgent",
  "universalAi",
  "scriptAgent:decisionAgent",
  "scriptAgent:supervisionAgent",
  "scriptAgent:storySkeletonAgent",
  "scriptAgent:adaptationStrategyAgent",
  "scriptAgent:scriptAgent",
  "productionAgent:decisionAgent",
  "productionAgent:supervisionAgent",
  "productionAgent:deriveAssetsAgent",
  "productionAgent:generateAssetsAgent",
  "productionAgent:directorPlanAgent",
  "productionAgent:storyboardGenAgent",
  "productionAgent:storyboardPanelAgent",
  "productionAgent:storyboardTableAgent",
  "universalAi",
];
async function resolveModelName(value: AiType | `${string}:${string}`): Promise<`${string}:${string}`> {
  if (AiTypeValues.includes(value as AiType)) {
    const agentUseModeVal = await u.db("o_setting").where("key", "agentUseMode").first();

    //正常流程
    //高级配置
    if (agentUseModeVal?.value == "1") {
      const agentDeployData = await u.db("o_agentDeploy").where("key", value).first();
      if (!agentDeployData?.modelName) throw new Error(`高级配置模式下，未找到对应的模型配置 ${value}`);
      return agentDeployData?.modelName as `${number}:${string}`;
    }
    //简易配置
    if (agentUseModeVal?.value == "0") {
      const [mainly] = value!.split(/:(.+)/);
      const mainlyData = await u.db("o_agentDeploy").where("key", mainly).first();
      if (!mainlyData?.modelName) throw new Error(`简易配置模式下，未找到部署配置 ${value}`);
      return mainlyData?.modelName as `${number}:${string}`;
    }

    //未查到agentUseModeVal 维持原判断
    const agentDeployData = await u.db("o_agentDeploy").where("key", value).first();
    let modelName = null;

    if (!agentDeployData?.modelName) {
      const [mainly] = agentDeployData!.key!.split(/:(.+)/);
      const mainlyData = await u.db("o_agentDeploy").where("key", mainly).first();
      if (!mainlyData?.modelName) throw new Error(`未找到部署配置 ${value}`);
      modelName = mainlyData.modelName;
    }
    modelName = agentDeployData?.modelName || modelName;
    return modelName as `${number}:${string}`;
  }
  return value as `${number}:${string}`;
}

async function getModelConfig(value: AiType | `${string}:${string}`) {
  if (AiTypeValues.includes(value as AiType)) {
    const agentUseModeVal = await u.db("o_setting").where("key", "agentUseMode").first();
    //正常流程
    //高级配置
    if (agentUseModeVal?.value == "1") {
      const agentDeployData = await u.db("o_agentDeploy").where("key", value).first();
      if (!agentDeployData?.modelName) throw new Error(`高级配置模式下，未找到对应的模型配置 ${value}`);
      return agentDeployData;
    }
    //简易配置
    if (agentUseModeVal?.value == "0") {
      const [mainly] = value!.split(/:(.+)/);
      const mainlyData = await u.db("o_agentDeploy").where("key", mainly).first();
      if (!mainlyData?.modelName) throw new Error(`简易配置模式下，未找到部署配置 ${value}`);
      return mainlyData;
    }

    //未查到 agentUseModelVal 维持原流程
    const agentDeployData = await u.db("o_agentDeploy").where("key", value).first();

    if (!agentDeployData?.modelName) {
      const [mainly] = agentDeployData!.key!.split(/:(.+)/);
      const mainlyData = await u.db("o_agentDeploy").where("key", mainly).first();
      if (!mainlyData?.modelName) throw new Error(`未找到部署配置 ${value}`);
      return mainlyData;
    }
    return agentDeployData;
  }
  return null;
}

async function getVendorTemplateFn(
  fnName: "textRequest",
  modelName: `${string}:${string}`,
): Promise<(think?: boolean, thinkLevel?: 0 | 1 | 2 | 3) => any>;
async function getVendorTemplateFn(fnName: Exclude<FnName, "textRequest">, modelName: `${string}:${string}`): Promise<(input: any) => any>;
async function getVendorTemplateFn(fnName: FnName, modelName: `${string}:${string}`): Promise<any> {
  const [id, name] = modelName.split(/:(.+)/);
  const vendorConfigData = await u.db("o_vendorConfig").where("id", id).first();
  if (!vendorConfigData) throw new Error(`未找到供应商配置 id=${id}`);
  const modelList = await u.vendor.getModelList(id);
  const selectedModel = modelList.find((i: any) => i.modelName == name);
  if (!selectedModel) throw new Error(`未找到模型 ${name} id=${id}`);
  const code = u.vendor.getCode(id);
  const jsCode = transform(code, { transforms: ["typescript"] }).code;
  const running = u.vm(jsCode);
  if (running.vendor) {
    Object.assign(running.vendor.inputValues, JSON.parse(vendorConfigData.inputValues ?? "{}"));
    running.vendor.models = modelList;
  }
  const fn = running[fnName];
  if (!fn) throw new Error(`未找到供应商配置中的函数 ${fnName} id=${id}`);
  if (fnName == "textRequest")
    return (think?: boolean, thinkLevel: 0 | 1 | 2 | 3 = 0) => {
      const effectiveThink = think ?? !!selectedModel.think;
      return fn(selectedModel, effectiveThink, thinkLevel);
    };
  else return <T>(input: T) => fn(input, selectedModel);
}

async function withTaskRecord<T>(
  modelKey: AiType | `${string}:${string}`,
  taskClass: string,
  describe: string,
  relatedObjects: string,
  projectId: number,
  fn: (modelName: `${string}:${string}`, think: Boolean, thinkLevel: 0 | 1 | 2 | 3) => Promise<T>,
  chargeSpec?: ChargeSpec,
): Promise<T> {
  const modelName = await resolveModelName(modelKey);
  const [_, model] = modelName.split(/:(.+)/);
  // 计费埋点：调用模型前先校验余额（不足即抛 400，不真正调模型）
  if (chargeSpec) await preCheckTaskBalance(modelName, projectId, chargeSpec);
  const taskRecord = await u.task(projectId, taskClass, model, { describe: describe, content: relatedObjects });
  try {
    const result = await fn(modelName, false, 0);

    taskRecord(1);
    // 计费埋点：成功后扣费并写 o_usage_log（失败路径不扣费）
    if (chargeSpec) await chargeAfterTask(modelName, projectId, taskClass, chargeSpec);
    return result;
  } catch (e) {
    taskRecord(-1, u.error(e).message);
    throw new Error(u.error(e).message);
  }
}

async function urlToBase64(url: string, retries = 3, delay = 1000): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, { responseType: "arraybuffer" });
      const base64 = Buffer.from(res.data).toString("base64");
      return `${base64}`;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error("urlToBase64 failed");
}

// ────────────────────────── 计费埋点（Phase 1）──────────────────────────────
// 统一内部记账：图/视频/TTS 走 withTaskRecord（有 projectId），文本走可选 opts。
// 原则：未配价或成本为 0 时跳过计费（不阻断正常生成）；cost>0 才扣费并写 o_usage_log；
//       余额不足在真正调模型之前先拦截（抛 status=400），调用失败不扣费。
type ChargeType = "chat" | "image" | "video" | "tts";

interface ChargeSpec {
  type: ChargeType;
  count?: number; // perImage / perItem 用量
  duration?: number; // perSecond 用量（秒）
  useUserKey?: boolean;
}

interface TextChargeOpts {
  userId?: number | string;
  projectId?: number | string;
  taskClass?: string;
  useUserKey?: boolean;
}

// 通过 projectId 反查项目归属 userId（查不到返回 null，跳过计费）
async function lookupProjectUserId(projectId: number | string | null | undefined): Promise<number | null> {
  if (projectId == null) return null;
  const project = await u.db("o_project").where("id", Number(projectId)).select("userId").first();
  return project?.userId != null ? Number(project.userId) : null;
}

// 余额校验：不足时抛 status=400 的 Error（含 err.balance），供上层透出"余额不足，请先充值"
async function assertBalanceEnough(userId: number, cost: number): Promise<void> {
  const balance = await u.billing.getBalance(u.db, userId);
  if (balance < cost) {
    const err: any = new Error(`余额不足，请先充值（当前余额 ${balance} 分，本次需 ${cost} 分）`);
    err.status = 400;
    err.balance = balance;
    throw err;
  }
}

// 计算某调用（modelName = vendorId:model）的成本（分）；未配价返回 null
async function calcTaskCost(
  modelName: string,
  spec: ChargeSpec,
): Promise<number | null> {
  const [vendorId, model] = modelName.split(/:(.+)/);
  return u.pricing.calcCost(u.db, spec.type, vendorId, model, {
    count: spec.count,
    duration: spec.duration,
  });
}

// 图/视频/TTS：调用模型前预检余额（避免空跑），cost>0 且归属用户可查时校验
async function preCheckTaskBalance(modelName: string, projectId: number, spec: ChargeSpec): Promise<void> {
  const cost = await calcTaskCost(modelName, spec);
  if (cost == null || cost <= 0) return; // 未配价 / 0 成本 → 不拦截
  const userId = await lookupProjectUserId(projectId);
  if (userId == null) return; // 查不到归属用户 → 跳过计费
  await assertBalanceEnough(userId, cost);
}

// 图/视频/TTS：调用成功后扣费并写 o_usage_log
async function chargeAfterTask(modelName: string, projectId: number, taskClass: string, spec: ChargeSpec): Promise<void> {
  const cost = await calcTaskCost(modelName, spec);
  if (cost == null || cost <= 0) return;
  const userId = await lookupProjectUserId(projectId);
  if (userId == null) return;
  const [vendorId, model] = modelName.split(/:(.+)/);
  await u.billing.deductBalance(u.db, userId, cost, {
    projectId,
    taskClass,
    type: spec.type,
    vendorId,
    model,
    count: spec.count,
    duration: spec.duration,
    useUserKey: !!spec.useUserKey,
  });
}

// 文本：调用前预检余额（token 数调用前未知，仅拦截明确余额不足（0 或负）的情形）
async function preCheckTextBalance(modelName: string, opts: TextChargeOpts): Promise<void> {
  if (opts.userId == null && opts.projectId == null) return;
  const [vendorId, model] = modelName.split(/:(.+)/);
  const price = await u.pricing.getModelPrice(u.db, "chat", vendorId, model);
  if (!price) return; // 未配价 → 不拦截
  const userId = opts.userId != null ? Number(opts.userId) : await lookupProjectUserId(opts.projectId);
  if (userId == null || userId <= 0) return;
  const balance = await u.billing.getBalance(u.db, userId);
  if (balance <= 0) {
    const err: any = new Error("余额不足，请先充值");
    err.status = 400;
    err.balance = balance;
    throw err;
  }
}

// 文本：调用成功后按实际 token 用量扣费并写 o_usage_log
async function chargeTextAfterTask(
  modelName: string,
  usage: { inputTokens?: number | undefined; outputTokens?: number | undefined } | undefined,
  opts: TextChargeOpts,
): Promise<void> {
  if (opts.userId == null && opts.projectId == null) return;
  const [vendorId, model] = modelName.split(/:(.+)/);
  const inputTokens = Number(usage?.inputTokens) || 0;
  const outputTokens = Number(usage?.outputTokens) || 0;
  const cost = await u.pricing.calcCost(u.db, "chat", vendorId, model, {
    tokens: inputTokens + outputTokens,
    inputTokens,
    outputTokens,
  });
  if (cost == null || cost <= 0) return; // 未配价 / 0 token → 不扣费
  const userId = opts.userId != null ? Number(opts.userId) : await lookupProjectUserId(opts.projectId);
  if (userId == null || userId <= 0) return;
  await u.billing.deductBalance(u.db, userId, cost, {
    projectId: opts.projectId != null ? Number(opts.projectId) : null,
    taskClass: opts.taskClass ?? null,
    type: "chat",
    vendorId,
    model,
    inputTokens,
    outputTokens,
    useUserKey: !!opts.useUserKey,
  });
}
class AiText {
  private AiType: AiType | `${string}:${string}`;
  private think?: boolean;
  private thinkLevel: 0 | 1 | 2 | 3;
  constructor(AiType: AiType | `${string}:${string}`, think?: boolean, thinkLevel: 0 | 1 | 2 | 3 = 0) {
    this.AiType = AiType;
    this.think = think;
    this.thinkLevel = thinkLevel;
  }
  private async resolveModel(middleware?: any | any[]) {
    const switchAiDevTool = await u.db("o_setting").where("key", "switchAiDevTool").first();
    const modelName = await resolveModelName(this.AiType);
    const sdkFn = await getVendorTemplateFn("textRequest", modelName);
    const baseModel = await sdkFn(this.think, this.thinkLevel);
    const mws = [
      ...(switchAiDevTool?.value === "1" ? [devToolsMiddleware()] : []),
      ...(middleware ? (Array.isArray(middleware) ? middleware : [middleware]) : []),
    ];
    return mws.length > 0 ? wrapLanguageModel({ model: baseModel, middleware: mws.length === 1 ? mws[0] : mws }) : baseModel;
  }
  async invoke(input: Omit<Parameters<typeof generateText>[0], "model">, opts?: TextChargeOpts) {
    const config = await getModelConfig(this.AiType);
    // 计费埋点：调用前预检余额（仅当传入 opts 时启用，未传则保持原行为）
    let modelName: `${string}:${string}` | undefined;
    if (opts) {
      modelName = await resolveModelName(this.AiType);
      await preCheckTextBalance(modelName, opts);
    }

    const result = await generateText({
      ...(input.tools && { stopWhen: stepCountIs(Object.keys(input.tools).length * 50) }),
      ...input,
      model: await this.resolveModel(),
      ...(config?.temperature && { temperature: config.temperature }),
      ...(config?.maxOutputTokens && { maxOutputTokens: config.maxOutputTokens }),
    } as Parameters<typeof generateText>[0]);

    // 计费埋点：成功后按实际 token 用量扣费并写 o_usage_log（失败不扣）
    if (opts && modelName) await chargeTextAfterTask(modelName, result.usage, opts);
    return result;
  }
  async stream(input: Omit<Parameters<typeof streamText>[0], "model">, opts?: TextChargeOpts) {
    const config = await getModelConfig(this.AiType);
    // 计费埋点：调用前预检余额（仅当传入 opts 时启用，未传则保持原行为）
    let modelName: `${string}:${string}` | undefined;
    if (opts) {
      modelName = await resolveModelName(this.AiType);
      await preCheckTextBalance(modelName, opts);
    }
    const userOnFinish = input.onFinish;

    return streamText({
      ...(input.tools && { stopWhen: stepCountIs(Object.keys(input.tools).length * 50) }),
      ...input,
      model: await this.resolveModel(extractReasoningMiddleware({ tagName: "reasoning_content", separator: "\n" })),
      ...(config?.temperature && { temperature: config.temperature }),
      ...(config?.maxOutputTokens && { maxOutputTokens: config.maxOutputTokens }),
      onFinish: async (event: any) => {
        try {
          // 计费埋点：在 onFinish 中取 usage 扣费（失败不扣）；拿不到 usage 时按 0 处理（不扣）
          if (opts && modelName) {
            const usage = event?.totalUsage ?? event?.usage;
            await chargeTextAfterTask(modelName, usage ?? undefined, opts);
          }
        } finally {
          if (userOnFinish) await userOnFinish(event);
        }
      },
    } as Parameters<typeof streamText>[0]);
  }
}

function referenceList2imageBase642(id: string, input: any) {
  const version = u.vendor.getVendor(id).version;
  if (!version || isNaN(parseFloat(version)) || parseFloat(version) < 2.0) {
    input.imageBase64 = input.referenceList.map((item: any) => item.base64);
    return input;
  }
  return input;
}

export type ReferenceList = { type: "image"; base64: string } | { type: "audio"; base64: string } | { type: "video"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface TaskRecord {
  taskClass: string; // 任务分类
  describe: string; // 任务描述
  relatedObjects: string; // 相关对象信息，便于后续分析和追踪
  projectId: number; // 项目ID
}

class AiImage {
  private key: `${string}:${string}`;
  private result: string = "";
  constructor(key: `${string}:${string}`) {
    this.key = key;
  }
  async run(input: ImageConfig, taskRecord?: TaskRecord) {
    const modelName = await resolveModelName(this.key);
    const exec = async (mn: `${string}:${string}`) => {
      const fn = await getVendorTemplateFn("imageRequest", mn);
      await referenceList2imageBase642(mn.split(/:(.+)/)[0], input);
      this.result = await fn(input);
      if (this.result.startsWith("http")) this.result = await urlToBase64(this.result);
      return this;
    };
    if (taskRecord) {
      await withTaskRecord(this.key, taskRecord.taskClass, taskRecord.describe, taskRecord.relatedObjects, taskRecord.projectId, exec, {
        type: "image",
        count: 1,
      });
      return this;
    }
    await exec(modelName);
    return this;
  }
  async save(path: string) {
    await u.oss.writeFile(path, this.result);
    return this;
  }
}

type VideoMode =
  | "singleImage" //单图参考
  | "startEndRequired" //首尾帧（两张都得有）
  | "endFrameOptional" //首尾帧（尾帧可选）
  | "startFrameOptional" //首尾帧（首帧可选）
  | "text" //文本
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[]; //多参考（数字代表限制数量）

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

class AiVideo {
  private key: `${string}:${string}`;
  private result: string = "";
  constructor(key: `${string}:${string}`) {
    this.key = key;
  }
  async run(input: VideoConfig, taskRecord?: TaskRecord) {
    const modelName = await resolveModelName(this.key);
    try {
      const exec = async (mn: `${string}:${string}`) => {
        const fn = await getVendorTemplateFn("videoRequest", mn);
        await referenceList2imageBase642(mn.split(/:(.+)/)[0], input);

        this.result = await fn(input);

        if (this.result.startsWith("http")) this.result = await urlToBase64(this.result);
      };
      if (taskRecord) {
        await withTaskRecord(this.key, taskRecord.taskClass, taskRecord.describe, taskRecord.relatedObjects, taskRecord.projectId, exec, {
          type: "video",
          duration: input.duration,
        });
        return this;
      }
      await exec(modelName);
      return this;
    } catch (e) {
      throw e;
    }
  }
  async save(path: string) {
    await u.oss.writeFile(path, this.result);
    return this;
  }
}
class AiAudio {
  private key: `${string}:${string}`;
  private result: string = "";
  constructor(key: `${string}:${string}`) {
    this.key = key;
  }
  async run(input: VideoConfig, taskRecord?: TaskRecord) {
    const modelName = await resolveModelName(this.key);
    const exec = async (mn: `${string}:${string}`) => {
      try {
        const fn = await getVendorTemplateFn("ttsRequest", mn);
        await referenceList2imageBase642(mn.split(/:(.+)/)[0], input);
        this.result = await fn(input);

        if (this.result.startsWith("http")) this.result = await urlToBase64(this.result);
        return this;
      } catch (e) {}
    };
    if (taskRecord) {
      return withTaskRecord(this.key, taskRecord.taskClass, taskRecord.describe, taskRecord.relatedObjects, taskRecord.projectId, exec, {
        type: "tts",
        count: 1,
      });
    }
    return await exec(modelName);
  }
  async save(path: string) {
    await u.oss.writeFile(path, this.result);
    return this;
  }
}

export default {
  Text: (AiType: AiType | `${string}:${string}`, think?: boolean, thinkLevel?: 0 | 1 | 2 | 3) => new AiText(AiType, think, thinkLevel),
  Image: (key: `${string}:${string}`) => new AiImage(key),
  Video: (key: `${string}:${string}`) => new AiVideo(key),
  Audio: (key: `${string}:${string}`) => new AiAudio(key),
};
