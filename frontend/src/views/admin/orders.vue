<template>
  <div class="adminOrders">
    <div class="header f ac jb">
      <div class="headerInfo fc">
        <span class="title">{{ $t("admin.orders.title") }}</span>
        <span class="sub">{{ $t("admin.orders.subtitle") }}</span>
      </div>
    </div>

    <t-card :bordered="false" class="filterCard">
      <div class="f ac" style="gap: 12px; flex-wrap: wrap">
        <t-select v-model="statusFilter" :placeholder="$t('admin.orders.col.status')" clearable style="width: 180px" @change="onFilterChange">
          <t-option :value="'success'" :label="$t('admin.orders.status.success')" />
          <t-option :value="'pending'" :label="$t('admin.orders.status.pending')" />
          <t-option :value="'failed'" :label="$t('admin.orders.status.failed')" />
        </t-select>
        <t-button theme="primary" @click="onSearch">{{ $t("admin.users.search") }}</t-button>
      </div>
    </t-card>

    <t-card :bordered="false" class="tableCard">
      <t-table :data="orderList" :columns="columns" row-key="id" :loading="pagination.loading" hover stripe>
        <template #createTime="{ row }">
          <span>{{ formatTime(row.createTime) }}</span>
        </template>
        <template #userName="{ row }">
          <span>{{ row.userName || row.nickname || "-" }}</span>
        </template>
        <template #amount="{ row }">
          <span>{{ formatYuan(row.amount) }}</span>
        </template>
        <template #method="{ row }">
          <span>{{ methodText(row.method) }}</span>
        </template>
        <template #status="{ row }">
          <t-tag v-if="row.status === 'success'" theme="success" variant="light">{{ $t("admin.orders.status.success") }}</t-tag>
          <t-tag v-else-if="row.status === 'pending'" theme="warning" variant="light">{{ $t("admin.orders.status.pending") }}</t-tag>
          <t-tag v-else theme="danger" variant="light">{{ row.status === "failed" ? $t("admin.orders.status.failed") : row.status }}</t-tag>
        </template>
        <template #remark="{ row }">
          <span>{{ row.remark || "-" }}</span>
        </template>
      </t-table>
      <t-pagination
        class="paginationWrap"
        v-model:current="pagination.page"
        v-model:pageSize="pagination.pageSize"
        show-sizer
        :total="pagination.total"
        @page-size-change="getOrderList"
        @current-change="getOrderList" />
    </t-card>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import { formatYuan, formatTime } from "@/utils/format";

const statusFilter = ref<string>("");
const pagination = ref({ page: 1, pageSize: 10, total: 0, loading: false });
const orderList = ref<any[]>([]);

const columns = [
  { colKey: "createTime", title: $t("admin.orders.col.time"), width: 180, cell: "createTime" },
  { colKey: "userName", title: $t("admin.orders.col.user"), width: 140, cell: "userName", ellipsis: true },
  { colKey: "userEmail", title: $t("admin.orders.col.email"), ellipsis: true, minWidth: 160 },
  { colKey: "amount", title: $t("admin.orders.col.amount"), width: 120, cell: "amount" },
  { colKey: "method", title: $t("admin.orders.col.method"), width: 120, cell: "method" },
  { colKey: "status", title: $t("admin.orders.col.status"), width: 100, cell: "status" },
  { colKey: "remark", title: $t("admin.orders.col.remark"), ellipsis: true, cell: "remark" },
];

onMounted(() => {
  getOrderList();
});

async function getOrderList() {
  pagination.value.loading = true;
  try {
    const res: any = await axios.post("/admin/orders", {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      status: statusFilter.value || undefined,
    });
    const info = res?.data ?? res;
    orderList.value = info?.list ?? [];
    pagination.value.total = info?.total ?? 0;
  } catch (e: any) {
    window.$message.error(e?.message || $t("admin.orders.msg.fetchFailed"));
  } finally {
    pagination.value.loading = false;
  }
}

function onFilterChange() {
  pagination.value.page = 1;
  getOrderList();
}

function onSearch() {
  pagination.value.page = 1;
  getOrderList();
}

function methodText(method?: string) {
  if (!method) return "-";
  const key = `admin.orders.method.${method}`;
  const translated = $t(key);
  return translated === key ? method : translated;
}
</script>

<style lang="scss" scoped>
.adminOrders {
  .header {
    padding-top: 32px;
    margin-bottom: 24px;
    .title {
      font-size: 32px;
      font-weight: 600;
    }
    .sub {
      opacity: 0.5;
    }
  }
  .filterCard {
    background: var(--td-bg-color-container);
    border-radius: 16px;
    box-shadow: var(--td-shadow-1);
    margin-bottom: 16px;
  }
  .tableCard {
    background: var(--td-bg-color-container);
    border-radius: 16px;
    box-shadow: var(--td-shadow-1);
    .paginationWrap {
      margin-top: 16px;
      display: flex;
      justify-content: flex-end;
    }
  }
}
</style>
