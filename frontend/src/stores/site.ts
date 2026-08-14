import axios from "@/utils/axios";
import settingStore from "@/stores/setting";

/**
 * 站点配置（白标）store
 *
 * 通过 GET /api/site/config 拉取站点级品牌化配置：
 * siteName / logoUrl / primaryColor / icpNo / customerService /
 * registerOpen ('0' 关闭注册 | '1' 开放注册) / announcement 等。
 *
 * 契约：字段可能缺失 / 为 null / 后端接口暂不可用，所有读取必须空值安全，
 * 失败或空值一律兜底为默认站点配置，保证页面不白屏、不报错。
 */

export interface SiteConfig {
  siteName: string;
  logoUrl: string;
  primaryColor: string;
  icpNo: string;
  customerService: string;
  registerOpen: string; // '0' 关闭 | '1' 开放
  announcement: string;
  loaded: boolean;
}

// 默认站点配置（后端接口不可用 / 字段为空时的兜底）
const DEFAULT_CONFIG = {
  siteName: "ToonFlow",
  logoUrl: "",
  primaryColor: "#0052D9",
  icpNo: "",
  customerService: "",
  registerOpen: "1",
  announcement: "",
};

// 校验并规范化主题色，非法返回空串
const normalizeColor = (value: string) => {
  const hex = (value || "").trim();
  if (!hex) return "";
  const normalized = hex.startsWith("#") ? hex : `#${hex}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : "";
};

// 解析 logo 地址：完整 URL / data: 原样返回；以 / 开头视为后端资源，拼上 API 源站；其余原样
const resolveUrl = (url: string) => {
  if (!url) return "";
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/")) {
    const base = (settingStore().baseUrl || "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
    return base ? base + url : url;
  }
  return url;
};

export default defineStore(
  "site",
  () => {
    const siteConfig = ref<SiteConfig>({ ...DEFAULT_CONFIG, loaded: false });

    // 是否开放注册（registerOpen === '0' 表示关闭）
    const registerOpen = computed(() => siteConfig.value.registerOpen !== "0");

    // 解析后的 logo 完整地址（空则页面使用默认 logo）
    const siteLogoUrl = computed(() => resolveUrl(siteConfig.value.logoUrl));

    // 站点名（空值兜底）
    const siteName = computed(() => siteConfig.value.siteName || DEFAULT_CONFIG.siteName);

    async function fetchSiteConfig() {
      try {
        const res: any = await axios.get("/site/config");
        // 兼容多种返回形态：
        //  1) {code, data: {config: {...}, list: [...]}, message}   ← 当前后端实际形态
        //  2) {code, data: {siteName, ...}, message}                ← 契约形态
        //  3) {siteName, ...}（直接返回字段）
        const payload = (res && res.data) || res || {};
        const data = payload.config || payload;
        siteConfig.value.siteName = data.siteName || DEFAULT_CONFIG.siteName;
        siteConfig.value.logoUrl = data.logoUrl || "";
        siteConfig.value.primaryColor = normalizeColor(data.primaryColor) || DEFAULT_CONFIG.primaryColor;
        siteConfig.value.icpNo = data.icpNo || "";
        siteConfig.value.customerService = data.customerService || "";
        siteConfig.value.registerOpen = String(data.registerOpen ?? DEFAULT_CONFIG.registerOpen);
        siteConfig.value.announcement = data.announcement || "";
        siteConfig.value.loaded = true;
      } catch (e) {
        // 拉取失败（接口未就绪 / 网络错误 / 401 等）：兜底默认配置，保持页面可用
        console.warn("拉取站点配置失败，使用默认配置", e);
        siteConfig.value.loaded = true;
      }
      return siteConfig.value;
    }

    return { siteConfig, siteName, siteLogoUrl, registerOpen, fetchSiteConfig };
  },
  { persist: false },
);
