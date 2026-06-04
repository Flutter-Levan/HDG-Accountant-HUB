"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/excel/file-uploader";
import { ColumnMapper } from "@/components/excel/column-mapper";
import { DataPreview } from "@/components/excel/data-preview";
import { readExcelFile } from "@/lib/excel/reader";
import { exportToExcel } from "@/lib/excel/writer";
import { splitOrderFile, MAX_AMOUNT } from "@/lib/excel/order-splitter";
import type { ExcelFile, ExcelRow } from "@/types/excel";

export function OrderSplitter() {
  const [file, setFile] = useState<ExcelFile | null>(null);
  const [amountCol, setAmountCol] = useState("");
  const [outputName, setOutputName] = useState("File Chế Đã Tách");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    rows: ExcelRow[];
    splitRows: number;
    generatedRows: number;
  } | null>(null);

  const sheet = file?.sheets[0];
  const maxTrieu = (MAX_AMOUNT / 1_000_000).toLocaleString();

  const handleFileSelect = useCallback(async (f: File) => {
    setError(null);
    setPreview(null);
    try {
      const buffer = await f.arrayBuffer();
      const excelFile = readExcelFile(buffer, f.name);
      setFile(excelFile);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể đọc file. Vui lòng kiểm tra định dạng file."
      );
    }
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setAmountCol("");
    setPreview(null);
    setError(null);
  }, []);

  const handleSplitAndExport = useCallback(() => {
    setError(null);
    if (!sheet) {
      setError("Vui lòng upload file chế.");
      return;
    }
    if (!amountCol) {
      setError("Vui lòng chọn cột Số tiền.");
      return;
    }
    setProcessing(true);
    toast.success("Đang tách và tải file...");
    setTimeout(() => {
      try {
        const result = splitOrderFile(sheet.rows, amountCol);
        setPreview({
          rows: result.rows,
          splitRows: result.stats.splitRows,
          generatedRows: result.stats.generatedRows,
        });
        exportToExcel(result.rows, outputName, "File Chế Đã Tách");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Có lỗi xảy ra khi tách file."
        );
      } finally {
        setProcessing(false);
      }
    }, 50);
  }, [sheet, amountCol, outputName]);

  return (
    <div className="mb-6 max-w-4xl border border-border rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950 text-2xl">
          ✂️
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight">
            Sửa file chế: tách đơn &gt; {maxTrieu} triệu thành số lẻ
          </h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Công cụ tiền xử lý (tùy chọn) — tách các đơn lớn thành nhiều dòng số lẻ trước khi phân bổ.
          </p>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Mô tả cách hoạt động */}
        <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Mọi đơn có <strong>Số tiền &gt; {MAX_AMOUNT.toLocaleString()}</strong> sẽ được tách
            ngẫu nhiên thành nhiều dòng (mỗi dòng ≤ {MAX_AMOUNT.toLocaleString()}, số lẻ tới đơn
            vị đồng), <strong>tổng tiền giữ nguyên</strong>. Các cột khác (loại, Mã Khách hàng,
            Số Job, Số S/R...) được giữ nguyên cho từng dòng tách.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive font-medium">Lỗi: {error}</p>
          </div>
        )}

        {/* Bước 1: Upload + chọn cột */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            1. Chọn file &amp; cột Số tiền
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileUploader
              label="File chế cần tách"
              fileName={file?.fileName}
              onFileSelect={handleFileSelect}
              onClear={handleClear}
            />
            {sheet && (
              <ColumnMapper
                label="Cột Số tiền"
                columns={sheet.headers}
                selectedColumn={amountCol}
                onSelect={setAmountCol}
              />
            )}
          </div>
        </div>

        {sheet && (
          <DataPreview
            title={`Xem trước: ${file!.fileName}`}
            headers={sheet.headers}
            rows={sheet.rows}
            maxRows={5}
          />
        )}

        {/* Bước 2: Tên file + nút */}
        {sheet && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              2. Đặt tên &amp; tải file kết quả
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 max-w-sm">
                <label className="block text-sm font-medium mb-1.5">
                  Tên file xuất
                </label>
                <input
                  type="text"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background"
                  placeholder="File Chế Đã Tách"
                />
              </div>
              <Button
                onClick={handleSplitAndExport}
                disabled={processing || !amountCol}
              >
                {processing ? "Đang xử lý..." : "Tách & tải file (.xlsx)"}
              </Button>
            </div>
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md text-sm">
              <p className="text-green-700 dark:text-green-400 font-medium">
                ✓ Đã tách {preview.splitRows.toLocaleString()} đơn lớn → tổng{" "}
                {preview.generatedRows.toLocaleString()} dòng. File đã được tải về.
              </p>
            </div>
            <DataPreview
              title="Xem trước kết quả sau khi tách"
              headers={sheet!.headers}
              rows={preview.rows}
              maxRows={30}
            />
          </div>
        )}
      </div>
    </div>
  );
}
