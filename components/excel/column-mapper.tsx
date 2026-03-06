"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ColumnMapperProps {
  label: string;
  columns: string[];
  selectedColumn: string;
  onSelect: (column: string) => void;
}

export function ColumnMapper({
  label,
  columns,
  selectedColumn,
  onSelect,
}: ColumnMapperProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={selectedColumn} onValueChange={onSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Chọn cột..." />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col} value={col}>
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
