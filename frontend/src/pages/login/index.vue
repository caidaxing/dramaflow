<template>
  <div class="loginPage" :style="{ height: isElectron ? 'calc(100vh - 32px)' : '100vh' }">
    <div class="formBox">
      <!-- 设置弹窗 -->
      <t-dialog v-model:visible="showSettingModal" :header="$t('login.settings')" @confirm="handleSaveSetting" :width="400">
        <t-form label-width="80px" labelAlign="top">
          <t-form-item :label="$t('login.requestAddress')">
            <t-input v-model="tempBaseUrl" placeholder="http://localhost:10588" />
          </t-form-item>
        </t-form>
      </t-dialog>
      <div class="logoBox fc">
        <div class="logoImg" v-if="!siteLogoUrl"></div>
        <img v-else class="logoImgUrl" :src="siteLogoUrl" alt="logo" />
        <div class="fc c">
          <span class="logoText">{{ siteName }}</span>
          <span class="slogan">{{ $t("login.slogan") }}</span>
        </div>
      </div>
      <div class="announcement" v-if="announcement">{{ announcement }}</div>
      <div class="login-form">
        <t-input v-model="state.user.username" :placeholder="$t('login.username')" autocomplete="username" size="large"></t-input>
        <t-input v-model="state.user.password" type="password" :placeholder="$t('login.password')" size="large"></t-input>
        <t-button class="loginBtn" theme="primary" size="large" :loading="state.loginLoading" @click="handleLogin" block>
          {{ $t("login.login") }}
        </t-button>
      </div>
      <div class="link c" v-if="registerOpen" @click="goRegister">{{ $t("login.toRegister") }}</div>
      <div class="registerClosed c" v-else>{{ $t("register.closed") }}</div>
      <div class="tips c">{{ $t("login.tips") }}</div>
    </div>
    <div class="footer c" v-if="icpNo">{{ icpNo }}</div>
  </div>
  <div class="settingBtn">
    <t-dropdown :options="langOptions" trigger="click" @click="handleChangeLang" :maxColumnWidth="150">
      <t-button shape="circle" theme="default" size="large">
        <template #icon>
          <i-translate theme="outline" size="20" />
        </template>
      </t-button>
    </t-dropdown>
    <t-button shape="circle" theme="primary" size="large" @click="showSettingModal = true">
      <template #icon>
        <i-setting-two theme="outline" size="20" />
      </template>
    </t-button>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import Router from "@/router/index.ts";
import logo from "@/assets/logo.png";
import axios from "@/utils/axios";
import settingStore from "@/stores/setting";
import userStore from "@/stores/user";
import siteStore from "@/stores/site";
import { storeToRefs } from "pinia";
import { languageList, cachedLocale } from "@/locales";

const { locale } = useI18n();
const langOptions = languageList.map((item) => ({
  content: item.label,
  value: item.value,
}));
const handleChangeLang = (data) => {
  locale.value = data.value;
  cachedLocale.value = data.value;
};

const store = settingStore();
const { baseUrl, isElectron } = storeToRefs(store);

const site = siteStore();
const { siteName, siteLogoUrl, registerOpen, announcement } = storeToRefs(site);
const { siteConfig } = storeToRefs(site);
const icpNo = computed(() => siteConfig.value.icpNo || "");

const showSettingModal = ref(false);
const tempBaseUrl = ref(baseUrl.value);

// 保存设置
const handleSaveSetting = () => {
  baseUrl.value = tempBaseUrl.value;
  showSettingModal.value = false;
  window.$message.success($t("login.settingsSaved"));
};
const state = ref({
  show: true,
  loginLoading: false,
  user: {
    username: "",
    password: "",
  },
  rules: {
    username: [{ required: true, message: $t("login.usernameRequired") }],
    password: [{ required: true, message: $t("login.passwordRequired") }],
  },
});

const handleLogin = () => {
  if (!state.value.user.username || !state.value.user.password) {
    window.$message.warning($t("login.enterUsernameAndPassword"));
    return;
  }
  state.value.loginLoading = true;
  const obj = { ...state.value.user };
  axios
    .post("/login/login", obj)
    .then(({ data }) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.id);
      // 写入 user store（含 role 等）
      const store = userStore();
      store.token = data.token;
      store.userId = data.id;
      store.name = data.name || "";
      store.role = data.role || "";
      store.email = data.email || "";
      // 顺手拉取用户信息（含余额）
      store.fetchUserInfo().catch(() => {});
      Router.push("/project");
      window.$message.success($t("login.loginSuccess"));
      state.value.loginLoading = false;
    })
    .catch((e) => {
      state.value.loginLoading = false;
      window.$message.error(e.message);
    });
};

function goRegister() {
  Router.push("/register");
}
</script>

<style lang="scss" scoped>
.loginPage {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;

  .formBox {
    width: 380px;
    padding: 40px 40px 30px;
    background: var(--td-bg-color-container);
    border-radius: 20px;
    box-shadow: var(--td-shadow-3);

    .logoBox {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 30px;
      gap: 12px;

      .logoImg {
        width: 64px;
        height: 64px;
        background-color: var(--td-text-color-primary);
        mask: url("@/assets/logo.svg") no-repeat center;
        mask-size: contain;
        -webkit-mask: url("@/assets/logo.svg") no-repeat center;
        -webkit-mask-size: contain;
      }

      .logoImgUrl {
        width: 64px;
        height: 64px;
        object-fit: contain;
        border-radius: 8px;
      }

      .announcement {
        margin-bottom: 16px;
        padding: 8px 12px;
        border-radius: 8px;
        background: var(--td-brand-color-light, rgba(0, 82, 217, 0.1));
        color: var(--td-text-color-primary);
        font-size: 13px;
        line-height: 1.5;
        word-break: break-word;
      }

      .logoText {
        font-size: 36px;
        font-weight: 800;
        color: var(--td-text-color-primary);
        letter-spacing: 1px;
      }
      .slogan {
        opacity: 0.5;
        white-space: nowrap;
      }
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;

      .input-icon {
        color: var(--td-text-color-placeholder);
        font-size: 18px;
      }

      :deep(.t-input) {
        border-radius: 8px;
      }
    }
  }
  .tips {
    opacity: 0.5;
    font-size: 12px;
    margin-top: 18px;
  }
  .link {
    margin-top: 18px;
    color: var(--td-brand-color);
    cursor: pointer;
    font-size: 14px;

    &:hover {
      opacity: 0.8;
    }
  }
  .registerClosed {
    margin-top: 18px;
    opacity: 0.6;
    font-size: 14px;
  }
  .footer {
    margin-top: 18px;
    opacity: 0.4;
    font-size: 12px;
  }
}

.default-hint {
  margin-top: 20px;
  border-radius: 8px;

  :deep(.t-alert__message) {
    width: 100%;
  }

  .hint-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: #666;

    p {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  code {
    background: var(--td-bg-color-container);
    padding: 2px 10px;
    border-radius: 4px;
    font-family: "Monaco", "Menlo", monospace;
    font-weight: 500;
    font-size: 13px;
    border: 1px solid var(--td-component-border);
  }
}

.settingBtn {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
