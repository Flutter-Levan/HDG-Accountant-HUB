"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/excel/file-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  readInvoiceFile,
  mergeInvoiceSheets,
  downloadWorkbook,
} from "@/lib/excel/invoice-merger";
import type {
  InvoiceMergeResult,
  InvoiceFileInfo,
} from "@/lib/excel/invoice-merger";

export default function MergeInvoicesPage() {
  const [fileName, setFileName] = useState<string | undefined>();
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileInfo, setFileInfo] = useState<InvoiceFileInfo | null>(null);
  const [giaTriCol, setGiaTriCol] = useState("");
  const [thueCol, setThueCol] = useState("");
  const [outputName, setOutputName] = useState("Tổng hợp bảng kê mua vào");
  const [result, setResult] = useState<InvoiceMergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setFileInfo(null);
    setGiaTriCol("");
    setThueCol("");
    try {
      const buffer = await file.arrayBuffer();
      setFileBuffer(buffer);
      setFileName(file.name);
      const info = readInvoiceFile(buffer);
      setFileInfo(info);
    } catch {
      setError("Không thể đọc file. Vui lòng kiểm tra định dạng file.");
    }
  }, []);

  const handleClear = useCallback(() => {
    setFileName(undefined);
    setFileBuffer(null);
    setFileInfo(null);
    setGiaTriCol("");
    setThueCol("");
    setResult(null);
    setError(null);
  }, []);

  const handleMerge = useCallback(() => {
    setError(null);
    if (!fileBuffer) {
      setError("Vui lòng upload file Excel.");
      return;
    }
    const gt = giaTriCol.trim().toUpperCase();
    const th = thueCol.trim().toUpperCase();
    if (!gt || !th) {
      setError("Vui lòng nhập cột Giá trị HHDV và Thuế GTGT (VD: I, K).");
      return;
    }
    if (!/^[A-Z]{1,2}$/.test(gt) || !/^[A-Z]{1,2}$/.test(th)) {
      setError("Tên cột không hợp lệ. Vui lòng nhập chữ cái Excel (VD: I, K, AA).");
      return;
    }
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      try {
        const mergeResult = mergeInvoiceSheets(
          fileBuffer,
          outputName,
          gt,
          th
        );
        if (mergeResult.sheets.length === 0) {
          setError("Không tìm thấy sheet nào trong file.");
        } else {
          setResult(mergeResult);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Có lỗi xảy ra khi xử lý file. Vui lòng kiểm tra lại định dạng."
        );
      } finally {
        setLoading(false);
      }
    }, 50);
  }, [fileBuffer, outputName, giaTriCol, thueCol]);

  const handleExport = useCallback(() => {
    if (!result) return;
    setExporting(true);
    toast.success("Đang tải file...");
    setTimeout(() => {
      try {
        downloadWorkbook(result.workbook, outputName);
      } finally {
        setExporting(false);
      }
    }, 50);
  }, [result, outputName]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">
          Tổng hợp Bảng kê hoá đơn, chứng từ hàng hoá, dịch vụ mua vào
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
          Gộp bảng kê hoá đơn mua vào từ nhiều tháng (nhiều sheet) thành 1 file
          tổng hợp duy nhất.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-medium">Lỗi: {error}</p>
        </div>
      )}

      {/* Upload + Hướng dẫn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div>
          <FileUploader
            label="File bảng kê hoá đơn (nhiều sheet)"
            fileName={fileName}
            onFileSelect={handleFileSelect}
            onClear={handleClear}
          />
          <p className="text-xs text-muted-foreground mt-2 px-1">
            File Excel với nhiều sheet, mỗi sheet là 1 tháng (T1, T2, T3...).
            Mỗi sheet chứa bảng kê hoá đơn mua vào của tháng đó.
          </p>
        </div>

        {/* Hướng dẫn sử dụng */}
        <div className="p-4 border border-border rounded-md bg-muted/30">
          <h3 className="text-sm font-semibold mb-3">Hướng dẫn sử dụng</h3>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
            <li>
              Chuẩn bị file Excel với <strong>nhiều sheet</strong>, mỗi sheet
              đặt tên là T1, T2, T3... tương ứng từng tháng.
            </li>
            <li>
              Upload file → hệ thống sẽ tự nhận diện các sheet.
            </li>
            <li>
              Nhập <strong>chữ cái cột</strong> trong Excel cho{" "}
              <strong>Giá trị HHDV</strong> và <strong>Thuế GTGT</strong>{" "}
              (VD: I, K). Mở file Excel để xem cột nào tương ứng.
            </li>
            <li>
              Đặt tên file xuất rồi nhấn <strong>Thực hiện tổng hợp</strong>.
            </li>
            <li>
              Kiểm tra thống kê và nhấn <strong>Tải file kết quả</strong> để tải
              về.
            </li>
          </ol>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Lưu ý:</strong> File kết quả sẽ gộp tất cả tháng thành 1
              sheet, phân cách bằng tên tháng. Tháng không có dữ liệu vẫn được
              ghi tên. Tổng cuối tính chính xác từ tất cả các tháng.
            </p>
          </div>
        </div>
      </div>

      {/* Thông tin file + nhập cột */}
      {fileInfo && (
        <div className="mb-6 space-y-4">
          {/* Danh sách sheet */}
          <div className="p-3 bg-muted/30 border border-border rounded-md">
            <p className="text-sm font-medium mb-1">
              Nhận diện được {fileInfo.sheetNames.length} sheet:
            </p>
            <p className="text-xs text-muted-foreground">
              {fileInfo.sheetNames.join(", ")}
            </p>
          </div>

          {/* Nhập cột */}
          <div>
            <h2 className="text-sm font-semibold mb-3">
              Nhập cột giá trị và thuế
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Mở file Excel, xem cột nào chứa &quot;Giá trị HHDV&quot; và &quot;Thuế GTGT&quot;, rồi nhập chữ cái cột tương ứng (VD: I, K).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Cột Giá trị HHDV mua vào chưa có thuế
                </label>
                <input
                  type="text"
                  value={giaTriCol}
                  onChange={(e) => setGiaTriCol(e.target.value.toUpperCase())}
                  className="w-24 px-3 py-2 border border-border rounded-md text-sm bg-background uppercase text-center font-mono"
                  placeholder="VD: I"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Cột Thuế GTGT đủ điều kiện khấu trừ
                </label>
                <input
                  type="text"
                  value={thueCol}
                  onChange={(e) => setThueCol(e.target.value.toUpperCase())}
                  className="w-24 px-3 py-2 border border-border rounded-md text-sm bg-background uppercase text-center font-mono"
                  placeholder="VD: K"
                  maxLength={2}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tên file xuất */}
      {fileInfo && (
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">
            Tên file xuất
          </label>
          <input
            type="text"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-border rounded-md text-sm bg-background"
            placeholder="Tổng hợp bảng kê mua vào"
          />
        </div>
      )}

      {/* Nút thực hiện */}
      {fileInfo && (
        <div className="flex items-center gap-3 mb-6">
          <Button
            onClick={handleMerge}
            disabled={loading || !giaTriCol.trim() || !thueCol.trim()}
          >
            {loading ? "Đang xử lý..." : "Thực hiện tổng hợp"}
          </Button>
          {result && (
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? "Đang xuất file..." : "Tải file kết quả (.xlsx)"}
            </Button>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Đang tổng hợp dữ liệu, vui lòng chờ...
            </div>
          )}
        </div>
      )}

      {/* Kết quả */}
      {result && (
        <div className="space-y-4">
          {/* Thống kê tổng */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {result.sheets.length}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500">
                Số tháng (sheet)
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {result.totalRows.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">
                Tổng số dòng
              </p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-md">
              <p className="text-lg font-bold text-purple-700 dark:text-purple-400">
                {result.totalGiaTri.toLocaleString()}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-500">
                Tổng giá trị HHDV
              </p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md">
              <p className="text-lg font-bold text-orange-700 dark:text-orange-400">
                {result.totalThue.toLocaleString()}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-500">
                Tổng thuế GTGT
              </p>
            </div>
          </div>

          {/* Chi tiết từng tháng */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Chi tiết từng tháng
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">
                        Tháng
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Số dòng
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Giá trị HHDV
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Thuế GTGT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sheets.map((s) => (
                      <tr key={s.name} className="border-b">
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2 text-right">
                          {s.rowCount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {s.totalGiaTri.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {s.totalThue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 font-semibold">
                      <td className="px-3 py-2">Tổng cộng</td>
                      <td className="px-3 py-2 text-right">
                        {result.totalRows.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {result.totalGiaTri.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {result.totalThue.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
