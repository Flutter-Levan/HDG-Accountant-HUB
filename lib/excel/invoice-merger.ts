import * as XLSX from "xlsx";

export interface InvoiceSheetInfo {
  name: string;
  rowCount: number;
  totalGiaTri: number;
  totalThue: number;
}

export interface InvoiceMergeResult {
  sheets: InvoiceSheetInfo[];
  totalGiaTri: number;
  totalThue: number;
  totalRows: number;
  workbook: XLSX.WorkBook;
}

/**
 * Phân tích file Excel nhiều sheet (T1, T2...) và tổng hợp thành 1 sheet duy nhất.
 * Mỗi sheet là bảng kê hoá đơn mua vào 1 tháng.
 */
export function mergeInvoiceSheets(
  fileBuffer: ArrayBuffer,
  outputName: string
): InvoiceMergeResult {
  const wb = XLSX.read(fileBuffer, { type: "array" });

  const sheetsInfo: InvoiceSheetInfo[] = [];
  let grandTotalGiaTri = 0;
  let grandTotalThue = 0;
  let grandTotalRows = 0;

  // Đọc header từ sheet đầu tiên để dùng làm template
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const firstRaw: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: null,
  });

  // Tìm dòng header cột (chứa "STT") và dòng bắt đầu data
  const { headerRows, dataStartRow, colCount, giaTriCol, thueCol } =
    findStructure(firstRaw);

  // Build output rows
  const outputRows: unknown[][] = [];

  // Copy header rows từ sheet đầu (phần tiêu đề bảng kê, thông tin công ty...)
  for (let i = 0; i < dataStartRow; i++) {
    outputRows.push(padRow(firstRaw[i] || [], colCount));
  }

  // Xử lý từng sheet (tháng)
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
    });

    // Tìm cấu trúc cho sheet này
    const sheetStruct = findStructure(raw);

    // Lấy data rows (giữa header và dòng "Tổng")
    const dataRows = extractDataRows(raw, sheetStruct.dataStartRow);

    let sheetGiaTri = 0;
    let sheetThue = 0;

    for (const row of dataRows) {
      const gv = toNumber(row[giaTriCol]);
      const th = toNumber(row[thueCol]);
      sheetGiaTri += gv;
      sheetThue += th;
    }

    sheetsInfo.push({
      name: sheetName,
      rowCount: dataRows.length,
      totalGiaTri: sheetGiaTri,
      totalThue: sheetThue,
    });

    grandTotalGiaTri += sheetGiaTri;
    grandTotalThue += sheetThue;
    grandTotalRows += dataRows.length;

    // Thêm label tháng
    const labelRow = new Array(colCount).fill(null);
    labelRow[0] = sheetName;
    outputRows.push(labelRow);

    // Thêm data rows
    for (const row of dataRows) {
      outputRows.push(padRow(row, colCount));
    }
  }

  // Thêm dòng trống
  outputRows.push(new Array(colCount).fill(null));

  // Dòng "Tổng"
  const totalRow = new Array(colCount).fill(null);
  totalRow[0] = "";
  // Tìm cột gần giữa để ghi "Tổng"
  const tongLabelCol = Math.max(0, giaTriCol - 2);
  totalRow[tongLabelCol] = "Tổng";
  totalRow[giaTriCol] = grandTotalGiaTri;
  totalRow[thueCol] = grandTotalThue;
  outputRows.push(totalRow);

  // Dòng trống
  outputRows.push(new Array(colCount).fill(null));
  outputRows.push(new Array(colCount).fill(null));

  // Dòng tổng kết cuối
  const summaryRow1 = new Array(colCount).fill(null);
  summaryRow1[0] =
    "Tổng giá trị HHDV mua vào phục vụ SXKD được khấu trừ thuế GTGT (**):";
  summaryRow1[giaTriCol] = grandTotalGiaTri;
  outputRows.push(summaryRow1);

  const summaryRow2 = new Array(colCount).fill(null);
  summaryRow2[0] =
    "Tổng số thuế GTGT của HHDV mua vào đủ điều kiện được khấu trừ (***):";
  summaryRow2[giaTriCol] = grandTotalThue;
  outputRows.push(summaryRow2);

  // Tạo workbook output
  const outWs = XLSX.utils.aoa_to_sheet(outputRows);

  // Copy column widths từ sheet đầu nếu có
  if (firstSheet["!cols"]) {
    outWs["!cols"] = firstSheet["!cols"];
  }

  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, outWs, outputName || "Tổng hợp");

  return {
    sheets: sheetsInfo,
    totalGiaTri: grandTotalGiaTri,
    totalThue: grandTotalThue,
    totalRows: grandTotalRows,
    workbook: outWb,
  };
}

