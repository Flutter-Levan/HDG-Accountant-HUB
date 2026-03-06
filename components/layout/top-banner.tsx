"use client";

import { useState } from "react";
import Image from "next/image";

export function TopBanner() {
  const [showQR, setShowQR] = useState(false);

  return (
    <>
      <div className="relative flex items-center bg-gradient-to-r from-red-600 to-red-500 text-white text-xs h-8 shrink-0">
        <div className="flex-1 overflow-hidden">
          <div className="animate-marquee">
            <span className="whitespace-nowrap px-8">
              Nếu thấy tính năng hỗ trợ được bạn hihi thì cho Philip xin tý gạo
              nuôi cún với ạ...
            </span>
            <span className="whitespace-nowrap px-8">
              Nếu thấy tính năng hỗ trợ được bạn hihi thì cho Philip xin tý gạo
              nuôi cún với ạ...
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowQR(!showQR)}
          className="px-3 h-full hover:bg-red-700 transition-colors text-xs font-bold shrink-0 cursor-pointer"
        >
          {showQR ? "Đóng" : "Ủng hộ mua gạo"}
        </button>
      </div>
      {showQR && (
        <div className="fixed right-2 top-10 z-50 bg-white rounded-lg shadow-xl p-3 border">
          <Image
            src="/qr-donate.png"
            alt="QR Donate"
            width={200}
            height={200}
            className="rounded"
          />
          <p className="text-center text-xs text-gray-500 mt-1">
            Cảm ơn bạn nhiều!
          </p>
        </div>
      )}
    </>
  );
}
