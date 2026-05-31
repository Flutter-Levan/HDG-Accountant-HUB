import type { ExcelRow } from "./excel";

export interface Employee {
  name: string;
  target: number;
}

export interface OrderAssignment {
  employeeName: string;
  loai: string;
  maKhachHang: string;
  soJob: string;
  soSR: string;
  amount: number;
}

export interface SplitOrder {
  loai: string;
  soJob: string;
  originalAmount: number;
  parts: number[];
}

export interface DistributionResult {
  assignments: OrderAssignment[];
  splitOrders: SplitOrder[];
  unassignedEmployees: { name: string; target: number; assigned: number }[];
  stats: {
    totalEmployees: number;
    totalOrders: number;
    splitCount: number;
    fullyMatchedCount: number;
  };
}

export interface OrderPoolItem {
  loai: string;
  maKhachHang: string;
  soJob: string;
  soSR: string;
  amount: number;
  originalIndex: number;
}
