import axios from "@/utils/axios";

export default defineStore(
  "user",
  () => {
    const token = ref<string>(localStorage.getItem("token") || "");
    const userId = ref<number | null>(localStorage.getItem("userId") ? Number(localStorage.getItem("userId")) : null);
    const name = ref("");
    const role = ref("");
    const email = ref("");
    // 余额，单位：分
    const balance = ref<number>(0);

    // 拉取用户信息（含余额），成功后更新 store
    async function fetchUserInfo() {
      const { data } = await axios.post("/auth/userInfo");
      userId.value = data.id ?? userId.value;
      name.value = data.name ?? data.nickname ?? name.value;
      email.value = data.email ?? email.value;
      role.value = data.role ?? role.value;
      balance.value = data.balance ?? balance.value;
      return data;
    }

    return { token, userId, name, role, email, balance, fetchUserInfo };
  },
  { persist: true },
);
