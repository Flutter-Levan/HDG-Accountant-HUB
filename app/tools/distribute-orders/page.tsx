"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/excel/file-uploader";
import { DataPreview } from "@/components/excel/data-preview";
import { ColumnMapper } from "@/components/excel/column-mapper";
import { readExcelFile } from "@/lib/excel/reader";
import { exportToExcel } from "@/lib/excel/writer";
import { parseMRLong, distributeOrders } from "@/lib/excel/distributor";
import type { ExcelFile, ExcelRow } from "@/types/excel";
import type { DistributionResult } from "@/types/distribution";

export default function DistributeOrdersPage() {
  const [mrFile, setMrFile] = useState<ExcelFile | null>(null);
  const [orderFile, setOrderFile] = useState<ExcelFile | null>(null);

  const [sttCol, setSttCol] = useState("");
  const [nameCol, setNameCol] = useState("");
  const [amountCol, setAmountCol] = useState("");

  const [blDeptCol, setBlDeptCol] = useState("");
  const [soJobCol, setSoJobCol] = useState("");
  const [orderAmountCol, setOrderAmountCol] = useState("");

  const [outputName, setOutputName] = useState("Lương Kinh Doanh");
  const [showSubtotals, setShowSubtotals] = useState(false);

  const [result, setResult] = useState<DistributionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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
            : "Không thể đọc file. Vui lòng kiểm tra định dạng file."
        );
      }
    },
    []
  );

  const handleDistribute = useCallback(() => {
    setError(null);
    if (!mrFile || !orderFile) {
      setError("Vui lòng upload cả 2 file.");
      return;
    }
    if (!sttCol || !nameCol || !amountCol) {
      setError("Vui lòng chọn đầy đủ cột cho file Lương doanh số (STT, Họ tên, Lương doanh số).");
      return;
    }
    if (!blDeptCol || !soJobCol || !orderAmountCol) {
      setError("Vui lòng chọn đầy đủ cột cho File chế (BL Dept, Số Job, Tiền).");
      return;
    }

    setLoading(true);
    setResult(null);
    setTimeout(() => {
      try {
        const mrSheet = mrFile.sheets[0];
        const orderSheet = orderFile.sheets[0];

        const employees = parseMRLong(mrSheet.rows, sttCol, nameCol, amountCol);
        if (employees.length === 0) {
          setError(
            "Không tìm thấy nhân viên nào trong file Lương doanh số. Kiểm tra lại cột STT, Họ tên, Lương doanh số."
          );
          return;
        }

        const distributionResult = distributeOrders(
          employees,
          orderSheet.rows,
          blDeptCol,
          soJobCol,
          orderAmountCol
        );
        setResult(distributionResult);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Có lỗi xảy ra khi xử lý. Vui lòng kiểm tra lại dữ liệu."
        );
      } finally {
        setLoading(false);
      }
    }, 50);
  }, [mrFile, orderFile, sttCol, nameCol, amountCol, blDeptCol, soJobCol, orderAmountCol]);

  const buildExportData = useCallback(
    (withSubtotals: boolean): ExcelRow[] => {
      if (!result) return [];
      if (!withSubtotals) {
        return result.assignments.map((a) => ({
          "Họ tên": a.employeeName,
          "BL Dept": a.blDept,
          "Số Job": a.soJob,
          "Tiền": a.amount,
        }));
      }

      const rows: ExcelRow[] = [];
      let currentName = "";
      let subtotal = 0;

      for (const a of result.assignments) {
        if (a.employeeName !== currentName) {
          // Thêm dòng tổng cho nhân viên trước đó
          if (currentName && subtotal > 0) {
            rows.push({
              "Họ tên": "",
              "BL Dept": "",
              "Số Job": "",
              "Tiền": subtotal,
            });
          }
          currentName = a.employeeName;
          subtotal = 0;
        }
        rows.push({
          "Họ tên": a.employeeName,
          "BL Dept": a.blDept,
          "Số Job": a.soJob,
          "Tiền": a.amount,
        });
        subtotal += a.amount;
      }
      // Dòng tổng cho nhân viên cuối cùng
      if (currentName && subtotal > 0) {
        rows.push({
          "Họ tên": "",
          "BL Dept": "",
          "Số Job": "",
          "Tiền": subtotal,
        });
      }
      return rows;
    },
    [result]
  );

  const handleExport = useCallback(() => {
    if (!result) return;
    setExporting(true);
    toast.success("Đang tải file...");
    setTimeout(() => {
      try {
        const exportData = buildExportData(showSubtotals);
        exportToExcel(exportData, outputName, "Lương Kinh Doanh");
      } finally {
        setExporting(false);
      }
    }, 50);
  }, [result, outputName, showSubtotals, buildExportData]);

  const mrSheet = mrFile?.sheets[0];
  const orderSheet = orderFile?.sheets[0];

  const resultPreviewHeaders = ["Họ tên", "BL Dept", "Số Job", "Tiền"];
  const resultPreviewRows: ExcelRow[] = buildExportData(showSubtotals);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Tạo lương kinh doanh</h1>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
          Tạo file lương kinh doanh từ file lương doanh số nhân viên và pool đơn hàng. Tự động phân
          bổ đơn hàng sao cho tổng tiền = đúng lương doanh số.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-medium">Lỗi: {error}</p>
        </div>
      )}

      {/* Khu vực upload + hướng dẫn */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <FileUploader
            label="File lương doanh số nhân viên"
            fileName={mrFile?.fileName}
            onFileSelect={(f) => handleFileSelect(f, setMrFile)}
            onClear={() => {
              setMrFile(null);
              setSttCol("");
              setNameCol("");
              setAmountCol("");
              setResult(null);
            }}
          />
          <p className="text-xs text-muted-foreground mt-2 px-1">
            File lương doanh số nhân viên gốc mà bạn muốn tạo.{" "}
            <a
              href="/examples/file-luong-doanh-so-mau.xlsx"
              download
              className="text-primary underline hover:no-underline font-medium"
            >
              Tải file mẫu để xem tại đây
            </a>
          </p>
        </div>
        <div>
          <FileUploader
            label="File chế"
            fileName={orderFile?.fileName}
            onFileSelect={(f) => handleFileSelect(f, setOrderFile)}
            onClear={() => {
              setOrderFile(null);
              setBlDeptCol("");
              setSoJobCol("");
              setOrderAmountCol("");
              setResult(null);
            }}
          />
          <p className="text-xs text-muted-foreground mt-2 px-1">
            File này cần có BL Dept, Số Job, Tiền.{" "}
            <a
              href="/examples/file-che-mau.xlsx"
              download
              className="text-primary underline hover:no-underline font-medium"
            >
              Tải file mẫu để xem tại đây
            </a>
          </p>
        </div>

        {/* Hướng dẫn sử dụng */}
        <div className="p-4 border border-border rounded-md bg-muted/30">
          <h3 className="text-sm font-semibold mb-3">Hướng dẫn sử dụng</h3>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
            <li>
              Upload <strong>File lương doanh số nhân viên</strong> — file chứa danh sách nhân viên
              với cột STT, Họ tên, Lương doanh số.
            </li>
            <li>
              Upload <strong>File chế</strong> — file chứa pool đơn hàng với cột BL Dept, Số Job,
              Tiền.
            </li>
            <li>
              Chọn đúng cột tương ứng cho mỗi file ở phần <strong>Chọn cột</strong> bên dưới.
            </li>
            <li>
              Đặt tên file xuất (VD: &quot;Lương Kinh Doanh T2.26&quot;).
            </li>
            <li>
              Nhấn <strong>Thực hiện phân bổ</strong> — hệ thống sẽ tự động gán đơn hàng cho từng
              nhân viên sao cho tổng tiền = đúng lương doanh số.
            </li>
            <li>
              Kiểm tra kết quả và nhấn <strong>Tải file kết quả</strong> để tải về file Excel.
            </li>
            <li>
              Bật <strong>Thêm dòng tổng tiền cho mỗi nhân viên</strong> để file xuất có thêm dòng
              tổng sau mỗi nhân viên — giúp kiểm tra phân bổ có đúng với file input không.
            </li>
          </ol>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Lưu ý:</strong> Đơn hàng có thể bị tách thành 2 phần (cùng BL Dept + Số Job)
              để đảm bảo tổng tiền chính xác. Tải file mẫu ở mỗi ô upload để xem định dạng chuẩn.
            </p>
          </div>
        </div>
      </div>

      {/* Xem trước dữ liệu */}
      {mrSheet && (
        <div className="mb-4">
          <DataPreview
            title={`Xem trước: ${mrFile!.fileName}`}
            headers={mrSheet.headers}
            rows={mrSheet.rows}
            maxRows={5}
          />
        </div>
      )}
      {orderSheet && (
        <div className="mb-4">
          <DataPreview
            title={`Xem trước: ${orderFile!.fileName}`}
            headers={orderSheet.headers}
            rows={orderSheet.rows}
            maxRows={5}
          />
        </div>
      )}

      {/* Chọn cột - File lương doanh số */}
      {mrSheet && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3">Chọn cột - File lương doanh số</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ColumnMapper
              label="Cột STT"
              columns={mrSheet.headers}
              selectedColumn={sttCol}
              onSelect={setSttCol}
            />
            <ColumnMapper
              label="Cột Họ tên"
              columns={mrSheet.headers}
              selectedColumn={nameCol}
              onSelect={setNameCol}
            />
            <ColumnMapper
              label="Cột Lương doanh số"
              columns={mrSheet.headers}
              selectedColumn={amountCol}
              onSelect={setAmountCol}
            />
          </div>
        </div>
      )}

      {/* Chọn cột - File chế */}
      {orderSheet && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3">Chọn cột - File chế</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ColumnMapper
              label="Cột BL Dept"
              columns={orderSheet.headers}
              selectedColumn={blDeptCol}
              onSelect={setBlDeptCol}
            />
            <ColumnMapper
              label="Cột Số Job"
              columns={orderSheet.headers}
              selectedColumn={soJobCol}
              onSelect={setSoJobCol}
            />
            <ColumnMapper
              label="Cột Tiền"
              columns={orderSheet.headers}
              selectedColumn={orderAmountCol}
              onSelect={setOrderAmountCol}
            />
          </div>
        </div>
      )}

      {/* Tên file xuất */}
      {mrSheet && orderSheet && (
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Tên file xuất</label>
          <input
            type="text"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-border rounded-md text-sm bg-background"
            placeholder="Lương Kinh Doanh T2.26"
          />
        </div>
      )}

      {/* Tuỳ chọn + Nút thực hiện */}
      {mrSheet && orderSheet && (
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showSubtotals}
              onChange={(e) => setShowSubtotals(e.target.checked)}
              className="rounded border-border"
            />
            <span>Thêm dòng tổng tiền cho mỗi nhân viên (để kiểm tra)</span>
          </label>
        </div>
      )}
      {mrSheet && orderSheet && (
        <div className="flex items-center gap-3 mb-6">
          <Button
            onClick={handleDistribute}
            disabled={loading || !sttCol || !nameCol || !amountCol || !blDeptCol || !soJobCol || !orderAmountCol}
          >
            {loading ? "Đang xử lý..." : "Thực hiện phân bổ"}
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
              Đang phân bổ đơn hàng, vui lòng chờ...
            </div>
          )}
        </div>
      )}

      {/* Kết quả */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {result.stats.totalEmployees}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500">Tổng nhân viên</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {result.stats.fullyMatchedCount}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">Phân bổ thành công</p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                {result.stats.splitCount}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500">Đơn hàng bị tách</p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                {result.unassignedEmployees.length}
              </p>
              <p className="text-xs text-red-600 dark:text-red-500">Chưa phân bổ đủ</p>
            </div>
          </div>

          {result.unassignedEmployees.length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm font-medium text-destructive mb-2">
                Các nhân viên chưa được phân bổ đủ đơn hàng:
              </p>
              <ul className="text-sm text-destructive space-y-1">
                {result.unassignedEmployees.map((emp) => (
                  <li key={emp.name}>
                    {emp.name}: cần {emp.target.toLocaleString()} - đã gán{" "}
                    {emp.assigned.toLocaleString()} - thiếu{" "}
                    {(emp.target - emp.assigned).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.splitOrders.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                Đơn hàng đã bị tách ({result.splitOrders.length}):
              </p>
              <ul className="text-sm text-yellow-600 dark:text-yellow-500 space-y-1 max-h-40 overflow-y-auto">
                {result.splitOrders.map((s, i) => (
                  <li key={i}>
                    {s.blDept} / {s.soJob}: {s.originalAmount.toLocaleString()} -&gt;{" "}
                    {s.parts.map((p) => p.toLocaleString()).join(" + ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultPreviewRows.length > 0 && (
            <DataPreview
              title="Kết quả phân bổ"
              headers={resultPreviewHeaders}
              rows={resultPreviewRows}
              maxRows={30}
            />
          )}
        </div>
      )}
    </div>
  );
}
