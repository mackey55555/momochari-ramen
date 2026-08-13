/**
 * 走行データページ（/rides）
 *
 * まだ中身は空です。ここを作るのが Issue になります。
 * データの取り方は app/shops/page.tsx がお手本になります。
 */
export default function RidesPage() {
  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-bold">走行データ</h1>
      <p className="mb-6 text-sm text-gray-500">
        IoTデバイスから送られてきた計測点を見るページです。
      </p>

      <div className="rounded border border-dashed border-gray-300 p-6 text-sm text-gray-600">
        <p className="mb-2 font-medium">ここはこれから作るところです</p>
        <ul className="list-disc pl-5">
          <li>
            ride_points を新しい順に一覧表示する（何件届いているかの確認用）
          </li>
          <li>デバイスごと・日付ごとの絞り込み</li>
        </ul>
      </div>
    </div>
  );
}
