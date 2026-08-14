<template>
  <div class="adminOverview">
    <div class="header f ac jb">
      <div class="headerInfo fc">
        <span class="title">{{ $t("admin.title") }}</span>
        <span class="sub">{{ $t("admin.menu.overview") }}</span>
      </div>
    </div>

    <div class="statCards">
      <t-card class="statCard" :title="$t('admin.overview.totalUsers')" :bordered="false">
        <div class="statValue">{{ summary.totalUsers ?? 0 }}</div>
      </t-card>
      <t-card class="statCard" :title="$t('admin.overview.totalRecharge')" :bordered="false">
        <div class="statValue">{{ formatYuan(summary.totalRecharge) }}</div>
      </t-card>
      <t-card class="statCard" :title="$t('admin.overview.totalCharge')" :bordered="false">
        <div class="statValue">{{ formatYuan(summary.totalCharge) }}</div>
      </t-card>
      <t-card class="statCard" :title="$t('admin.overview.todayCharge')" :bordered="false">
        <div class="statValue">{{ formatYuan(summary.todayCharge) }}</div>
      </t-card>
      <t-card class="statCard" :title="$t('admin.overview.monthCharge')" :bordered="false">
        <div class="statValue">{{ formatYuan(summary.monthCharge) }}</div>
      </t-card>
    </div>

    <div class="middleSection f">
      <t-card class="byTypeCard" :title="$t('admin.overview.byTypeTitle')" :bordered="false">
        <div class="typeList">
          <div class="typeItem" v-for="(item, key) in typeItems" :key="key">
            <t-tag size="medium" variant="light" theme="primary">{{ item.label }}</t-tag>
            <span class="typeValue">{{ formatYuan(summary.byType?.[item.key]) }}</span>
          </div>
        </div>
      </t-card>

      <t-card class="trendCard" :title="$t('admin.overview.trendTitle')" :bordered="false">
        <div class="trendList">
          <div class="trendItem" v-for="(item, index) in trend" :key="item.date">
            <span class="trendDate">{{ item.date }}</span>
            <div class="trendBarWrap">
              <div class="trendBar" :style="{ width: barWidth(item.charge) }" :title="formatYuan(item.charge)"></div>
            </div>
            <span class="trendAmount">{{ formatYuan(item.charge) }}</span>
          </div>
        </div>
      </t-card>
    </div>

    <div class="bottomSection">
      <t-card :title="$t('admin.overview.rankTitle')" :bordered="false">
        <t-table :data="rankList" :columns="rankColumns" row-key="userId" hover stripe :loading="rankLoading">
          <template #name="{ row }">
            <span>{{ row.name || row.nickname || "-" }}</span>
          </template>
          <template #totalCharge="{ row }">
            <span>{{ formatYuan(row.totalCharge) }}</span>
          </template>
        </t-table>
      </t-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import { formatYuan } from "@/utils/format";

const summary = ref<any>({
  totalUsers: 0,
  totalRecharge: 0,
  totalCharge: 0,
  todayCharge: 0,
  monthCharge: 0,
  byType: {},
  dailyTrend: [],
});

const typeItems = [
  { key: "chat", label: $t("wallet.type.chat") },
  { key: "image", label: $t("wallet.type.image") },
  { key: "video", label: $t("wallet.type.video") },
  { key: "tts", label: $t("wallet.type.tts") },
];

const trend = computed(() => {
  const list = summary.value.dailyTrend ?? [];
  // 展示最近 7 天
  return list.slice(-7);
});
const maxTrend = computed(() => {
  let max = 0;
  for (const t of trend.value) {
    const v = Number(t.charge ?? 0);
    if (v > max) max = v;
  }
  return max;
});
function barWidth(charge: number) {
  if (!maxTrend.value) return "0%";
  return Math.max(2, Math.round((Number(charge ?? 0) / maxTrend.value) * 100)) + "%";
}

const rankList = ref<any[]>([]);
const rankLoading = ref(false);
const rankColumns = [
  { colKey: "index", title: "#", width: 60, cell: (h: any, { rowIndex }: any) => h("span", String(rowIndex + 1)) },
  { colKey: "name", title: $t("admin.overview.rankUser"), cell: "name", ellipsis: true },
  { colKey: "email", title: $t("admin.overview.rankEmail"), ellipsis: true },
  { colKey: "totalCharge", title: $t("admin.overview.rankCharge"), width: 140, cell: "totalCharge" },
  { colKey: "callCount", title: $t("admin.overview.rankCalls"), width: 120 },
];

onMounted(() => {
  loadSummary();
  loadRank();
});

async function loadSummary() {
  try {
    const res: any = await axios.post("/admin/usage/summary");
    const info = res?.data ?? res;
    summary.value = { ...summary.value, ...(info || {}) };
  } catch (e: any) {
    window.$message.error(e?.message || $t("admin.msg.fetchSummaryFailed"));
  }
}

async function loadRank() {
  rankLoading.value = true;
  try {
    const res: any = await axios.post("/admin/usage/users", { n: 20 });
    const info = res?.data ?? res;
    rankList.value = info?.list ?? [];
  } catch (e: any) {
    window.$message.error(e?.message || $t("admin.msg.fetchRankFailed"));
  } finally {
    rankLoading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.adminOverview {
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
  .statCards {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    .statCard {
      flex: 1;
      min-width: 180px;
      background: var(--td-bg-color-container);
      border-radius: 16px;
      box-shadow: var(--td-shadow-1);
      :deep(.t-card__header) {
        padding-bottom: 4px;
      }
      .statValue {
        font-size: 28px;
        font-weight: 700;
        color: var(--td-brand-color);
      }
    }
  }
  .middleSection {
    gap: 16px;
    margin-bottom: 24px;
    .byTypeCard,
    .trendCard {
      background: var(--td-bg-color-container);
      border-radius: 16px;
      box-shadow: var(--td-shadow-1);
    }
    .byTypeCard {
      flex: 0 0 320px;
      .typeList {
        .typeItem {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          .typeValue {
            font-size: 16px;
            font-weight: 600;
          }
        }
      }
    }
    .trendCard {
      flex: 1;
      .trendList {
        .trendItem {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 5px 0;
          .trendDate {
            width: 96px;
            font-size: 12px;
            opacity: 0.7;
            flex-shrink: 0;
          }
          .trendBarWrap {
            flex: 1;
            height: 16px;
            background: var(--td-bg-color-component);
            border-radius: 8px;
            overflow: hidden;
            .trendBar {
              height: 100%;
              min-width: 2px;
              background: var(--td-brand-color);
              border-radius: 8px;
              transition: width 0.3s;
            }
          }
          .trendAmount {
            width: 90px;
            text-align: right;
            font-size: 12px;
            flex-shrink: 0;
          }
        }
      }
    }
  }
  .bottomSection {
    .t-card {
      background: var(--td-bg-color-container);
      border-radius: 16px;
      box-shadow: var(--td-shadow-1);
    }
  }
}
</style>
