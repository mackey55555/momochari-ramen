import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "ももちゃりラーメン",
  description: "自転車の走行データとラーメンの計測データを地図で見るアプリ",
};

/**
 * すべてのページを包む一番外側のレイアウト。
 *
 * 左（スマホでは上）にサイドメニュー、右に各ページの中身、という 2 分割です。
 * ページを新しく作ると、自動でこの枠の中に入ります。
 * メニューに並べたいときは components/Sidebar.tsx に 1 行足してください。
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="h-full">
        {/* 画面が狭いとき（スマホ）は縦並び、md 以上の幅なら横並びにする */}
        <div className="flex h-full flex-col md:flex-row">
          <Sidebar />

          {/* 各ページの中身がここに入る。
              min-h-0 は「中身が多いときに縦に伸びっぱなしにせず、
              この枠の中でスクロールさせる」ために必要（flex のお約束）。 */}
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
