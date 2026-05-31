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
  const [open, setOpen] = useState(false);
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
      setError("Vui lòng chọn cột Tiền.");
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
    <div className="mb-6 border border-border rounded-md bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold flex items-center gap-2">
          <span>✂️</span>
          Sửa file chế: tách đơn &gt; {(MAX_AMOUNT / 1_000_000).toLocaleString()}{" "}
          triệu thành số lẻ
        </span>
        <span className="text-xs text-muted-foreground">
          {open ? "Thu gọn ▲" : "Mở rộng ▼"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Upload file chế, chọn cột Tiền. Mọi đơn có tiền &gt;{" "}
            {MAX_AMOUNT.toLocaleString()} sẽ được tách ngẫu nhiên thành nhiều dòng
            (mỗi dòng ≤ {MAX_AMOUNT.toLocaleString()}, số lẻ tới đơn vị đồng), tổng
            tiền giữ nguyên. Các cột khác (loại, Mã Khách hàng, Số Job, Số S/R...) được giữ nguyên cho
            từng dòng tách.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">Lỗi: {error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FileUploader
              label="File chế cần tách"
              fileName={file?.fileName}
              onFileSelect={handleFileSelect}
              onClear={handleClear}
            />
            {sheet && (
              <ColumnMapper
                label="Cột Tiền"
                columns={sheet.headers}
                selectedColumn={amountCol}
                onSelect={setAmountCol}
              />
            )}
          </div>

          {sheet && (
            <div className="mb-4">
              <DataPreview
                title={`Xem trước: ${file!.fileName}`}
                headers={sheet.headers}
                rows={sheet.rows}
                maxRows={5}
              />
            </div>
          )}

          {sheet && (
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">
                Tên file xuất
              </label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className="w-full max-w-sm px-3 py-2 border border-border rounded-md text-sm bg-background"
                placeholder="File Chế Đã Tách"
              />
            </div>
          )}

          {sheet && (
            <Button
              onClick={handleSplitAndExport}
              disabled={processing || !amountCol}
            >
              {processing ? "Đang xử lý..." : "Tách & tải file (.xlsx)"}
            </Button>
          )}

          {preview && (
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md text-sm">
                <p className="text-green-700 dark:text-green-400 font-medium">
                  Đã tách {preview.splitRows.toLocaleString()} đơn lớn → tổng{" "}
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
      )}
    </div>
  );
}
