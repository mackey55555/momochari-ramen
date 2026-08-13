import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ももちゃりラーメン",
  description: "自転車の走行データとラーメンの計測データを地図で見るアプリ",
};

// すべてのページを包む一番外側のレイアウト。
// ここに書いたものは全ページに出ます（今は特に何も置いていません）。
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
