import type { ExcelRow } from "./excel";

export interface Employee {
  name: string;
  target: number;
}

export interface OrderAssignment {
  employeeName: string;
  blDept: string;
  soJob: string;
  amount: number;
}

export interface SplitOrder {
  blDept: string;
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
  blDept: string;
  soJob: string;
  amount: number;
  originalIndex: number;
}
