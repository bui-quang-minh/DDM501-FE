import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "DDM501 — AI Biện pháp luận & Quản lý Nhân sự",
  description: "Hệ thống AI tạo Biện pháp luận từ hồ sơ mời thầu, quản lý nhân sự và chứng chỉ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <Sidebar />
        <div className="main-layout">
          {children}
        </div>
      </body>
    </html>
  );
}
