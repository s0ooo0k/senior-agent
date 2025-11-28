import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "리본(Reborn) – 시니어 커리어 내비게이션",
  description: "부울경 시니어를 위한 음성 기반 커리어 내비게이션 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <style>{`
          body {
            font-family: 'Noto Sans KR', sans-serif;
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          @keyframes wave {
            0%, 100% { height: 10px; }
            50% { height: 30px; }
          }
          .animate-wave {
            animation: wave 1s ease-in-out infinite;
          }
        `}</style>
      </head>
      <body
        className={`${notoSansKr.className} bg-slate-50 text-slate-900 selection:bg-blue-200 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
