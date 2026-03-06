"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FileUploaderProps {
  label: string;
  fileName?: string;
  onFileSelect: (file: File) => void | Promise<void>;
  onClear: () => void;
}

export function FileUploader({
  label,
  fileName,
  onFileSelect,
  onClear,
}: FileUploaderProps) {
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      // Cho UI render loading trước khi xử lý file nặng
      await new Promise((r) => setTimeout(r, 50));
      try {
        await onFileSelect(file);
      } finally {
        setLoading(false);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && isExcelFile(file)) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-primary/30 rounded-md bg-primary/5">
            <svg
              className="animate-spin h-4 w-4 text-primary"
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
            <span className="text-sm text-primary font-medium">
              Đang đọc file...
            </span>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-between p-3 bg-accent rounded-md">
            <span className="text-sm truncate">{fileName}</span>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Xoá
            </Button>
          </div>
        ) : (
          <label
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <p className="text-sm text-muted-foreground mb-1">
              Kéo thả file vào đây hoặc click để chọn
            </p>
            <p className="text-xs text-muted-foreground">.xlsx, .xls</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleChange}
            />
          </label>
        )}
      </CardContent>
    </Card>
  );
}

function isExcelFile(file: File): boolean {
  return (
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}
