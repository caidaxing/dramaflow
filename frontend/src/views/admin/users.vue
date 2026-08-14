<template>
  <div class="adminUsers">
    <div class="header f ac jb">
      <div class="headerInfo fc">
        <span class="title">{{ $t("admin.users.title") }}</span>
        <span class="sub">{{ $t("admin.users.subtitle") }}</span>
      </div>
    </div>

    <t-card :bordered="false" class="searchCard">
      <div class="f ac" style="gap: 12px; flex-wrap: wrap">
        <t-input
          v-model="keyword"
          :placeholder="$t('admin.users.searchPlaceholder')"
          clearable
          style="width: 280px"
          @enter="onSearch"
          @clear="onSearch" />
        <t-button theme="primary" @click="onSearch">{{ $t("admin.users.search") }}</t-button>
        <t-button variant="outline" @click="onReset">{{ $t("admin.users.reset") }}</t-button>
      </div>
    </t-card>

    <t-card :bordered="false" class="tableCard">
      <t-table
        :data="userList"
        :columns="columns"
        row-key="id"
        :loading="pagination.loading"
        hover
        stripe>
        <template #user="{ row }">
          <div class="userCell">
            <span class="userName">{{ row.name || row.nickname || "-" }}</span>
            <span class="userNickname" v-if="row.nickname && row.nickname !== row.name">{{ row.nickname }}</span>
          </div>
        </template>
        <template #role="{ row }">
          <t-tag v-if="row.role === 'admin'" theme="warning" variant="light">{{ $t("admin.users.role.admin") }}</t-tag>
          <t-tag v-else theme="default" variant="light">{{ $t("admin.users.role.user") }}</t-tag>
        </template>
        <template #status="{ row }">
          <t-tag v-if="row.status === 'enabled'" theme="success" variant="light">{{ $t("admin.users.status.enabled") }}</t-tag>
          <t-tag v-else theme="danger" variant="light">{{ $t("admin.users.status.disabled") }}</t-tag>
        </template>
        <template #balance="{ row }">
          <span>{{ formatYuan(row.balance) }}</span>
        </template>
        <template #totalCharge="{ row }">
          <span>{{ formatYuan(row.totalCharge) }}</span>
        </template>
        <template #createTime="{ row }">
          <span>{{ formatTime(row.createTime) }}</span>
        </template>
        <template #op="{ row }">
          <div class="opCell f ac" style="gap: 8px; flex-wrap: wrap">
            <t-select
              :value="row.role"
              class="roleSelect"
              @change="(v: any) => onRoleChange(row, v)"
              :disabled="row.id === currentUserId">
              <t-option :value="'admin'" :label="$t('admin.users.role.admin')" />
              <t-option :value="'user'" :label="$t('admin.users.role.user')" />
            </t-select>
            <t-button v-if="row.status === 'enabled'" size="small" variant="outline" theme="danger" @click="onToggleStatus(row, 'disabled')">
              {{ $t("admin.users.action.disable") }}
            </t-button>
            <t-button v-else size="small" variant="outline" theme="success" @click="onToggleStatus(row, 'enabled')">
              {{ $t("admin.users.action.enable") }}
            </t-button>
            <t-button size="small" theme="primary" variant="outline" @click="openAddBalance(row)">
              {{ $t("admin.users.action.addBalance") }}
            </t-button>
          </div>
        </template>
      </t-table>
      <t-pagination
        class="paginationWrap"
        v-model:current="pagination.page"
        v-model:pageSize="pagination.pageSize"
        show-sizer
        :total="pagination.total"
        @page-size-change="getUserList"
        @current-change="getUserList" />
    </t-card>

    <t-dialog
      v-model:visible="addBalanceVisible"
      :header="addBalanceTitle"
      :confirm-btn="$t('admin.users.dialog.confirm')"
      :cancel-btn="$t('admin.users.dialog.cancel')"
      :loading="addBalanceLoading"
      @confirm="handleAddBalance">
      <div class="addBalanceForm">
        <div class="formLabel">{{ $t("admin.users.dialog.amount") }}</div>
        <t-input-number v-model="addAmount" :min="1" :max="1000000" :step="10" :placeholder="$t('admin.users.dialog.amountPlaceholder')" style="width: 100%" />
        <div class="formLabel" style="margin-top: 16px">{{ $t("admin.users.dialog.remark") }}</div>
        <t-input v-model="addRemark" :placeholder="$t('admin.users.dialog.remarkPlaceholder')" />
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import userStore from "@/stores/user";
import { formatYuan, formatTime } from "@/utils/format";

const user = userStore();
const currentUserId = computed(() => user.userId);

