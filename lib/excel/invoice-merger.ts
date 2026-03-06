import * as XLSX from "xlsx-js-style";

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

export interface InvoiceFileInfo {
  sheetNames: string[];
  columns: string[];
}

/**
 * Chuyển index cột (0-based) thành chữ cái Excel: 0→A, 1→B, 25→Z, 26→AA...
 */
function colIndexToLetter(idx: number): string {
  let letter = "";
  let n = idx;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Chuyển chữ cái Excel thành index cột (0-based): A→0, B→1, Z→25, AA→26...
 */
export function colLetterToIndex(letter: string): number {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) {
    idx = idx * 26 + (letter.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * Đọc file Excel và trả về danh sách sheet + tên cột (chữ cái Excel + giá trị mẫu) để user chọn.
 */
export function readInvoiceFile(fileBuffer: ArrayBuffer): InvoiceFileInfo {
  const wb = XLSX.read(fileBuffer, { type: "array" });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: null,
  });

  const struct = findStructure(raw);
  const columns: string[] = [];

  // Tìm dòng header có "STT" để lấy tên cột
  let headerRow: unknown[] = [];
  for (let i = Math.max(0, struct.dataStartRow - 5); i < struct.dataStartRow; i++) {
    const row = raw[i] || [];
    const first = String(row[0] ?? "").trim().toUpperCase();
    if (first === "STT") {
      headerRow = row;
      break;
    }
  }

  // Tìm sample value: quét nhiều dòng data để lấy giá trị mẫu cho mỗi cột
  const sampleValues: string[] = new Array(struct.colCount).fill("");
  const maxScan = Math.min(struct.dataStartRow + 10, raw.length);
  for (let i = struct.dataStartRow; i < maxScan; i++) {
    const row = raw[i] || [];
    // Dừng nếu gặp dòng tổng
    const hasTotal = row.some((cell) => {
      const s = String(cell ?? "").trim().toLowerCase();
      return s === "tổng" || s.startsWith("tổng giá trị");
    });
    if (hasTotal) break;

    for (let j = 0; j < struct.colCount; j++) {
      if (sampleValues[j]) continue; // đã có sample
      const val = String(row[j] ?? "").trim();
      if (val) sampleValues[j] = val;
    }
    // Dừng sớm nếu đã có đủ sample
    if (sampleValues.every((v) => v)) break;
  }

  for (let j = 0; j < struct.colCount; j++) {
    const letter = colIndexToLetter(j);
    const headerText = String(headerRow[j] ?? "").trim();
    const sample = sampleValues[j];

    if (headerText && sample) {
      columns.push(`${letter}: ${headerText} (${sample})`);
    } else if (headerText) {
      columns.push(`${letter}: ${headerText}`);
    } else if (sample) {
      columns.push(`${letter}: ${sample}`);
    } else {
      columns.push(letter);
    }
  }

  return {
    sheetNames: wb.SheetNames,
    columns,
  };
}

/**
 * Copy style từ 1 cell của source sheet sang cell của output sheet.
 */
function copyCellStyle(
  sourceWs: XLSX.WorkSheet,
  sourceRow: number,
  sourceCol: number,
  targetWs: XLSX.WorkSheet,
  targetRow: number,
  targetCol: number
) {
  const srcAddr = XLSX.utils.encode_cell({ r: sourceRow, c: sourceCol });
  const tgtAddr = XLSX.utils.encode_cell({ r: targetRow, c: targetCol });
  const srcCell = sourceWs[srcAddr];
  const tgtCell = targetWs[tgtAddr];
  if (srcCell?.s && tgtCell) {
    tgtCell.s = srcCell.s;
  }
}

/**
 * Phân tích file Excel nhiều sheet (T1, T2...) và tổng hợp thành 1 sheet duy nhất.
 * Giữ nguyên format (màu, border, font) từ file gốc.
 */
export function mergeInvoiceSheets(
  fileBuffer: ArrayBuffer,
  outputName: string,
  giaTriColName: string,
  thueColName: string
): InvoiceMergeResult {
  const wb = XLSX.read(fileBuffer, { type: "array", cellStyles: true });

  const sheetsInfo: InvoiceSheetInfo[] = [];
  let grandTotalGiaTri = 0;
  let grandTotalThue = 0;
  let grandTotalRows = 0;

  // Đọc header từ sheet đầu tiên để dùng làm template
  const firstSheetName = wb.SheetNames[0];
  const firstSheet = wb.Sheets[firstSheetName];
  const firstRaw: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: null,
  });

  const firstStruct = findStructure(firstRaw);
  const { dataStartRow, colCount } = firstStruct;

  // Lấy index cột từ chữ cái Excel (VD: "I" → 8, "K" → 10)
  const giaTriCol = colLetterToIndex(giaTriColName.trim().toUpperCase());
  const thueCol = colLetterToIndex(thueColName.trim().toUpperCase());

  if (giaTriCol < 0 || thueCol < 0) {
    throw new Error("Không tìm thấy cột đã chọn trong file. Vui lòng kiểm tra lại.");
  }

  // Build output rows + tracking nguồn gốc style cho mỗi dòng
  const outputRows: unknown[][] = [];
  // Mỗi entry: { sheetName, sourceRow } để biết copy style từ đâu
  const rowSources: Array<{ sheetName: string; sourceRow: number } | null> = [];

  // Copy header rows từ sheet đầu
  for (let i = 0; i < dataStartRow; i++) {
    outputRows.push(padRow(firstRaw[i] || [], colCount));
    rowSources.push({ sheetName: firstSheetName, sourceRow: i });
  }

  // Tìm 1 dòng data mẫu trong sheet đầu để lấy style cho data rows
  const firstDataRows = extractDataRows(firstRaw, firstStruct);
  const sampleDataSourceRow = firstDataRows.length > 0
    ? firstStruct.dataStartRow // dòng data đầu tiên trong sheet gốc
    : -1;

  // Xử lý từng sheet (tháng)
  // Dùng dataStartRow từ sheet đầu tiên cho tất cả sheet (vì cấu trúc giống nhau)
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
    });

    // Thử tìm structure riêng, fallback về structure sheet đầu
    let sheetStruct = findStructure(raw);
    if (sheetStruct.dataStartRow === 0) {
      // Sheet này không detect được header → dùng structure từ sheet đầu
      sheetStruct = { ...firstStruct, headerRows: raw.slice(0, firstStruct.dataStartRow) };
    }
    const dataRows = extractDataRows(raw, sheetStruct);

    let sheetGiaTri = 0;
    let sheetThue = 0;

    for (const row of dataRows) {
      sheetGiaTri += toNumber(row[giaTriCol]);
      sheetThue += toNumber(row[thueCol]);
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
    rowSources.push(null); // label row - không copy style

    // Thêm data rows - lấy style từ dòng data tương ứng trong sheet nguồn
    let dataIdx = 0;
    for (const row of dataRows) {
      outputRows.push(padRow(row, colCount));
      rowSources.push({
        sheetName,
        sourceRow: sheetStruct.dataStartRow + dataIdx,
      });
      dataIdx++;
    }
  }

  // Dòng trống
  outputRows.push(new Array(colCount).fill(null));
  rowSources.push(null);

  // Dòng "Tổng"
  const totalRow = new Array(colCount).fill(null);
  const tongLabelCol = Math.max(0, giaTriCol - 2);
  totalRow[tongLabelCol] = "Tổng";
  totalRow[giaTriCol] = grandTotalGiaTri;
  totalRow[thueCol] = grandTotalThue;
  outputRows.push(totalRow);
  rowSources.push(null); // sẽ style riêng bên dưới

  // Dòng trống
  outputRows.push(new Array(colCount).fill(null));
  outputRows.push(new Array(colCount).fill(null));
  rowSources.push(null);
  rowSources.push(null);

  // Dòng tổng kết cuối
  const summaryRow1 = new Array(colCount).fill(null);
  summaryRow1[0] =
    "Tổng giá trị HHDV mua vào phục vụ SXKD được khấu trừ thuế GTGT (**):";
  summaryRow1[giaTriCol] = grandTotalGiaTri;
  outputRows.push(summaryRow1);
  rowSources.push(null);

  const summaryRow2 = new Array(colCount).fill(null);
  summaryRow2[0] =
    "Tổng số thuế GTGT của HHDV mua vào đủ điều kiện được khấu trừ (***):";
  summaryRow2[giaTriCol] = grandTotalThue;
  outputRows.push(summaryRow2);
  rowSources.push(null);

  // Tạo workbook output
  const outWs = XLSX.utils.aoa_to_sheet(outputRows);

  // Copy column widths
  if (firstSheet["!cols"]) {
    outWs["!cols"] = firstSheet["!cols"];
  }

  // Copy row heights từ sheet gốc cho header
  if (firstSheet["!rows"]) {
    outWs["!rows"] = [];
    for (let i = 0; i < dataStartRow; i++) {
      if (firstSheet["!rows"][i]) {
        outWs["!rows"][i] = { ...firstSheet["!rows"][i] };
      }
    }
  }

  // Copy merged cells từ header của sheet đầu
  if (firstSheet["!merges"]) {
    outWs["!merges"] = [];
    for (const merge of firstSheet["!merges"]) {
      // Chỉ copy merges trong vùng header
      if (merge.s.r < dataStartRow) {
        outWs["!merges"].push({ ...merge });
      }
    }
  }

  // Copy cell styles từ source sheets sang output
  for (let outRow = 0; outRow < outputRows.length; outRow++) {
    const source = rowSources[outRow];
    if (!source) continue;

    const sourceWs = wb.Sheets[source.sheetName];
    for (let col = 0; col < colCount; col++) {
      copyCellStyle(sourceWs, source.sourceRow, col, outWs, outRow, col);
    }
  }

  // Style cho dòng "Tổng" và summary - bold font
  const boldStyle = {
    font: { bold: true, sz: 11 },
  };

  // Tìm index dòng Tổng (sau dòng trống cuối data)
  const totalRowIdx = outputRows.length - 5; // Tổng row
  const summary1Idx = outputRows.length - 2;
  const summary2Idx = outputRows.length - 1;

  for (const rowIdx of [totalRowIdx, summary1Idx, summary2Idx]) {
    for (let col = 0; col < colCount; col++) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: col });
      if (outWs[addr]) {
        // Giữ style gốc nếu có, thêm bold
        outWs[addr].s = { ...(outWs[addr].s || {}), ...boldStyle };
      }
    }
  }

  // Style cho label tháng (T1, T2...) - bold + background
  const labelStyle = {
    font: { bold: true, sz: 11 },
    fill: { fgColor: { rgb: "D9E2F3" } },
  };
  for (let outRow = 0; outRow < outputRows.length; outRow++) {
    if (rowSources[outRow] === null) {
      const firstCellAddr = XLSX.utils.encode_cell({ r: outRow, c: 0 });
      const cell = outWs[firstCellAddr];
      if (cell && typeof cell.v === "string" && wb.SheetNames.includes(cell.v)) {
        for (let col = 0; col < colCount; col++) {
          const addr = XLSX.utils.encode_cell({ r: outRow, c: col });
          if (!outWs[addr]) {
            outWs[addr] = { t: "s", v: "" };
          }
          outWs[addr].s = { ...labelStyle };
        }
      }
    }
  }

  // Apply border cho tất cả data cells (giống file gốc)
  // Lấy border style từ dòng data đầu tiên của sheet gốc
  if (sampleDataSourceRow >= 0) {
    const sampleAddr = XLSX.utils.encode_cell({ r: sampleDataSourceRow, c: 0 });
    const sampleCell = firstSheet[sampleAddr];
    const sampleBorder = sampleCell?.s?.border;

    if (sampleBorder) {
      // Apply border cho data rows không có style
      for (let outRow = dataStartRow; outRow < outputRows.length; outRow++) {
        const source = rowSources[outRow];
        if (source) continue; // đã có style từ source
        for (let col = 0; col < colCount; col++) {
          const addr = XLSX.utils.encode_cell({ r: outRow, c: col });
          if (outWs[addr] && outWs[addr].s) {
            outWs[addr].s.border = outWs[addr].s.border || sampleBorder;
          }
        }
      }
    }
  }

  // Number format cho cột giá trị + thuế
  const numFmt = "#,##0";
  for (let outRow = dataStartRow; outRow < outputRows.length; outRow++) {
    for (const col of [giaTriCol, thueCol]) {
      const addr = XLSX.utils.encode_cell({ r: outRow, c: col });
      const cell = outWs[addr];
      if (cell && typeof cell.v === "number") {
        cell.s = { ...(cell.s || {}), numFmt };
        cell.z = numFmt;
      }
    }
  }

  const outWb = XLSX.utils.book_new();
  const wsName = (outputName || "Tổng hợp").slice(0, 31);
  XLSX.utils.book_append_sheet(outWb, outWs, wsName);

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
}

