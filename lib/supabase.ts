import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Supabase クライアント。
 *
 * アプリ全体でこの 1 個を使い回します。
 * 使いたいファイルの先頭で `import { supabase } from "@/lib/supabase";` するだけで OK です。
 *
 * createClient に <Database> を渡しているので、
 * supabase.from("shops") と書くとカラム名の補完が効き、
 * テーブル名を打ち間違えるとエディタが赤線で教えてくれます。
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 環境変数の設定漏れは一番よくあるハマりどころなので、
// 分かりにくいエラーになる前にここで止めて理由を伝える。
if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "環境変数が設定されていません。プロジェクト直下に .env.local を作り、" +
      "NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を書いてください。" +
      "（.env.example をコピーするのが早いです。書き換えたら npm run dev を再起動！）",
  );
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
);
