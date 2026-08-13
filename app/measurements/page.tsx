/**
 * ラーメン計測ページ（/measurements）
 *
 * まだ中身は空です。ここを作るのが Issue になります。
 * データの取り方は app/shops/page.tsx がお手本になります。
 */
export default function MeasurementsPage() {
  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-bold">ラーメン計測</h1>
      <p className="mb-6 text-sm text-gray-500">
        塩分濃度・温度の計測結果を見るページです。
      </p>

      <div className="rounded border border-dashed border-gray-300 p-6 text-sm text-gray-600">
        <p className="mb-2 font-medium">ここはこれから作るところです</p>
        <ul className="list-disc pl-5">
          <li>
            ramen_measurements を新しい順に一覧表示する（お店の名前つきで）
          </li>
          <li>手入力フォーム（デバイスが壊れたときのバックアップ用）</li>
        </ul>
      </div>
    </div>
  );
}
