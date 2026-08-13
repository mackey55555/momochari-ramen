import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// ESLint の設定。
// 方針: ルールは緩めにしています。lint エラーで手が止まるより、
// まず動くものを作るほうが大事なので。気になる書き方は PR レビューで話しましょう。
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // 見た目（インデント・クォートなど）は Prettier に任せるので、
  // それと衝突する ESLint のルールを全部オフにする。必ず最後のほうに置くこと。
  prettier,

  {
    rules: {
      // 使っていない変数は「エラー」ではなく「警告」に。
      // 書きかけのコードで npm run build が止まらないようにするため。
      "@typescript-eslint/no-unused-vars": "warn",
      // any は避けてほしいが、詰まったときの逃げ道は残しておく。
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  globalIgnores([
    // eslint-config-next のデフォルト
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 自動生成ファイルなのでチェックしない
    "lib/database.types.ts",
  ]),
]);

export default eslintConfig;