/**
 * Tải workbook đã tạo thành file .xlsx
 */
export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

// --- Helpers ---

interface SheetStructure {
  headerRows: unknown[][];
  dataStartRow: number;
  colCount: number;
  giaTriCol: number;
  thueCol: number;
}

function findStructure(raw: unknown[][]): SheetStructure {
  let dataStartRow = 0;
  let colCount = 10; // default
  let giaTriCol = 7; // default col I (0-indexed = 8, but often col index varies)
  let thueCol = 9; // default col K

  // Tìm dòng có "(1)" hoặc "STT" ở cột đầu tiên - đây là dòng sub-header
  // Dòng data bắt đầu ngay sau đó
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const row = raw[i] || [];
    const firstCell = String(row[0] ?? "").trim();
    const secondCell = String(row[1] ?? "").trim();

    // Tìm dòng có "(1)" - sub-header numbering row
    if (firstCell === "(1)" && secondCell === "(2)") {
      dataStartRow = i + 1;
      colCount = row.length;
      break;
    }

    // Hoặc tìm dòng "STT"
    if (firstCell === "STT" || firstCell.toLowerCase() === "stt") {
      // Dòng tiếp theo có thể là sub-header (1), (2)...
      if (i + 1 < raw.length) {
        const nextRow = raw[i + 1] || [];
        const nextFirst = String(nextRow[0] ?? "").trim();
        if (nextFirst === "(1)") {
          dataStartRow = i + 2;
          colCount = Math.max(row.length, nextRow.length);
        } else {
          dataStartRow = i + 1;
          colCount = row.length;
        }
      } else {
        dataStartRow = i + 1;
        colCount = row.length;
      }
      break;
    }
  }

  // Nếu không tìm được, dùng heuristic: tìm dòng đầu tiên có số 1 ở cột đầu
  if (dataStartRow === 0) {
    for (let i = 0; i < Math.min(raw.length, 20); i++) {
      const row = raw[i] || [];
      if (toNumber(row[0]) === 1 && row.length > 3) {
        dataStartRow = i;
        colCount = row.length;
        break;
      }
    }
  }

  // Tìm cột "Giá trị HHDV" và "Thuế GTGT" từ header rows
  for (let i = Math.max(0, dataStartRow - 4); i < dataStartRow; i++) {
    const row = raw[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? "").toLowerCase();
      if (
        cell.includes("giá trị") &&
        (cell.includes("hhdv") || cell.includes("mua vào") || cell.includes("chưa có thuế"))
      ) {
        giaTriCol = j;
      }
      if (
        cell.includes("thuế gtgt") ||
        (cell.includes("thuế") && cell.includes("khấu trừ"))
      ) {
        thueCol = j;
      }
    }
  }

  const headerRows = raw.slice(0, dataStartRow);

  return { headerRows, dataStartRow, colCount, giaTriCol, thueCol };
}

function extractDataRows(raw: unknown[][], dataStartRow: number): unknown[][] {
  const dataRows: unknown[][] = [];

  for (let i = dataStartRow; i < raw.length; i++) {
    const row = raw[i] || [];
    const firstCell = String(row[0] ?? "").trim().toLowerCase();

    // Dừng khi gặp dòng "Tổng" hoặc dòng tổng kết
    if (
      firstCell === "tổng" ||
      firstCell.includes("tổng giá trị") ||
      firstCell.includes("tổng số thuế")
    ) {
      break;
    }

    // Kiểm tra cột khác có chứa "Tổng" không (có thể "Tổng" nằm ở cột giữa)
    let isTotalRow = false;
    for (let j = 0; j < Math.min(row.length, 8); j++) {
      const cell = String(row[j] ?? "").trim().toLowerCase();
      if (cell === "tổng") {
        isTotalRow = true;
        break;
      }
    }
    if (isTotalRow) break;

    // Skip dòng hoàn toàn trống
    const hasData = row.some(
      (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
    );
    if (!hasData) continue;

    // Skip dòng chỉ có text mô tả (không có số ở cột cuối)
    // Nhưng vẫn giữ dòng data bình thường
    dataRows.push(row);
  }

  return dataRows;
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const str = String(val).replace(/[,.\s]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function padRow(row: unknown[], length: number): unknown[] {
  const padded = [...row];
  while (padded.length < length) {
    padded.push(null);
  }
  return padded;
}
