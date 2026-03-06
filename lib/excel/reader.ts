import * as XLSX from "xlsx";
import type { ExcelFile, ExcelSheet, ExcelRow } from "@/types/excel";

export function readExcelFile(file: ArrayBuffer, fileName: string): ExcelFile {
  const workbook = XLSX.read(file, { type: "array" });

  const sheets: ExcelSheet[] = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
      defval: null,
    });

    const headers =
      jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

    return {
      name: sheetName,
      headers,
      rows: jsonData,
    };
  });

  if (sheets.length === 0) {
    throw new Error(`File "${fileName}" khong co du lieu hoac khong hop le.`);
  }

  return { fileName, sheets };
}
