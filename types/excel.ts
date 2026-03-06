export interface ExcelRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: ExcelRow[];
}

export interface ExcelFile {
  fileName: string;
  sheets: ExcelSheet[];
}

export interface MergeResult {
  merged: ExcelRow[];
  unmatchedFromFile1: ExcelRow[];
  unmatchedFromFile2: ExcelRow[];
  matchedCount: number;
}