function findStructure(raw: unknown[][]): SheetStructure {
  let dataStartRow = 0;
  let colCount = 10;

  // Tìm dòng "(1)" — sub-header numbering
  for (let i = 0; i < Math.min(raw.length, 25); i++) {
    const row = raw[i] || [];
    const firstCell = String(row[0] ?? "").trim();

    if (firstCell === "(1)") {
      dataStartRow = i + 1;
      colCount = row.length;
      break;
    }
  }

  // Tìm dòng "STT"
  if (dataStartRow === 0) {
    for (let i = 0; i < Math.min(raw.length, 25); i++) {
      const row = raw[i] || [];
      const firstCell = String(row[0] ?? "").trim().toUpperCase();

      if (firstCell === "STT") {
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
  }

  // Heuristic: tìm dòng có STT = 1
  if (dataStartRow === 0) {
    for (let i = 0; i < Math.min(raw.length, 25); i++) {
      const row = raw[i] || [];
      if (toNumber(row[0]) === 1 && row.length > 3) {
        dataStartRow = i;
        colCount = row.length;
        break;
      }
    }
  }

  const headerRows = raw.slice(0, dataStartRow);
  return { headerRows, dataStartRow, colCount };
}

function extractDataRows(
  raw: unknown[][],
  struct: SheetStructure
): unknown[][] {
  const dataRows: unknown[][] = [];

  for (let i = struct.dataStartRow; i < raw.length; i++) {
    const row = raw[i] || [];

    // Skip dòng trống
    const hasData = row.some(
      (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
    );
    if (!hasData) continue;

    // Dừng khi gặp dòng "Tổng"
    let isTotalRow = false;
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? "").trim().toLowerCase();
      if (cell === "tổng" || cell.startsWith("tổng giá trị") || cell.startsWith("tổng số thuế")) {
        isTotalRow = true;
        break;
      }
    }
    if (isTotalRow) break;

    // Skip dòng mô tả (ví dụ "1. Hàng hoá, dịch vụ dùng riêng...")
    const firstCell = String(row[0] ?? "").trim();
    if (firstCell.match(/^\d+\.\s+\D/)) {
      continue;
    }

    dataRows.push(row);
  }

  return dataRows;
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const str = String(val).replace(/,/g, "").trim();
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
