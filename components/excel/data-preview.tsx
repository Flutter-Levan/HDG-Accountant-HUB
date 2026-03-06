"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExcelRow } from "@/types/excel";

interface DataPreviewProps {
  title: string;
  headers: string[];
  rows: ExcelRow[];
  maxRows?: number;
}

export function DataPreview({
  title,
  headers,
  rows,
  maxRows = 10,
}: DataPreviewProps) {
  const displayRows = rows.slice(0, maxRows);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          {title}{" "}
          <span className="text-muted-foreground font-normal">
            ({rows.length} dòng)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  {headers.map((header) => (
                    <TableCell key={header}>
                      {row[header] !== null && row[header] !== undefined
                        ? String(row[header])
                        : ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {rows.length > maxRows && (
          <p className="text-xs text-muted-foreground mt-2">
            Hiển thị {maxRows}/{rows.length} dòng đầu tiên
          </p>
        )}
      </CardContent>
    </Card>
  );
}
