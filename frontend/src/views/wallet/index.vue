<template>
  <div class="wallet">
    <div class="header f ac jb">
      <div class="headerInfo fc">
        <span class="title">{{ $t("wallet.title") }}</span>
        <span class="sub">{{ $t("wallet.subtitle") }}</span>
      </div>
      <t-button v-if="isAdmin" theme="primary" @click="showRechargeDialog = true">
        <template #icon>
          <i-wallet-one />
        </template>
        {{ $t("wallet.recharge") }}
      </t-button>
    </div>

    <t-dialog v-model:visible="showRechargeDialog" :header="$t('wallet.recharge')" :confirm-btn="$t('wallet.confirmRecharge')" :cancel-btn="$t('common.cancel')" @confirm="handleRecharge" :loading="rechargeLoading">
      <div class="rechargeForm">
        <div class="rechargeLabel">{{ $t("wallet.rechargeAmount") }}</div>
        <t-input-number v-model="rechargeAmount" :min="1" :max="100000" :step="10" placeholder="¥" />
      </div>
    </t-dialog>

    <div class="cards">
      <div class="card balanceCard">
        <div class="cardLabel">{{ $t("wallet.balance") }}</div>
        <div class="cardValue">{{ balanceText }}</div>
        <div class="cardHint" v-if="!isAdmin">{{ $t("wallet.contactAdmin") }}</div>
      </div>
      <div class="card">
        <div class="cardLabel">{{ $t("wallet.totalSpent") }}</div>
        <div class="cardValue">{{ totalSpentText }}</div>
      </div>
      <div class="card">
        <div class="cardLabel">{{ $t("wallet.monthSpent") }}</div>
        <div class="cardValue">{{ monthSpentText }}</div>
      </div>
    </div>

    <div class="section">
      <div class="sectionTitle">{{ $t("wallet.usageTitle") }}</div>
      <t-table :data="usageList" :columns="columns" row-key="id" :loading="pagination.loading" hover stripe>
        <template #type="{ row }">
          <span>{{ typeText(row.type) }}</span>
        </template>
        <template #cost="{ row }">
          <span>{{ formatMoney(row.cost ?? row.charge) }}</span>
        </template>
        <template #createTime="{ row }">
          <span>{{ formatTime(row.createTime) }}</span>
        </template>
      </t-table>
      <t-pagination
        class="paginationWrap"
        v-model:current="pagination.page"
        v-model:pageSize="pagination.pageSize"
        show-sizer
        :total="pagination.total"
        @page-size-change="getUsageList"
        @current-change="getUsageList" />
    </div>

    <div class="section">
      <div class="sectionTitle">{{ $t("wallet.rechargeTitle") }}</div>
      <t-table :data="rechargeList" :columns="rechargeColumns" row-key="id" hover stripe>
        <template #amount="{ row }">
          <span>{{ formatMoney(row.amount ?? row.charge) }}</span>
        </template>
        <template #createTime="{ row }">
          <span>{{ formatTime(row.createTime) }}</span>
        </template>
      </t-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import axios from "@/utils/axios";
import userStore from "@/stores/user";

const user = userStore();
const { balance, role } = storeToRefs(user);

const isAdmin = computed(() => role.value === "admin");

const balanceText = computed(() => "¥" + formatMoney(balance.value));

// 分 -> 元字符串（保留两位）
function formatMoney(value?: number | string | null): string {
  const num = Number(value ?? 0) || 0;
  return (num / 100).toFixed(2);
}

function formatTime(value?: number | string | null): string {
  if (!value) return "-";
  return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
}

function typeText(type?: string): string {
  if (!type) return "-";
  const key = `wallet.type.${type}`;
  const translated = $t(key);
  // 若 i18n 未命中（返回 key 本身），回退显示原始类型
  return translated === key ? type : translated;
}

const columns = [
  { colKey: "createTime", title: $t("wallet.col.time"), width: 180, cell: "createTime" },
  { colKey: "type", title: $t("wallet.col.type"), width: 120, cell: "type" },
  { colKey: "model", title: $t("wallet.col.model"), ellipsis: true },
  { colKey: "cost", title: $t("wallet.col.cost"), width: 120, cell: "cost" },
];

