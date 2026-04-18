/**
 * PostCSS設定ファイル
 *
 * PostCSSは、CSSを変換するためのツールです。
 * このファイルでは、CSSビルドパイプラインで使用するプラグインを定義します。
 *
 * PostCSSは、ビルド時にCSSファイルを処理し、様々な変換を適用します。
 */
module.exports = {
  /**
   * プラグイン設定
   *
   * ビルドパイプラインで実行されるプラグインのリストです。
   * プラグインは上から順番に実行されます。
   */
  plugins: {
    /**
     * Tailwind CSS
     *
     * Tailwind CSSのユーティリティクラスを生成します。
     * tailwind.config.jsの設定に基づいて、カスタマイズされたCSSを生成します。
     *
     * このプラグインは以下の処理を行います：
     * 1. @tailwind ディレクティブを実際のCSSに展開
     * 2. 使用されているクラスのみを含める（Tree-shaking）
     * 3. カスタムテーマの適用
     */
    tailwindcss: {},

    /**
     * Autoprefixer
     *
     * ブラウザの互換性のために、CSSプロパティにベンダープレフィックスを自動追加します。
     * 例: display: flex → display: -webkit-box; display: -ms-flexbox; display: flex;
     *
     * これにより、開発者は標準のCSS構文だけを書けば、
     * 古いブラウザでも動作する互換性のあるCSSが自動生成されます。
     *
     * Autoprefixerは、browserslistの設定（package.jsonまたは.browserslistrc）に基づいて、
     * どのブラウザをサポートするかを決定します。
     */
    autoprefixer: {},
  },
}
