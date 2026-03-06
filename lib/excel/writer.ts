import * as XLSX from "xlsx";
import type { ExcelRow } from "@/types/excel";

export function exportToExcel(
  data: ExcelRow[],
  fileName: string,
  sheetName: string = "KetQua"
) {
  if (data.length === 0) {
    throw new Error("Khong co du lieu de xuat file.");
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportMultiSheetExcel(
  sheets: { name: string; data: ExcelRow[] }[],
  fileName: string
) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if (sheet.data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    }
  }

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
