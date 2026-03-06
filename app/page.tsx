import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tools = [
  {
    name: "Tạo lương kinh doanh",
    description:
      "Tạo file lương kinh doanh từ file lương doanh số nhân viên và pool đơn hàng. Tự động phân bổ đơn hàng sao cho tổng tiền = đúng lương doanh số.",
    href: "/tools/distribute-orders",
    icon: "📋",
  },
  {
    name: "Tổng hợp bảng kê mua vào",
    description:
      "Gộp bảng kê hoá đơn, chứng từ hàng hoá, dịch vụ mua vào từ nhiều tháng (nhiều sheet) thành 1 file tổng hợp duy nhất.",
    href: "/tools/merge-invoices",
    icon: "📑",
  },
];

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">HDG Accountant Hub</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Chọn công cụ bên dưới để bắt đầu
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[15px] font-semibold">
                  <span className="text-xl">{tool.icon}</span>
                  {tool.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {tool.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
