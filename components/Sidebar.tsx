"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * サイドメニュー。
 *
 * 画面を増やしたら、下の MENU に 1 行足すだけでメニューに出ます。
 * （href はそのページのフォルダ名。app/rides/page.tsx なら "/rides"）
 */
const MENU = [
  { href: "/", label: "地図", icon: "🗺️" },
  { href: "/shops", label: "ラーメン店", icon: "🍜" },
  { href: "/measurements", label: "ラーメン計測", icon: "🧪" },
  { href: "/rides", label: "走行データ", icon: "🚲" },
];

export default function Sidebar() {
  // 今どのページを開いているかを取得する。
  // これを使うために、このファイルは "use client"（ブラウザ側で動く部品）にしている。
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50 p-2 md:w-56 md:flex-col md:gap-0.5 md:overflow-x-visible md:border-r md:border-b-0 md:p-3">
      {/* タイトル。画面が狭いときは場所を取るので隠す */}
      <div className="hidden px-2 py-3 md:block">
        <p className="font-bold text-gray-900">ももちゃりラーメン</p>
        <p className="text-xs text-gray-500">チームF ダッシュボード</p>
      </div>

      {MENU.map((item) => {
        // 開いているページのメニューだけ色を変える。
        // 「/」は完全一致で判定する（前方一致にすると全ページで光ってしまうため）。
        // それ以外は前方一致にして、/shops/xxx（店詳細）でも「ラーメン店」が光るようにする。
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            // 画面が狭いときは小さめに詰めて、4 つとも収まるようにする
            className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-2 text-xs whitespace-nowrap md:gap-2 md:px-3 md:text-sm ${
              isActive
                ? "bg-momo-500 font-medium text-white" // 選択中の項目を桃色（濃い）にする
                : "text-gray-700 hover:bg-momo-50 hover:text-momo-700" // ホバー時も薄い桃色にする
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