const rechargeColumns = [
  { colKey: "createTime", title: $t("wallet.col.time"), width: 180, cell: "createTime" },
  { colKey: "amount", title: $t("wallet.col.amount"), width: 140, cell: "amount" },
  { colKey: "remark", title: $t("wallet.col.remark"), ellipsis: true },
];

const pagination = ref({ page: 1, pageSize: 10, total: 0, loading: false });
const usageList = ref<any[]>([]);
const rechargeList = ref<any[]>([]);
const totalSpent = ref<number>(0);
const monthSpent = ref<number>(0);
const totalSpentText = computed(() => "¥" + formatMoney(totalSpent.value));
const monthSpentText = computed(() => "¥" + formatMoney(monthSpent.value));

const rechargeLoading = ref(false);

onMounted(() => {
  loadBalance();
  getUsageList();
  getSummary();
  getRechargeList();
});

async function loadBalance() {
  try {
    await user.fetchUserInfo();
  } catch {
    // 静默：store 中可能已有余额
  }
  try {
    const res: any = await axios.post("/billing/balance");
    const info = res?.data ?? res;
    if (info && info.balance !== undefined) {
      balance.value = info.balance;
    }
  } catch (e: any) {
    window.$message.error(e?.message || $t("wallet.msg.fetchBalanceFailed"));
  }
}

async function getUsageList() {
  pagination.value.loading = true;
  try {
    const res: any = await axios.post("/billing/usage", {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    });
    const info = res?.data ?? res;
    usageList.value = info?.list ?? [];
    pagination.value.total = info?.total ?? 0;
  } catch (e: any) {
    window.$message.error(e?.message || $t("wallet.msg.fetchUsageFailed"));
  } finally {
    pagination.value.loading = false;
  }
}

async function getSummary() {
  try {
    const res: any = await axios.post("/billing/usage/summary");
    const info = res?.data ?? res;
    totalSpent.value = info?.total ?? 0;
    monthSpent.value = info?.month ?? 0;
  } catch (e: any) {
    window.$message.error(e?.message || $t("wallet.msg.fetchSummaryFailed"));
  }
}

async function getRechargeList() {
  try {
    const res: any = await axios.post("/billing/recharge/list", { page: 1, pageSize: 50 });
    const info = res?.data ?? res;
    rechargeList.value = Array.isArray(info) ? info : info?.list ?? [];
  } catch {
    // 充值流水可能无权限，静默
  }
}

const showRechargeDialog = ref(false);
const rechargeAmount = ref<number>(100);

async function handleRecharge() {
  if (!rechargeAmount.value || rechargeAmount.value <= 0) {
    window.$message.warning($t("wallet.msg.rechargeAmountRequired"));
    return;
  }
  rechargeLoading.value = true;
  try {
    // balance 单位为分，这里把元转成分
    const res: any = await axios.post("/billing/recharge", {
      userId: user.userId,
      amount: Math.round(rechargeAmount.value * 100),
    });
    const info = res?.data ?? res;
    window.$message.success(info?.message || $t("wallet.msg.rechargeSuccess"));
    showRechargeDialog.value = false;
    loadBalance();
  } catch (e: any) {
    window.$message.error(e?.message || $t("wallet.msg.rechargeFailed"));
  } finally {
    rechargeLoading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.wallet {
  .header {
    padding-top: 32px;
    margin-bottom: 32px;
    .title {
      font-size: 32px;
      font-weight: 600;
    }
    .sub {
      opacity: 0.5;
    }
  }
  .cards {
    display: flex;
    gap: 20px;
    margin-bottom: 32px;
    .card {
      flex: 1;
      background: var(--td-bg-color-container);
      border-radius: 16px;
      padding: 24px;
      box-shadow: var(--td-shadow-1);
      .cardLabel {
        opacity: 0.6;
        font-size: 14px;
        margin-bottom: 12px;
      }
      .cardValue {
        font-size: 32px;
        font-weight: 700;
        color: var(--td-brand-color);
      }
      .cardHint {
        margin-top: 8px;
        font-size: 12px;
        opacity: 0.5;
      }
    }
    .balanceCard {
      border: 1px solid var(--td-brand-color);
    }
  }
  .section {
    margin-bottom: 32px;
    .sectionTitle {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .paginationWrap {
      margin-top: 10px;
      display: flex;
      justify-content: flex-end;
    }
  }
  .rechargeForm {
    .rechargeLabel {
      margin-bottom: 12px;
      opacity: 0.6;
    }
  }
}
</style>
