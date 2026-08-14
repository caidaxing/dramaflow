<template>
  <div class="registerPage" :style="{ height: isElectron ? 'calc(100vh - 32px)' : '100vh' }">
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
          <span class="slogan">{{ $t("register.slogan") }}</span>
        </div>
      </div>
      <div class="register-form" v-if="registerOpen">
        <t-input v-model="state.user.username" :placeholder="$t('register.username')" autocomplete="username" size="large"></t-input>
        <t-input v-model="state.user.password" type="password" :placeholder="$t('register.password')" autocomplete="new-password" size="large"></t-input>
        <t-input v-model="state.user.confirmPassword" type="password" :placeholder="$t('register.confirmPassword')" autocomplete="new-password" size="large"></t-input>
        <t-input v-model="state.user.email" :placeholder="$t('register.emailPlaceholder')" size="large"></t-input>
        <t-button class="registerBtn" theme="primary" size="large" :loading="state.registerLoading" @click="handleRegister" block>
          {{ $t("register.register") }}
        </t-button>
      </div>
      <div class="registerClosed c" v-else>{{ $t("register.closed") }}</div>
      <div class="link c" @click="goLogin">{{ $t("register.toLogin") }}</div>
      <div class="tips c">{{ $t("login.tips") }}</div>
    </div>
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
import axios from "@/utils/axios";
import settingStore from "@/stores/setting";
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
const { siteName, siteLogoUrl, registerOpen } = storeToRefs(site);

const showSettingModal = ref(false);
const tempBaseUrl = ref(baseUrl.value);

// 保存设置
const handleSaveSetting = () => {
  baseUrl.value = tempBaseUrl.value;
  showSettingModal.value = false;
  window.$message.success($t("login.settingsSaved"));
};

const state = ref({
  registerLoading: false,
  user: {
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
  },
});

const handleRegister = () => {
  const user = state.value.user;
  if (!user.username) {
    window.$message.warning($t("register.usernameRequired"));
    return;
  }
  if (!user.password) {
    window.$message.warning($t("register.passwordRequired"));
    return;
  }
  if (user.password.length < 6 || user.password.length > 20) {
    window.$message.warning($t("register.passwordLength"));
    return;
  }
  if (!user.confirmPassword) {
    window.$message.warning($t("register.confirmPasswordRequired"));
    return;
  }
  if (user.password !== user.confirmPassword) {
    window.$message.warning($t("register.passwordMismatch"));
    return;
  }

  state.value.registerLoading = true;
  const obj = {
    username: user.username,
    password: user.password,
    email: user.email || undefined,
  };
  axios
    .post("/auth/register", obj)
    .then((res) => {
      // 成功：无 code（旧版后端）或 code 为 0 / 200；否则视为业务失败（如用户名已存在）
      const code = res && res.code !== undefined ? Number(res.code) : 0;
      if (res && res.code !== undefined && code !== 0 && code !== 200) {
        window.$message.error(res.message || $t("register.registerFailed"));
        state.value.registerLoading = false;
        return;
      }
      window.$message.success($t("register.registerSuccess"));
      Router.push("/login");
      state.value.registerLoading = false;
    })
    .catch((e) => {
      state.value.registerLoading = false;
      window.$message.error(e?.message || $t("register.registerFailed"));
    });
};

function goLogin() {
  Router.push("/login");
}
</script>

<style lang="scss" scoped>
.registerPage {
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

    .register-form {
      display: flex;
      flex-direction: column;
      gap: 20px;

      :deep(.t-input) {
        border-radius: 8px;
      }
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
      margin-top: 24px;
      opacity: 0.6;
      font-size: 14px;
    }
  }
  .tips {
    opacity: 0.5;
    font-size: 12px;
    margin-top: 18px;
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
