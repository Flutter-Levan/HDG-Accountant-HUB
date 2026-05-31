import type { ExcelRow } from "@/types/excel";

export const MAX_AMOUNT = 5_000_000;
const MIN_PART = 1_000_000;

export interface SplitFileResult {
  rows: ExcelRow[];
  stats: {
    totalRows: number; // số dòng gốc có tiền > 0
    splitRows: number; // số đơn gốc bị tách
    generatedRows: number; // tổng số dòng sau khi tách
  };
}

function parseAmount(value: ExcelRow[string]): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "boolean") return 0;
  // Bỏ định dạng (dấu phẩy, chấm, khoảng trắng)
  const cleaned = String(value).replace(/[,.\s]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Tách một số tiền lớn (> max) thành nhiều phần ngẫu nhiên.
 * - Mỗi phần <= max (5 triệu).
 * - Tổng các phần = đúng số ban đầu (không sai lệch 1 đồng).
 * - Các phần là số lẻ tới đơn vị đồng (vd 2.547.873), không tròn trĩnh.
 */
export function splitLargeAmount(total: number, max = MAX_AMOUNT): number[] {
  if (total <= max) return [total];

  const nMin = Math.ceil(total / max);
  // Cho phép thêm 1 phần để chia tự nhiên hơn, miễn là các phần không quá nhỏ
  let n = nMin;
  if (total / (nMin + 1) >= MIN_PART) {
    n = nMin + Math.floor(Math.random() * 2); // nMin hoặc nMin + 1
  }

  // Sàn mỗi phần, đảm bảo luôn khả thi: n * min <= total
  const min = Math.min(MIN_PART, Math.floor(total / n));

  const parts: number[] = [];
  let remaining = total;
  for (let i = 0; i < n - 1; i++) {
    const left = n - 1 - i; // số phần còn lại sau phần này
    // Giới hạn để phần còn lại vẫn nằm trong [min, max]
    const lb = Math.max(min, remaining - left * max);
    const ub = Math.min(max, remaining - left * min);
    const value =
      ub <= lb ? lb : lb + Math.floor(Math.random() * (ub - lb + 1));
    parts.push(value);
    remaining -= value;
  }
  parts.push(remaining); // phần cuối nhận phần dư -> tổng luôn khớp tuyệt đối

  return parts;
}

/**
 * Duyệt toàn bộ dòng của file chế: đơn nào có Tiền > max thì tách thành
 * nhiều dòng nhỏ, giữ nguyên các cột còn lại (loại, Mã Khách hàng, Số Job, Số S/R, ...).
 */
export function splitOrderFile(
  rows: ExcelRow[],
  amountCol: string,
  max = MAX_AMOUNT
): SplitFileResult {
  const out: ExcelRow[] = [];
  let splitRows = 0;
  let totalRows = 0;

  for (const row of rows) {
    const amount = parseAmount(row[amountCol]);

    // Bỏ qua dòng không có tiền (giữ nguyên trong file)
    if (amount <= 0) {
      out.push({ ...row });
      continue;
    }
    totalRows++;

    if (amount > max) {
      const parts = splitLargeAmount(amount, max);
      if (parts.length > 1) splitRows++;
      for (const part of parts) {
        out.push({ ...row, [amountCol]: part });
      }
    } else {
      out.push({ ...row });
    }
  }

  return {
    rows: out,
    stats: { totalRows, splitRows, generatedRows: out.length },
  };
}
