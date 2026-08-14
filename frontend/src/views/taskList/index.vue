<template>
  <div class="taskList">
    <div class="header">
      <h2 class="title">我的任务</h2>
    </div>
    <div class="search f">
      <div>
        <t-select label="任务大类：" v-model="taskClass" :options="taskCategories" />
      </div>
      <div style="margin-left: 20px">
        <t-select label="状态：" v-model="state">
          <t-option key="1" label="进行中" value="1" />
          <t-option key="2" label="已完成" value="2" />
        </t-select>
      </div>
      <t-button style="margin-left: 10px">查询</t-button>
    </div>
    <div class="content">
      <vxe-table ref="tableRef" :data="taskItem">
        <vxe-column title="任务大类" field="taskClass" width="200" show-overflow="title"></vxe-column>
        <vxe-column title="关联对象" field="relatedObjects" width="200" show-overflow="title"></vxe-column>
        <vxe-column title="模型" field="model" width="200" show-overflow="title"></vxe-column>
        <vxe-column title="描述" field="describe" show-header-overflow show-overflow="title" show-footer-overflow></vxe-column>
        <vxe-column title="状态" field="state" width="150">
          <template #default="{ row }">
            <span
              :style="{
                color: row.state === '进行中' ? '#1890ff' : '#52c41a',
                fontWeight: 'bold',
              }">
              {{ row.state }}
            </span>
          </template>
        </vxe-column>
        <vxe-column title="时间" field="startTime" width="150">
          <template #default="{ row }">
            {{ dayjs(row.startTime).format("YYYY-MM-DD HH:mm:ss") }}
          </template>
        </vxe-column>
      </vxe-table>
      <div class="pagination" style="margin-top: 10px; text-align: right;ma">
        <t-pagination
          v-model:current="pageValue.page"
          v-model:pageSize="pageValue.limit"
          show-size-changer
          :total="pageValue.total"
          @showSizeChange="onShowSizeChange"
          @change="changeFn" />
      </div>
      <taskDetails v-model:open="open" :row="currentRow"></taskDetails>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import store from "@/stores";
import axios from "@/utils/axios";
import dayjs from "dayjs";
import taskDetails from "./components/taskDetails.vue";
import type { PageInfo } from "tdesign-vue-next";
const { projectId } = storeToRefs(store());
interface taskData {
  id: number;
  taskClass: string;
  relatedObjects: string;
  model: string;
  projectName: string;
  episode: string;
  state: string;
  startTime: number;
}
const pageValue = ref({
  page: 1,
  limit: 10,
  total: 11,
  loading: false,
});
const taskCategories = ref<{ label: string; value: string }[]>([]);
const taskClass = ref<string>("");
const state = ref<string>("");
function onShowSizeChange(current: number, pageSize: number) {
  pageValue.value.page = current;
  pageValue.value.limit = pageSize;
}
function changeFn(pageInfo: PageInfo) {
  pageValue.value.page = pageInfo.current;
  pageValue.value.limit = pageInfo.pageSize;
}
const taskItem = ref<taskData[]>([]);

const open = ref<boolean>(false);
const currentRow = ref<any>(null);

onMounted(() => {
  getTaskCategories();
  getTaskList();
});
//获取大类目录
function getTaskCategories() {
  axios
    .post("/task/getTaskCategories", {
      projectId: projectId.value,
    })
    .then(({ data }) => {
      taskCategories.value = data.map((item: any) => ({
        label: item.taskClass,
        value: item.taskClass,
      }));
      taskCategories.value.unshift({ label: "全部", value: "" });
    })
    .catch(() => {
      window.$message.error("获取任务大类失败");
    });
}
//获取任务列表
function getTaskList() {
  axios
    .post("/task/getMyTaskApi", {
      page: pageValue.value.page,
      limit: pageValue.value.limit,
      taskClass: taskClass.value,
      state: state.value,
      projectId: projectId.value,
    })
    .then(({ data }) => {
      taskItem.value = data.data;
      pageValue.value.total = data.total;
    })
    .catch(() => {
      window.$message.error("获取任务列表失败");
    });
}
</script>

<style lang="scss" scoped>
.taskList {
  width: 100%;
  margin: 0 auto;
  padding: 32px;
  background: transparent;
  .search {
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    .ant-input-group {
      margin-right: 1rem;
    }
  }
  .header {
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    .title {
      font-size: 2rem;
      font-weight: 600;
      color: #1a202c;
      margin-bottom: 0.5rem;
    }
  }
}
</style>
