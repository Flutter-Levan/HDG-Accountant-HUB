"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/excel/file-uploader";
import { DataPreview } from "@/components/excel/data-preview";
import { ColumnMapper } from "@/components/excel/column-mapper";
import { readExcelFile } from "@/lib/excel/reader";
import { exportMultiSheetExcel } from "@/lib/excel/writer";
import { mergeExcelData } from "@/lib/excel/merger";
import type { ExcelFile, MergeResult } from "@/types/excel";

export default function MergeExcelPage() {
  const [file1, setFile1] = useState<ExcelFile | null>(null);
  const [file2, setFile2] = useState<ExcelFile | null>(null);
  const [keyCol1, setKeyCol1] = useState("");
  const [keyCol2, setKeyCol2] = useState("");
  const [result, setResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (file: File, setter: (f: ExcelFile | null) => void) => {
      setError(null);
      setResult(null);
      try {
        const buffer = await file.arrayBuffer();
        const excelFile = readExcelFile(buffer, file.name);
        setter(excelFile);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Khong the doc file. Vui long kiem tra dinh dang file."
        );
      }
    },
    []
  );

  const handleMerge = useCallback(() => {
    setError(null);
    if (!file1 || !file2) {
      setError("Vui long upload ca 2 file.");
      return;
    }
    if (!keyCol1 || !keyCol2) {
      setError("Vui long chon cot de noi khop cho ca 2 file.");
      return;
    }

    const sheet1 = file1.sheets[0];
    const sheet2 = file2.sheets[0];

    if (!sheet1.headers.includes(keyCol1)) {
      setError(`Cot "${keyCol1}" khong ton tai trong file 1.`);
      return;
    }
    if (!sheet2.headers.includes(keyCol2)) {
      setError(`Cot "${keyCol2}" khong ton tai trong file 2.`);
      return;
    }

    const mergeResult = mergeExcelData(
      sheet1.rows,
      sheet2.rows,
      keyCol1,
      keyCol2
    );
    setResult(mergeResult);
  }, [file1, file2, keyCol1, keyCol2]);

  const handleExport = useCallback(() => {
    if (!result) return;

    const sheets = [
      { name: "KetQua_NoiKhop", data: result.merged },
    ];

    if (result.unmatchedFromFile1.length > 0) {
      sheets.push({
        name: "KhongKhop_File1",
        data: result.unmatchedFromFile1,
      });
    }
    if (result.unmatchedFromFile2.length > 0) {
      sheets.push({
        name: "KhongKhop_File2",
        data: result.unmatchedFromFile2,
      });
    }

    exportMultiSheetExcel(sheets, "KetQua_NoiKhop");
  }, [result]);

  const sheet1 = file1?.sheets[0];
  const sheet2 = file2?.sheets[0];

  const allMergedHeaders = result && result.merged.length > 0
    ? Object.keys(result.merged[0])
    : [];

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Noi khop 2 file Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload 2 file Excel, chon cot de noi khop, va tai ket qua ve.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-medium">Loi: {error}</p>
        </div>
      )}

      {/* Upload area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <FileUploader
          label="File 1 (VD: Tong doanh thu)"
          fileName={file1?.fileName}
          onFileSelect={(f) => handleFileSelect(f, setFile1)}
          onClear={() => {
            setFile1(null);
            setKeyCol1("");
            setResult(null);
          }}
        />
        <FileUploader
          label="File 2 (VD: Don hang chi tiet)"
          fileName={file2?.fileName}
          onFileSelect={(f) => handleFileSelect(f, setFile2)}
          onClear={() => {
            setFile2(null);
            setKeyCol2("");
            setResult(null);
          }}
        />
      </div>

      {/* Preview uploaded data */}
      {sheet1 && (
        <div className="mb-4">
          <DataPreview
            title={`Xem truoc: ${file1!.fileName}`}
            headers={sheet1.headers}
            rows={sheet1.rows}
            maxRows={5}
          />
        </div>
      )}
      {sheet2 && (
        <div className="mb-4">
          <DataPreview
            title={`Xem truoc: ${file2!.fileName}`}
            headers={sheet2.headers}
            rows={sheet2.rows}
            maxRows={5}
          />
        </div>
      )}

      {/* Column mapping */}
      {sheet1 && sheet2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <ColumnMapper
            label="Cot noi khop - File 1"
            columns={sheet1.headers}
            selectedColumn={keyCol1}
            onSelect={setKeyCol1}
          />
          <ColumnMapper
            label="Cot noi khop - File 2"
            columns={sheet2.headers}
            selectedColumn={keyCol2}
            onSelect={setKeyCol2}
          />
        </div>
      )}

      {/* Action buttons */}
      {sheet1 && sheet2 && (
        <div className="flex gap-3 mb-6">
          <Button onClick={handleMerge} disabled={!keyCol1 || !keyCol2}>
            Thuc hien noi khop
          </Button>
          {result && (
            <Button variant="outline" onClick={handleExport}>
              Tai file ket qua (.xlsx)
            </Button>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {result.matchedCount}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">Dong khop</p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                {result.unmatchedFromFile1.length}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500">
                Khong khop (File 1)
              </p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                {result.unmatchedFromFile2.length}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500">
                Khong khop (File 2)
              </p>
            </div>
          </div>

          {result.merged.length > 0 && (
            <DataPreview
              title="Ket qua noi khop"
              headers={allMergedHeaders}
              rows={result.merged}
              maxRows={20}
            />
          )}

          {result.unmatchedFromFile1.length > 0 && (
            <DataPreview
              title="Dong khong khop tu File 1"
              headers={sheet1!.headers}
              rows={result.unmatchedFromFile1}
              maxRows={20}
            />
          )}

          {result.unmatchedFromFile2.length > 0 && (
            <DataPreview
              title="Dong khong khop tu File 2"
              headers={sheet2!.headers}
              rows={result.unmatchedFromFile2}
              maxRows={20}
            />
          )}
        </div>
      )}
    </div>
  );
}
