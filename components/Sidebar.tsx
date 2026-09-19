"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * サイドメニュー。
 *
 * 画面を増やしたら、下の MENU に 1 行足すだけでメニューに出ます。
 * （href はそのページのフォルダ名。app/rides/page.tsx なら "/rides"）
 *
 * 地図を広く見たいときのために、パソコンの画面では左右の矢印ボタンで
 * 閉じたり開いたりできます（閉じるとアイコンだけの細いメニューになる）。
 * スマホでは元から横並びの細いメニューなので、ボタンは出していません。
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

  // メニューを閉じているかどうか。true なら細い（アイコンだけの）表示になる。
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <nav
      className={`flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50 p-2 md:flex-col md:gap-0.5 md:overflow-x-visible md:border-r md:border-b-0 md:p-3 ${
        isCollapsed ? "md:w-16" : "md:w-56"
      }`}
    >
      {/* タイトルと開閉ボタン。画面が狭いときは場所を取るので隠す */}
      <div className="hidden items-center justify-between gap-2 py-3 md:flex">
        {/* 閉じているときはタイトルを隠して、ボタンだけにする */}
        {!isCollapsed && (
          <div className="px-2">
            <p className="font-bold text-gray-900">ももちゃりラーメン</p>
            <p className="text-xs text-gray-500">チームF ダッシュボード</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          // aria-label は、目が見えない人が使う読み上げソフト用のボタンの名前。
          // 見た目が記号だけのボタンには付けておく。
          aria-label={isCollapsed ? "メニューを開く" : "メニューを閉じる"}
          title={isCollapsed ? "メニューを開く" : "メニューを閉じる"}
          className="mx-auto rounded px-2 py-1 text-gray-500 hover:bg-momo-50 hover:text-momo-700"
        >
          {isCollapsed ? "»" : "«"}
        </button>
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
            // 閉じているときは、アイコンが真ん中に来るようにする
            title={item.label}
            className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-2 text-xs whitespace-nowrap md:gap-2 md:text-sm ${
              isCollapsed ? "md:justify-center md:px-2" : "md:px-3"
            } ${
              isActive
                ? "bg-momo-500 font-medium text-white" // 選択中の項目を桃色（濃い）にする
                : "text-gray-700 hover:bg-momo-50 hover:text-momo-700" // ホバー時も薄い桃色にする
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            {/* 閉じているときは文字を消してアイコンだけにする（スマホでは常に出す） */}
            <span className={isCollapsed ? "md:hidden" : ""}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
