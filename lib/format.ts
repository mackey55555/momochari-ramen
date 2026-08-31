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
