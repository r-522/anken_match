/**
 * Tailwind CSS設定ファイル
 *
 * このファイルでは、Tailwind CSSのカスタム設定を定義します。
 * プロジェクト全体で使用されるカラーパレット、グラデーション、その他のデザイントークンを管理します。
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  /**
   * コンテンツパス設定
   *
   * Tailwind CSSがクラスをスキャンする対象ファイルを指定します。
   * ここで指定したパターンに一致するファイル内で使用されているTailwindクラスのみが
   * 最終的なCSSファイルに含まれます（未使用のスタイルは自動的に削除されます）。
   */
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",  // srcディレクトリ内のすべてのJS/JSX/TS/TSXファイル
  ],

  /**
   * テーマ設定
   *
   * Tailwindのデフォルトテーマを拡張またはオーバーライドします。
   */
  theme: {
    /**
     * テーマの拡張設定
     *
     * 既存のTailwindテーマに新しい値を追加します。
     * ここで定義した値は、デフォルトの値と併用できます。
     */
    extend: {
      /**
       * カラーパレット
       *
       * プロジェクト全体で使用するカスタムカラーを定義します。
       * 'primary'カラーは紫系のパレットで、50（最も明るい）から900（最も暗い）まで段階的に定義されています。
       *
       * 使用例: bg-primary-500, text-primary-700, border-primary-300
       */
      colors: {
        primary: {
          50: '#f5f3ff',   // 非常に薄い紫（背景色に適しています）
          100: '#ede9fe',  // 薄い紫
          200: '#ddd6fe',  // 明るい紫
          300: '#c4b5fd',  // ライトパープル
          400: '#a78bfa',  // ミディアムパープル
          500: '#8b5cf6',  // ベースカラー - メインの紫色
          600: '#7c3aed',  // 濃い紫（ホバー状態に適しています）
          700: '#6d28d9',  // より濃い紫
          800: '#5b21b6',  // 非常に濃い紫
          900: '#4c1d95',  // 最も濃い紫（テキストや強調に適しています）
        },
      },

      /**
       * グラデーション背景画像
       *
       * 再利用可能なグラデーション効果を定義します。
       * これらのグラデーションは、カード、ヒーロー、ボタンなどの背景として使用できます。
       *
       * 使用例: bg-gradient-purple-indigo, bg-gradient-blue-indigo
       */
      backgroundImage: {
        // 放射状グラデーション（中心から外側に広がる）
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',

        // 紫から濃い紫へのグラデーション（135度の角度）
        // ヒーローセクションやカードの背景に適しています
        'gradient-purple-indigo': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',

        // 明るい青から濃い青へのグラデーション
        // ボタンやアクセントエリアに適しています
        'gradient-blue-indigo': 'linear-gradient(135deg, #667eea 0%, #4c51bf 100%)',

        // 明るいグレーから青みがかったグレーへのグラデーション
        // 背景やサブセクションに適した控えめなグラデーション
        'gradient-gray-blue': 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      },
    },
  },

  /**
   * プラグイン
   *
   * Tailwind CSSの機能を拡張するプラグインを追加できます。
   * 現在は使用していませんが、将来的にフォームやタイポグラフィなどの
   * 公式プラグインを追加できます。
   *
   * 例: require('@tailwindcss/forms'), require('@tailwindcss/typography')
   */
  plugins: [],
}
