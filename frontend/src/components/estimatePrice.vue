<template>
  <div v-if="model" class="estimatePrice f ac">
    <template v-if="loading">
      <span class="epMuted">{{ "…" }}</span>
    </template>
    <template v-else-if="estimateCost == null">
      <span class="epMuted">{{ $t("estimate.noPrice") }}</span>
    </template>
    <template v-else>
      <span class="epText">
        {{ $t("estimate.label") }}
        <span class="epCost">¥{{ formatMoney(estimateCost) }}</span>
      </span>
      <span v-if="insufficient" class="epInsufficient" @click="goWallet">
        {{ $t("estimate.insufficient") }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import router from "@/router/index";

const props = defineProps<{
  /** 生成类型：video / image */
  type: "video" | "image";
  /** 模型标识，形如 "vendorId:modelName"，也可能是纯 modelName */
  model: string;
  /** 用量参数：video 用 { duration: 秒 }，image 用 { count: 张数 } */
  params?: Record<string, number>;
}>();

const estimateCost = ref<number | null>(null); // 分
const balance = ref<number | null>(null); // 分
const loading = ref(false);

/** 拆分 "vendorId:modelName"，拆不出 vendorId 时用 "*" 让后端按默认/通配价兜底 */
function splitModel(model: string): { vendorId: string; model: string } {
  const idx = model.indexOf(":");
  if (idx <= 0) return { vendorId: "*", model: model || "*" };
  return { vendorId: model.slice(0, idx), model: model.slice(idx + 1) || "*" };
}

/** 分 -> 元字符串（保留两位） */
function formatMoney(value?: number | string | null): string {
  const num = Number(value ?? 0) || 0;
  return (num / 100).toFixed(2);
}

async function fetchEstimate() {
  const model = props.model;
  if (!model) {
    estimateCost.value = null;
    return;
  }
  loading.value = true;
  try {
    const { vendorId, model: modelName } = splitModel(model);
    const { data } = await axios.post("/billing/estimate", {
      type: props.type,
      vendorId,
      model: modelName,
      params: props.params ?? {},
    });
    estimateCost.value = typeof data?.cost === "number" ? data.cost : null;
  } catch {
    estimateCost.value = null;
  } finally {
    loading.value = false;
  }
}

async function fetchBalance() {
  try {
    const { data } = await axios.post("/billing/balance");
    balance.value = typeof data?.balance === "number" ? data.balance : null;
  } catch {
    balance.value = null;
  }
}

watch(
  () => props.model,
  () => {
    estimateCost.value = null;
    balance.value = null;
    fetchEstimate();
    fetchBalance();
  },
  { immediate: true },
);

watch(
  () => JSON.stringify(props.params ?? {}),
  () => {
    if (props.model) fetchEstimate();
  },
);

const insufficient = computed(() => balance.value != null && estimateCost.value != null && balance.value < estimateCost.value);

/** 供父组件在生成前调用：余额充足返回 true，不足返回 false（并已跳转/提示由父处理） */
async function checkBalance(): Promise<boolean> {
  await Promise.all([fetchEstimate(), fetchBalance()]);
  return !(balance.value != null && estimateCost.value != null && balance.value < estimateCost.value);
}

function goWallet() {
  router.push("/wallet");
}

defineExpose({ checkBalance });
</script>

<style lang="scss" scoped>
.estimatePrice {
  gap: 8px;
  flex-wrap: wrap;
  .epMuted {
    font-size: 12px;
    color: var(--td-text-color-secondary);
  }
  .epText {
    font-size: 12px;
    color: var(--td-text-color-primary);
    .epCost {
      font-weight: 600;
      color: var(--td-brand-color);
      margin-left: 2px;
    }
  }
  .epInsufficient {
    font-size: 12px;
    color: var(--td-error-color);
    cursor: pointer;
    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
