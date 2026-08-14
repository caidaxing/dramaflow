/**
 * 金额 / 时间 格式化工具
 *
 * 后端金额单位统一为「分」，前端展示需转「元」。
 */

// 分 -> 元字符串，保留两位，带 ¥ 前缀。示例：formatYuan(12345) => "¥123.45"
export function formatYuan(value?: number | string | null): string {
  const num = Number(value ?? 0) || 0;
  return "¥" + (num / 100).toFixed(2);
}

// 分 -> 元字符串（不带 ¥），用于输入框等场景
export function yuan(value?: number | string | null): string {
  const num = Number(value ?? 0) || 0;
  return (num / 100).toFixed(2);
}

// 元 -> 分（整数）
export function yuanToFen(value?: number | string | null): number {
  const num = Number(value ?? 0) || 0;
  return Math.round(num * 100);
}

// 时间戳/时间字符串 -> 展示格式（非法值返回 "-"）
export function formatTime(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "-";
  const d = new Date(Number(value) || String(value));
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