const keyword = ref("");
const pagination = ref({ page: 1, pageSize: 10, total: 0, loading: false });
const userList = ref<any[]>([]);

const columns = [
  { colKey: "user", title: $t("admin.users.col.user"), cell: "user", minWidth: 160 },
  { colKey: "email", title: $t("admin.users.col.email"), ellipsis: true, minWidth: 160 },
  { colKey: "role", title: $t("admin.users.col.role"), width: 110, cell: "role" },
  { colKey: "status", title: $t("admin.users.col.status"), width: 100, cell: "status" },
  { colKey: "balance", title: $t("admin.users.col.balance"), width: 120, cell: "balance" },
  { colKey: "totalCharge", title: $t("admin.users.col.totalCharge"), width: 120, cell: "totalCharge" },
  { colKey: "callCount", title: $t("admin.users.col.callCount"), width: 100 },
  { colKey: "createTime", title: $t("admin.users.col.createTime"), width: 170, cell: "createTime" },
  { colKey: "op", title: $t("admin.users.col.action"), width: 260, cell: "op" },
];

onMounted(() => {
  getUserList();
});

async function getUserList() {
  pagination.value.loading = true;
  try {
    const res: any = await axios.post("/admin/users", {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: keyword.value,
    });
    const info = res?.data ?? res;
    userList.value = info?.list ?? [];
    pagination.value.total = info?.total ?? 0;
  } catch (e: any) {
    window.$message.error(e?.message || $t("admin.users.msg.fetchFailed"));
  } finally {
    pagination.value.loading = false;
  }
}

function onSearch() {
  pagination.value.page = 1;
  getUserList();
}

function onReset() {
  keyword.value = "";
  pagination.value.page = 1;
  getUserList();
}

async function onToggleStatus(row: any, status: string) {
  try {
    const res: any = await axios.post("/admin/users/update", {
      userId: row.id,
      status,
    });
    window.$message.success(res?.data?.message || $t("admin.users.msg.updateSuccess"));
    row.status = status;
  } catch (e: any) {
    window.$message.error(e?.message || $t("admin.users.msg.updateFailed"));
  }
}

async function onRoleChange(row: any, role: string) {
  if (!role || role === row.role) return;
  try {
    const res: any = await axios.post("/admin/users/update", {
      userId: row.id,
      role,
    });
    window.$message.success(res?.data?.message || $t("admin.users.msg.updateSuccess"));
    row.role = role;
  } catch (e: any) {
    window.$message.error(e?.message || $t("admin.users.msg.updateFailed"));
    // 失败时回滚下拉值
    row.role = row.role;
  }
}

// 加余额弹窗
const addBalanceVisible = ref(false);
const addBalanceLoading = ref(false);
const addBalanceUser = ref<any>(null);
const addAmount = ref<number>(100);
const addRemark = ref("");
const addBalanceTitle = computed(() =>
  addBalanceUser.value ? `${$t("admin.users.dialog.addBalanceTitle")} - ${addBalanceUser.value.name || addBalanceUser.value.email || addBalanceUser.value.id}` : $t("admin.users.dialog.addBalanceTitle"),
);

function openAddBalance(row: any) {
  addBalanceUser.value = row;
  addAmount.value = 100;
  addRemark.value = "";
  addBalanceVisible.value = true;
}

async function handleAddBalance() {
  if (!addAmount.value || addAmount.value <= 0) {
    window.$message.warning($t("admin.users.msg.amountRequired"));
    return;
  }
  addBalanceLoading.value = true;
  try {
    const res: any = await axios.post("/admin/users/add-balance", {
      userId: addBalanceUser.value.id,
      amount: Math.round(addAmount.value * 100), // 元 -> 分
      remark: addRemark.value,
    });
    window.$message.success(res?.data?.message || $t("admin.users.msg.addBalanceSuccess"));
    addBalanceVisible.value = false;
    // 刷新余额
    const balance = res?.data?.balance;
    if (balance !== undefined && addBalanceUser.value) {
      addBalanceUser.value.balance = balance;
    }
    getUserList();
  } catch (e: any) {
    window.$message.error(e?.message || $t("admin.users.msg.addBalanceFailed"));
  } finally {
    addBalanceLoading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.adminUsers {
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
  .searchCard {
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
    .roleSelect {
      width: 108px;
    }
  }
  .userCell {
    display: flex;
    flex-direction: column;
    .userName {
      font-weight: 600;
    }
    .userNickname {
      font-size: 12px;
      opacity: 0.5;
    }
  }
  .addBalanceForm {
    .formLabel {
      margin-bottom: 8px;
      opacity: 0.6;
    }
  }
}
</style>
