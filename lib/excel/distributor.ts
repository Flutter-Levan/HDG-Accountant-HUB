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

/**
 * Đọc file lương kinh doanh THÁNG TRƯỚC để build map: Họ tên -> tập Mã Khách hàng.
 * Dùng để ưu tiên gán lại đúng các mã khách hàng cũ cho từng nhân viên ở tháng mới.
 * Bỏ qua dòng tổng (không có tên hoặc không có mã khách hàng).
 */
export function parsePreviousAssignments(
  rows: ExcelRow[],
  nameCol: string,
  maKhachHangCol: string
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const row of rows) {
    const name = String(row[nameCol] ?? "").trim();
    const maKH = String(row[maKhachHangCol] ?? "").trim();
    if (!name || !maKH) continue;

    let set = map.get(name);
    if (!set) {
      set = new Set<string>();
      map.set(name, set);
    }
    set.add(maKH);
  }

  return map;
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
 *
 * `preferredByEmployee` (tùy chọn): map Họ tên -> tập Mã Khách hàng của tháng trước.
 * Với mỗi nhân viên, hệ thống sẽ ƯU TIÊN gán các đơn có mã khách hàng cũ trước,
 * chỉ khi không còn mã cũ phù hợp mới lấy các mã khách hàng khác bù vào.
 */
export function distributeOrders(
  employees: Employee[],
  orderRows: ExcelRow[],
  loaiCol: string,
  maKhachHangCol: string,
  soJobCol: string,
  soSRCol: string,
  amountCol: string,
  preferredByEmployee: Map<string, Set<string>> = new Map()
): DistributionResult {
  // Build order pool
  const pool: OrderPoolItem[] = orderRows
    .map((row, index) => ({
      loai: String(row[loaiCol] ?? ""),
      maKhachHang: String(row[maKhachHangCol] ?? "").trim(),
      soJob: String(row[soJobCol] ?? ""),
      soSR: String(row[soSRCol] ?? ""),
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
    const prefSet = preferredByEmployee.get(emp.name);

    // Gán đúng 1 đơn theo bộ lọc `allow` (khớp chính xác -> đơn lớn nhất vừa -> tách đơn).
    // Trả về số tiền đã gán cho nhân viên ở bước này, hoặc null nếu không có đơn nào hợp lệ.
    const allocateOne = (allow: (o: OrderPoolItem) => boolean): number | null => {
      // 1. Khớp chính xác
      const exactIdx = available.findIndex((o) => allow(o) && o.amount === remaining);
      if (exactIdx !== -1) {
        const order = available.splice(exactIdx, 1)[0];
        assignments.push({
          employeeName: emp.name,
          loai: order.loai,
          maKhachHang: order.maKhachHang,
          soJob: order.soJob,
          soSR: order.soSR,
          amount: order.amount,
        });
        return order.amount;
      }

      // 2. Đơn lớn nhất <= remaining
      const fitIdx = available.findIndex((o) => allow(o) && o.amount <= remaining);
      if (fitIdx !== -1) {
        const order = available.splice(fitIdx, 1)[0];
        assignments.push({
          employeeName: emp.name,
          loai: order.loai,
          maKhachHang: order.maKhachHang,
          soJob: order.soJob,
          soSR: order.soSR,
          amount: order.amount,
        });
        return order.amount;
      }

      // 3. Không có đơn nào vừa - tách đơn nhỏ nhất > remaining để giảm hao phí
      let splitIdx = -1;
      for (let i = available.length - 1; i >= 0; i--) {
        if (allow(available[i]) && available[i].amount > remaining) {
          splitIdx = i;
          break;
        }
      }

      if (splitIdx !== -1) {
        const order = available.splice(splitIdx, 1)[0];
        const partForEmployee = remaining;
        const partBack = order.amount - remaining;

        // Gán phần cần cho nhân viên
        assignments.push({
          employeeName: emp.name,
          loai: order.loai,
          maKhachHang: order.maKhachHang,
          soJob: order.soJob,
          soSR: order.soSR,
          amount: partForEmployee,
        });

        // Trả phần dư về pool (đúng vị trí sắp xếp giảm dần)
        const newOrder: OrderPoolItem = {
          loai: order.loai,
          maKhachHang: order.maKhachHang,
          soJob: order.soJob,
          soSR: order.soSR,
          amount: partBack,
          originalIndex: order.originalIndex,
        };
        const insertIdx = available.findIndex((o) => o.amount <= partBack);
        if (insertIdx === -1) {
          available.push(newOrder);
        } else {
          available.splice(insertIdx, 0, newOrder);
        }

        splitOrders.push({
          loai: order.loai,
          soJob: order.soJob,
          originalAmount: order.amount,
          parts: [partForEmployee, partBack],
        });

        return partForEmployee;
      }

      return null;
    };

    while (remaining > 0 && available.length > 0) {
      let amt: number | null = null;

      // Ưu tiên: dùng lại đúng mã khách hàng nhân viên đã có ở tháng trước (nếu còn trong pool).
      if (prefSet && prefSet.size > 0) {
        amt = allocateOne((o) => prefSet.has(o.maKhachHang));
      }

      // Bù vào bằng các mã khách hàng khác nếu không còn mã cũ phù hợp.
      if (amt === null) {
        amt = allocateOne(() => true);
      }

      if (amt === null) break; // không còn đơn nào phù hợp

      assigned += amt;
      remaining -= amt;
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
