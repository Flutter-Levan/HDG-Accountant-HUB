"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FileUploaderProps {
  label: string;
  fileName?: string;
  onFileSelect: (file: File) => void;
  onClear: () => void;
}

export function FileUploader({
  label,
  fileName,
  onFileSelect,
  onClear,
}: FileUploaderProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && isExcelFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
      e.target.value = "";
    },
    [onFileSelect]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {fileName ? (
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
