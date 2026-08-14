import { createRouter, createWebHashHistory } from "vue-router";
import userStore from "@/stores/user";
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/:catchAll(.*)",
      name: "404",
      meta: {
        title: "404",
      },
      component: () => import("@/pages/error/404.vue"),
    },
    {
      path: "/",
      redirect: "/workbench",
    },
    {
      path: "/workbench",
      component: () => import("@/pages/workbench/index.vue"),
      redirect: "/project",
      children: [
        {
          path: "/project",
          component: () => import("@/views/project/index.vue"),
        },
        {
          path: "/task",
          component: () => import("@/views/task/index.vue"),
        },
        // {
        //   path: "/detail",
        //   component: () => import("@/views/detail/index.vue"),
        // },
        {
          path: "/novel",
          component: () => import("@/views/novel/index.vue"),
        },
        {
          path: "/script",
          component: () => import("@/views/script/index.vue"),
        },
        {
          path: "/scriptAgent",
          component: () => import("@/views/scriptAgent/index.vue"),
        },
        {
          path: "/cornerScape",
          component: () => import("@/views/cornerScape/index.vue"),
        },
        {
          path: "/production",
          component: () => import("@/views/production/index.vue"),
        },
        {
          path: "/assets",
          component: () => import("@/views/assets/index.vue"),
        },
        {
          path: "/wallet",
          component: () => import("@/views/wallet/index.vue"),
        },
        {
          path: "/admin",
          component: () => import("@/views/admin/index.vue"),
          meta: { admin: true },
        },
        {
          path: "/admin/users",
          component: () => import("@/views/admin/users.vue"),
          meta: { admin: true },
        },
        {
          path: "/admin/orders",
          component: () => import("@/views/admin/orders.vue"),
          meta: { admin: true },
        },
        {
          path: "/test",
          component: () => import("@/views/test/index.vue"),
        },
      ],
    },
    {
      path: "/login",
      component: () => import("@/pages/login/index.vue"),
    },
    {
      path: "/register",
      component: () => import("@/pages/register/index.vue"),
    },
  ],
});
router.beforeEach((to, from, next) => {
  if (to.path === "/login" || to.path === "/register") {
    next();
  } else {
    if (localStorage.getItem("token")) {
      // admin 页面守卫：非 admin 直接访问 URL 时重定向回 /project 并提示
      if (to.meta?.admin) {
        const user = userStore();
        const isAdmin = user.role === "admin";
        if (!isAdmin) {
          window.$message?.error?.(window.$t("admin.guard.notAdmin"));
          next("/project");
          return;
        }
      }
      next();
    } else {
      next("/login");
    }
  }
});
export default router;
