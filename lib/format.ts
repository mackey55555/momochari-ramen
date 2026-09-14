/**
 * 日時を「日本時間・日本語の書式」で表示するための関数。
 *
 * === なぜこの関数があるのか ===
 *
 * new Date(...).toLocaleString() をそのまま使うと、
 *
 *   ・どこの国の書式で出すか
 *   ・どこの時間帯で出すか
 *
 * の 2 つが、どちらも「動かしている環境まかせ」になります。
 * 手元のパソコンは日本設定なので正しく見えますが、
 * Vercel のサーバーは UTC・英語圏の設定なので、本番だけ
 *
 *   2025/9/19 10:00:00   →   9/19/2025, 1:00:00 AM
 *
 * のように、書式も時刻も変わってしまいます（9 時間ずれます）。
 *
 * 毎回 toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) と書けば済む話ですが、
 * 書き忘れても画面上は一見それっぽく出てしまうため気づけません。
 * 日時を出すときは、必ずこの関数を通すようにしてください。
 */
export function formatJst(isoText: string): string {
  return new Date(isoText).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

/**
 * その日時から今まで、何分たったかを返す。
 *
 * 今の時刻（Date.now()）を使うので、呼ぶたびに結果が変わる。
 * ページの部品の中に直接書くと、React の「描画は何回やっても同じ結果になるべき」
 * というルール（lint の react-hooks/purity）に引っかかるため、関数に切り出している。
 * /rides はリクエストのたびにサーバーで 1 回だけ描画するページなので、
 * 「開いた瞬間の今」を基準にするのは意図どおり。
 */
export function minutesSince(isoText: string): number {
  return Math.floor((Date.now() - new Date(isoText).getTime()) / 60000);
}

/** 経過した分数を「5分前」「3時間前」「2日前」のような読みやすい形にする */
export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}分前`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}時間前`;
  return `${Math.floor(minutes / (60 * 24))}日前`;
}
