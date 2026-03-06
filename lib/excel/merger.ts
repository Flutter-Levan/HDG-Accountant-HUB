import type { ExcelRow, MergeResult } from "@/types/excel";

function normalizeValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

export function mergeExcelData(
  data1: ExcelRow[],
  data2: ExcelRow[],
  keyColumn1: string,
  keyColumn2: string
): MergeResult {
  const merged: ExcelRow[] = [];
  const unmatchedFromFile1: ExcelRow[] = [];
  const matchedFile2Indices = new Set<number>();

  // Build lookup map for file2
  const file2Map = new Map<string, number[]>();
  data2.forEach((row, index) => {
    const key = normalizeValue(row[keyColumn2]);
    if (key) {
      const indices = file2Map.get(key) || [];
      indices.push(index);
      file2Map.set(key, indices);
    }
  });

  // Match file1 rows with file2
  for (const row1 of data1) {
    const key = normalizeValue(row1[keyColumn1]);
    if (!key) {
      unmatchedFromFile1.push(row1);
      continue;
    }

    const matchedIndices = file2Map.get(key);
    if (matchedIndices && matchedIndices.length > 0) {
      for (const idx of matchedIndices) {
        const row2 = data2[idx];
        // Merge: file1 columns first, then file2 columns (skip duplicate key column)
        const mergedRow: ExcelRow = { ...row1 };
        for (const [col, val] of Object.entries(row2)) {
          if (col === keyColumn2 && keyColumn1 !== keyColumn2) {
            mergedRow[`${col}_File2`] = val;
          } else if (col !== keyColumn2) {
            // If column name conflicts, prefix with _File2
            if (col in mergedRow) {
              mergedRow[`${col}_File2`] = val;
            } else {
              mergedRow[col] = val;
            }
          }
        }
        merged.push(mergedRow);
        matchedFile2Indices.add(idx);
      }
    } else {
      unmatchedFromFile1.push(row1);
    }
  }

  // Find unmatched from file2
  const unmatchedFromFile2 = data2.filter(
    (_, index) => !matchedFile2Indices.has(index)
  );

  return {
    merged,
    unmatchedFromFile1,
    unmatchedFromFile2,
    matchedCount: merged.length,
  };
}
