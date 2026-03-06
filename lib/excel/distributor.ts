import type { ExcelRow } from "@/types/excel";
import type {
  Employee,
  OrderAssignment,
  OrderPoolItem,
  SplitOrder,
  DistributionResult,
} from "@/types/distribution";

/**
 * Parse MR Long file to extract employee list.
 * Filters out department headers (Roman numerals), subtotal rows, and empty rows.
 */
export function parseMRLong(
  rows: ExcelRow[],
  sttCol: string,
  nameCol: string,
  amountCol: string
): Employee[] {
  const employees: Employee[] = [];

  for (const row of rows) {
    const stt = row[sttCol];
    const name = row[nameCol];
    const amount = row[amountCol];

    // Skip empty rows
    if (!stt && !name && !amount) continue;

    // STT must be a number (1, 2, 3...) - skip Roman numerals (I, II, III...)
    const sttStr = String(stt ?? "").trim();
    if (!sttStr || !/^\d+$/.test(sttStr)) continue;

    // Name must not be empty
    const nameStr = String(name ?? "").trim();
    if (!nameStr) continue;

    // Amount must be a positive number
    const amountNum = parseAmount(amount);
    if (amountNum <= 0) continue;

    employees.push({ name: nameStr, target: amountNum });
  }

  return employees;
}

function parseAmount(value: string | number | boolean | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "boolean") return 0;
  // Remove formatting (commas, spaces)
  const cleaned = String(value).replace(/[,.\s]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Distribute orders from pool to employees using greedy assignment with splitting.
 * Each employee gets orders summing exactly to their target amount.
 */
export function distributeOrders(
  employees: Employee[],
  orderRows: ExcelRow[],
  blDeptCol: string,
  soJobCol: string,
  amountCol: string
): DistributionResult {
  // Build order pool
  const pool: OrderPoolItem[] = orderRows
    .map((row, index) => ({
      blDept: String(row[blDeptCol] ?? ""),
      soJob: String(row[soJobCol] ?? ""),
      amount: parseAmount(row[amountCol]),
      originalIndex: index,
    }))
    .filter((o) => o.amount > 0);

  // Sort pool descending by amount for greedy picking
  pool.sort((a, b) => b.amount - a.amount);

  // Track available orders (use a mutable array, remove used ones)
  const available = [...pool];
  const assignments: OrderAssignment[] = [];
  const splitOrders: SplitOrder[] = [];
  const unassignedEmployees: { name: string; target: number; assigned: number }[] = [];
  let fullyMatchedCount = 0;

  // Sort employees by target descending (assign largest targets first)
  const sortedEmployees = [...employees].sort((a, b) => b.target - a.target);

  for (const emp of sortedEmployees) {
    let remaining = emp.target;
    let assigned = 0;

    while (remaining > 0 && available.length > 0) {
      // 1. Try exact match
      const exactIdx = available.findIndex((o) => o.amount === remaining);
      if (exactIdx !== -1) {
        const order = available.splice(exactIdx, 1)[0];
        assignments.push({
          employeeName: emp.name,
          blDept: order.blDept,
          soJob: order.soJob,
          amount: order.amount,
        });
        assigned += order.amount;
        remaining = 0;
        break;
      }

      // 2. Find largest order <= remaining
      const fitIdx = available.findIndex((o) => o.amount <= remaining);
      if (fitIdx !== -1) {
        const order = available.splice(fitIdx, 1)[0];
        assignments.push({
          employeeName: emp.name,
          blDept: order.blDept,
          soJob: order.soJob,
          amount: order.amount,
        });
        assigned += order.amount;
        remaining -= order.amount;
        continue;
      }

      // 3. No order fits - split the smallest order that's > remaining
      // Find smallest order > remaining to minimize waste
      let splitIdx = -1;
      for (let i = available.length - 1; i >= 0; i--) {
        if (available[i].amount > remaining) {
          splitIdx = i;
          break;
        }
      }

      if (splitIdx !== -1) {
        const order = available.splice(splitIdx, 1)[0];
        const partForEmployee = remaining;
        const partBack = order.amount - remaining;

        // Assign the portion needed
        assignments.push({
          employeeName: emp.name,
          blDept: order.blDept,
          soJob: order.soJob,
          amount: partForEmployee,
        });

        // Put remainder back in pool (sorted position)
        const newOrder: OrderPoolItem = {
          blDept: order.blDept,
          soJob: order.soJob,
          amount: partBack,
          originalIndex: order.originalIndex,
        };
        // Insert in sorted position (descending)
        const insertIdx = available.findIndex((o) => o.amount <= partBack);
        if (insertIdx === -1) {
          available.push(newOrder);
        } else {
          available.splice(insertIdx, 0, newOrder);
        }

        splitOrders.push({
          blDept: order.blDept,
          soJob: order.soJob,
          originalAmount: order.amount,
          parts: [partForEmployee, partBack],
        });

        assigned += partForEmployee;
        remaining = 0;
        break;
      }

      // Should not reach here if pool has enough total
      break;
    }

    if (remaining === 0) {
      fullyMatchedCount++;
    } else {
      unassignedEmployees.push({
        name: emp.name,
        target: emp.target,
        assigned,
      });
    }
  }

  return {
    assignments,
    splitOrders,
    unassignedEmployees,
    stats: {
      totalEmployees: employees.length,
      totalOrders: orderRows.length,
      splitCount: splitOrders.length,
      fullyMatchedCount,
    },
  };
}
