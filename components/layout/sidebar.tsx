"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tools = [
  {
    name: "Trang chủ",
    href: "/",
    icon: "🏠",
  },
  {
    name: "Tạo lương kinh doanh",
    href: "/tools/distribute-orders",
    icon: "📋",
  },
  {
    name: "Tổng hợp bảng kê mua vào",
    href: "/tools/merge-invoices",
    icon: "📑",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Image
            src="/LG-HDG-ai-01-1024x717.png"
            alt="HDG Logistics"
            width={40}
            height={40}
            className="rounded"
          />
          <h1 className="text-base font-bold leading-tight">HDG Accountant Hub</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Công cụ hỗ trợ kế toán
        </p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {tools.map((tool) => {
          const isActive = pathname === tool.href;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              <span>{tool.icon}</span>
              <span>{tool.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground">v1.0.0</p>
      </div>
    </aside>
  );
}
