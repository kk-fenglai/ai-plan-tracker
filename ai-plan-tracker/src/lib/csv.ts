export type Cell = string | number | undefined;

/**
 * 按 RFC 4180 生成 CSV：含逗号、引号、换行的字段加引号。
 * 以 = + - @ 开头的文本前加 '，防止在 Excel 里被当成公式执行。
 */
export function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    if (v === undefined) return "";
    if (typeof v === "number") return String(v);
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** 在浏览器里下载 CSV。加 BOM，Excel 打开中文才不会乱码。 */
export function downloadCsv(filename: string, rows: Cell[][]): void {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // 立刻释放会让部分浏览器来不及开始下载。
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
