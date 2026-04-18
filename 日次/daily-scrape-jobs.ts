// ===============================
// daily-scrape-jobs
// ===============================

// ライブラリインポート
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";        // Deno HTTPサーバー
import { load } from "https://esm.sh/cheerio@1.0.0-rc.12?bundle";            // HTMLパーサー（jQueryライク）
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.35.0?no-check"; // Supabase SDK

// ===================================
// 環境変数とSupabaseクライアント初期化
// ===================================
// Supabaseの接続URLを環境変数から取得
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// サービスロールキー（DB全権限を持つ）を環境変数から取得
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// 環境変数が設定されていない場合はエラーログを出力
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var");
}

// Supabaseクライアントを作成
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: {
    persistSession: false  // Edge Functionではセッション永続化は不要
  }
});

// ===================================
// パフォーマンスチューニング定数
// ===================================
const DEFAULT_PAGES = [1];                // 取得するページ番号（現在は1ページ目のみ）
const DEFAULT_MAX_ITEMS_PER_PAGE = 15;    // 1ページあたりの最大取得件数
const DETAIL_CONCURRENCY = 1;             // 詳細ページ取得の並列度（1=逐次処理、サイト負荷を抑制）
const MAX_TOTAL_ITEMS = 15;               // 全サイト合計の最大取得件数
const LIST_FETCH_TIMEOUT_MS = 10000;      // リストページ取得のタイムアウト（10秒）
const DETAIL_FETCH_TIMEOUT_MS = 6000;     // 詳細ページ取得のタイムアウト（6秒）
const FETCH_RETRIES = 2;                  // fetch失敗時のリトライ回数
const BACKOFF_BASE_MS = 500;              // リトライ時のバックオフ基底値（指数バックオフで使用）
const CHUNK_SIZE = 100;                   // DB Upsert時のチャンクサイズ

// ===================================
// HTTPリクエストヘッダー（ブラウザ偽装）
// ===================================
// 各サイトのアクセス制限を回避するため、実際のブラウザと同じヘッダーを設定
const defaultHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1"
};


// ===================================
// スクレイピング対象サイト設定
// ===================================
// 各サイトごとのURL、CSSセレクタ、取得件数などを定義
const siteConfigs = {
  // freelance-start.com の設定
  "freelance-start": {
    baseUrl: "https://freelance-start.com/jobs",              // 検索ページのベースURL
    listSelector: ".card.job-top-list-card.ajax-job-link",    // 案件リストのCSSセレクタ
    titleSelector: "h3.card-head",                             // タイトル要素のセレクタ
    linkAttr: "data-url",                                      // リンクURLが格納されている属性名
    pages: DEFAULT_PAGES,                                      // 取得するページ番号
    maxItemsPerPage: DEFAULT_MAX_ITEMS_PER_PAGE                // 1ページあたりの最大取得件数
  },
  // lancers.jp の設定
  "lancers": {
    baseUrl: "https://www.lancers.jp/work/search/system?open=1&ref=header_menu&show_description=1&sort=client&work_rank%5B0%5D=2&work_rank%5B1%5D=3&work_rank%5B2%5D=0&category=0",
    listSelector: ".p-search-job-media.c-media.c-media--item", // 案件リストのCSSセレクタ
    titleSelector: "a.p-search-job-media__title",              // タイトル要素のセレクタ
    linkSelector: "a.p-search-job-media__title",               // リンク要素のセレクタ（href属性を取得）
    pages: DEFAULT_PAGES,
    maxItemsPerPage: DEFAULT_MAX_ITEMS_PER_PAGE
  },
  // crowdworks.jp の設定
  "crowdworks": {
    baseUrl: "https://crowdworks.jp/public/jobs/group/development",
    listSelector: "li[data-v-4ec52cea]",                       // 案件リストのCSSセレクタ
    titleSelector: "h3.hJvZi a",                               // タイトル要素のセレクタ
    linkSelector: "h3.hJvZi a",                                // リンク要素のセレクタ
    pages: DEFAULT_PAGES,
    maxItemsPerPage: DEFAULT_MAX_ITEMS_PER_PAGE
  }
};

// ===================================
// ユーティリティ関数群
// ===================================

/**
 * タイムアウト機能付きfetch
 * @param {string} url - 取得先URL
 * @param {object} opts - fetchオプション
 * @param {number} ms - タイムアウト時間（ミリ秒）
 * @returns {Promise<Response>} - fetchレスポンス
 */
function timeoutFetch(url, opts = {}, ms = 5000) {
  const controller = new AbortController();
  const id = setTimeout(()=>controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal }).finally(()=>clearTimeout(id));
}

/**
 * リトライ機能付きfetch（指数バックオフ）
 * @param {string} url - 取得先URL
 * @param {object} opts - fetchオプション
 * @param {number} ms - タイムアウト時間（ミリ秒）
 * @param {number} retries - リトライ回数
 * @param {number} backoffBase - バックオフ基底値（ミリ秒）
 * @returns {Promise<Response>} - fetchレスポンス
 */
async function retryFetch(url, opts = {}, ms = 5000, retries = 2, backoffBase = 500) {
  let attempt = 0;
  while(true){
    try {
      return await timeoutFetch(url, opts, ms);
    } catch (err) {
      attempt++;
      const isAbort = err && err.name === "AbortError";
      console.warn(`fetch attempt ${attempt} failed for ${url.substring(0,80)}:`, isAbort ? "Abort/timeout" : err?.message ?? err);
      if (attempt > retries) throw err;
      // 指数バックオフ（500ms → 1000ms → 2000ms...）+ ランダムジッター
      const backoff = backoffBase * (2 ** (attempt - 1)) + Math.floor(Math.random() * 200);
      console.log(`retrying after ${backoff}ms (attempt ${attempt + 1})`);
      await new Promise((res)=>setTimeout(res, backoff));
    }
  }
}

/**
 * 相対URLを絶対URLに変換
 * @param {string} href - 相対または絶対URL
 * @param {string} base - ベースURL
 * @returns {string} - 絶対URL
 */
function toAbsolute(href, base) {
  try { return new URL(href, base).toString(); } catch { return href; }
}

/**
 * URLからホスト名を抽出（www. プレフィックスを除去）
 * @param {string} url - URL
 * @returns {string} - ホスト名（例: "crowdworks.jp"）
 */
function hostNameFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/**
 * 並列度を制御しながら配列要素に対して非同期処理を実行
 * @param {Array} arr - 処理対象の配列
 * @param {Function} fn - 各要素に対して実行する非同期関数
 * @param {number} concurrency - 並列実行数（デフォルト: 1）
 * @returns {Promise<Array>} - 処理結果の配列
 */
async function mapWithConcurrency(arr, fn, concurrency = 1) {
  const results = new Array(arr.length); // 結果を格納する配列
  let i = 0; // 現在の処理インデックス

  // 指定された並列度分のワーカーを作成
  const workers = new Array(concurrency).fill(null).map(async () => {
    while(true) {
      const idx = i++; // 次のインデックスを取得（アトミックにインクリメント）
      if (idx >= arr.length) break; // 全要素を処理したら終了
      try {
        results[idx] = await fn(arr[idx]);
      } catch (e) {
        results[idx] = e; // エラーも結果として格納
      }
    }
  });

  await Promise.all(workers); // 全ワーカーの完了を待機
  return results;
}

// 20251214 HTML解析と構造化処理を実装した。サイトごとにフォーマットが全然違って泥臭い処理になった。
/**
 * 詳細ページのテキストをパースして構造化データに変換
 * 見出し（--- 見出し ---）で分割し、キーワードマッチングで各フィールドに振り分け
 *
 * @param {string} fullText - 詳細ページから取得した生テキスト
 * @returns {object} - 構造化されたデータ
 *   - prodtl: 案件詳細（最大4000文字）
 *   - proprc: 単価（最大1000文字）
 *   - proprd: 期間（最大1000文字）
 *   - proot1: スキル情報（最大2000文字）
 *   - proot2: その他情報（最大2000文字）
 *   - proot3: 予備フィールド（現在未使用）
 */
function parseAndStructureDescription(fullText) {
    // 戻り値オブジェクトを初期化
    const result = { prodtl: "", proprc: "", proprd: "", proot1: "", proot2: "", proot3: "" };
    if (!fullText) return result;

    // キーワードマップ：各フィールドに振り分けるためのキーワード
    const keywordsMap = {
        proprc: ['単価', '予算', '報酬'],          // 単価関連
        proprd: ['期間', '納期', '稼働時間'],      // 期間関連
        proot1: ['スキル', '経験', '条件'],        // スキル関連
        prodtl: ['内容', '詳細', '概要', '職務'],  // 詳細関連
    };

    // テキストを見出し（--- xxx ---）で分割
    const sections = fullText.split(/---.*?---/);
    const headers = [...fullText.matchAll(/---(.*?)---/g)].map(m => m[1].trim());

    // ヘッダー抽出がうまくいかない場合へのフォールバック
    if (headers.length === 0 && sections.length > 1) {
        return { ...result, prodtl: fullText }; // うまく分割できないならprodtlに全部入れる
    }

    // 最初のセクション（見出し前のコンテンツ）
    const initialContent = sections[0]?.trim() || '';

    if (headers.length === 0) {
        // 見出しがない場合は全てprodtlに格納
        result.prodtl = initialContent;
    } else {
        // 各見出しとコンテンツをキーワードマッチングで振り分け
        headers.forEach((header, index) => {
            const content = sections[index + 1]?.trim() ?? '';
            if (!content) return;

            const sectionText = `${header}\n${content}`;
            let assigned = false;

            // キーワードマッチング
            for (const [key, keywords] of Object.entries(keywordsMap)) {
                if (keywords.some(kw => header.includes(kw))) {
                    result[key] = (result[key] ? `${result[key]}\n\n` : '') + sectionText;
                    assigned = true;
                    break;
                }
            }

            // どのキーワードにもマッチしなかった場合はproot2（その他）に格納
            if (!assigned) {
                result.proot2 = (result.proot2 ? `${result.proot2}\n\n` : '') + sectionText;
            }
        });

        // 最初のコンテンツを適切なフィールドに追加
        if (initialContent) {
            if (!result.prodtl) {
                result.prodtl = initialContent;
            } else {
                result.proot2 = `${initialContent}\n\n${result.proot2}`.trim();
            }
        }
    }

    // 各フィールドを最大文字数に制限
    result.prodtl = (result.prodtl || '').slice(0, 4000).trim();
    result.proprc = (result.proprc || '').slice(0, 1000).trim();
    result.proprd = (result.proprd || '').slice(0, 1000).trim();
    result.proot1 = (result.proot1 || '').slice(0, 2000).trim();
    result.proot2 = (result.proot2 || '').slice(0, 2000).trim();

    return result;
}


/**
 * 案件詳細ページを取得してパース
 * サイトごとに異なるHTML構造に対応した柔軟なスクレイピング
 *
 * @param {string} url - 詳細ページのURL
 * @param {string} siteKey - サイト識別子（"freelance-start", "lancers", "crowdworks"）
 * @returns {Promise<object>} - パースされた詳細データ
 */
async function fetchDetailData(url, siteKey) {
  const emptyDetail = { prodtl: "", proprc: "", proprd: "", proot1: "", proot2: "", proot3: "" };

  // Lancersのランディングページは案件詳細ではないためスキップ
  if (siteKey === "lancers" && url.includes("/lp/")) return emptyDetail;

  try {
    // リトライ機能付きでHTMLを取得（タイムアウト6秒）
    const resp = await retryFetch(url, {
      headers: { ...defaultHeaders, "Referer": siteConfigs[siteKey].baseUrl }
    }, DETAIL_FETCH_TIMEOUT_MS);

    if (!resp.ok) throw new Error(`detail fetch non-ok: ${resp.status}`);

    const html = await resp.text();
    const $ = load(html); // Cheerioでパース
    let fullDescription = "";

    // サイトごとに異なるHTML構造をパース
    if (siteKey === "freelance-start") {
        const parts = [];

        // 単価情報を取得
        const salary = $(".salary-info .salary").text().trim();
        const salaryUnit = $(".salary-info .salary-unit").text().trim();
        if (salary) {
            parts.push(`単価\n${salary}${salaryUnit}`.trim());
        }

        // セクション情報を取得（見出し + 内容）
        $(".section").each((_, s) => {
            const t = $(s).find("h2.section-title, h3.card-head").text().trim();
            const c = $(s).find(".description, .content, p, div").not("h2, h3").text().trim()
                .replace(/\s{2,}/g, " ").replace(/[ \t]+/g, " "); // 余分な空白を正規化
            if (t && c) parts.push(`${t}\n${c}`);
        });

        fullDescription = parts.join('\n\n') || $(".job-detail-body, .card-body").first().text().trim()
            .replace(/\s{2,}/g, " ").replace(/[ \t]+/g, " ");

    } else if (siteKey === "lancers") {
        const parts = [];

        // 定義リスト（dt/dd）から情報を取得
        $("dl.c-definition-list").each((_, dl) => {
            const t = $(dl).find("dt").text().trim();
            const d = $(dl).find("dd").text().trim().replace(/\s{2,}/g, " ").replace(/[ \t]+/g, " ");
            if (t && d) parts.push(`--- ${t} ---\n${d}`);
        });

        fullDescription = parts.join('\n\n') || $(".p-article__body, .c-article__body").first().text().trim()
            .replace(/\s{2,}/g, " ").replace(/[ \t]+/g, " ");

    } else if (siteKey === "crowdworks") {
        const parts = [];

        // 仕事の詳細テーブルから取得
        parts.push(`--- 仕事の詳細 ---\n${$(".job_offer_detail_table td").first().text().trim()
            .replace(/\s{2,}/g, " ").replace(/[ \t]+/g, " ")}`);

        // サマリーテーブルから詳細情報を取得
        $(".job_offer_summary table.summary tbody tr, .detail_information tbody tr").each((_, r) => {
            const th = $(r).find("th").text().trim();
            const td = $(r).find("td").text().trim().replace(/\s{2,}/g, " ").replace(/[ \t]+/g, " ");
            if (th && td) parts.push(`--- ${th} ---\n${td}`);
        });

        fullDescription = parts.join('\n\n') || $(".job_offer_detail_table").first().text().trim()
            .replace(/\s{2,}/g, " ").replace(/[ \t]+/g, " ");
    }

    // メタタグからdescriptionを取得（フォールバック）
    if (!fullDescription) {
        fullDescription = $('meta[name="description"]').attr("content") || "";
    }

    // テキストをパースして構造化
    return parseAndStructureDescription(fullDescription);

  } catch (err) {
    console.warn("fetchDetailData failed for", url, err);
    return emptyDetail;
  }
}

/**
 * リストページから案件一覧を取得
 * サイトごとのページング形式に対応し、タイトルとURLを抽出
 *
 * @param {object} cfg - サイト設定オブジェクト
 * @param {string} siteKey - サイト識別子
 * @param {number} page - ページ番号
 * @returns {Promise<Array>} - 案件一覧 [{title, href}, ...]
 */
async function fetchListPage(cfg, siteKey, page) {
  let url = cfg.baseUrl;

  // ページング用のURLパラメータを追加（サイトごとに形式が異なる）
  if (page > 1) {
    if (siteKey === "freelance-start") url += `?page=${page}`;
    else if (siteKey === "lancers") url = url.replace(/(&page=\d+)?$/, `&page=${page}`);
    else if (siteKey === "crowdworks") url = url.replace(/(\?page=\d+)?$/, `?page=${page}`);
  }

  try {
    // リトライ機能付きでHTMLを取得（タイムアウト10秒）
    const resp = await retryFetch(url, {
      headers: { ...defaultHeaders, "Referer": cfg.baseUrl }
    }, LIST_FETCH_TIMEOUT_MS);

    if (!resp.ok) {
      console.warn(`list fetch non-ok ${resp.status} for ${url}`);
      return [];
    }

    const html = await resp.text();
    const $ = load(html);

    // CrowdWorks: Vue.jsのdata属性からJSON取得を試行（高速）
    if (siteKey === "crowdworks") {
        try {
            const data = JSON.parse($("#vue-container").attr("data") || '{}');
            const jobs = data?.searchResult?.job_offers || [];
            if (jobs.length > 0) {
                console.log(`CrowdWorks: Found ${jobs.length} jobs via Vue data`);
                return jobs.slice(0, cfg.maxItemsPerPage)
                    .map(j => ({
                        title: j.job_offer?.title,
                        href: `https://crowdworks.jp/public/jobs/${j.job_offer?.id}`
                    }))
                    .filter(j => j.title && j.href);
            }
        } catch (e) {
            // JSON取得失敗時は通常のHTMLスクレイピングにフォールバック
        }
    }

    // CSSセレクタで案件リストを取得
    const nodes = $(cfg.listSelector);
    console.log(`${siteKey}: Found ${nodes.length} nodes with selector "${cfg.listSelector}"`);

    const results = [];
    nodes.slice(0, cfg.maxItemsPerPage).each((_, el) => {
        const e = $(el);

        // タイトルを取得（余分な空白を除去）
        const title = (e.find(cfg.titleSelector).first().text() || "").trim().replace(/\s+/g, " ");

        // URLを取得（属性名またはセレクタで指定）
        let href = cfg.linkAttr
            ? e.attr(cfg.linkAttr)
            : (e.find(cfg.linkSelector).first().attr("href") || "");

        // タイトルとURLが両方取得できた場合のみ追加
        if (href && title) {
            results.push({ title, href: toAbsolute(href, cfg.baseUrl) });
        }
    });

    console.log(`${siteKey}: Extracted ${results.length} items`);
    return results;

  } catch (err) {
    console.error(`fetchListPage failed for ${url}:`, err);
    return [];
  }
}

// ===================================
// データベース操作
// ===================================

/**
 * URLを正規化して重複判定用のキーを生成
 * クエリパラメータと末尾スラッシュを除去して、同じ案件を確実に特定
 *
 * @param {string} u - 元のURL
 * @returns {string} - 正規化されたURL
 */
function normalizeUrlForKey(u) {
  if (!u || typeof u !== 'string') return "";
  try {
    const p = new URL(u.trim());
    // origin + pathname のみ（クエリパラメータ除去）、末尾スラッシュも除去
    return `${p.origin}${p.pathname}`.replace(/\/$/, '');
  } catch {
    // URL解析失敗時は文字列として末尾スラッシュのみ除去
    return u.trim().replace(/\/$/, '');
  }
}

// 20251227 upsert処理を実装した。チャンク失敗時に1件ずつフォールバックする設計にした。年末ギリギリ完成。
/**
 * 案件データをDBに安全にUPSERT
 * チャンク単位でUPSERTし、失敗時は1件ずつフォールバック
 *
 * @param {Array} rows - 案件データの配列
 * @returns {Promise<number>} - 登録成功件数
 */
async function safeUpsertRows(rows) {
  // URL正規化と重複排除（後勝ち上書き）
  const map = new Map();
  for (const row of rows) {
    const key = normalizeUrlForKey(row.prourl);
    if (key) {
      map.set(key, { ...row, prourl: key }); // 同じURLなら上書き
    }
  }
  const deduped = Array.from(map.values());
  console.log(`Deduped rows: original=${rows.length}, deduped=${deduped.length}`);

  let totalInserted = 0;

  // チャンク単位でUPSERT（パフォーマンス向上）
  for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
    const chunk = deduped.slice(i, i + CHUNK_SIZE);

    try {
      const { data, error } = await supabase
        .from("tbl_project")
        .upsert(chunk, { onConflict: "prourl" })  // prourl（URL）が重複時は更新
        .select();

      if (error) {
        // チャンクUPSERT失敗時は1件ずつフォールバック
        console.warn("Chunk upsert failed, falling back to per-row:", error.message);
        for (const r of chunk) {
          const { error: e2 } = await supabase
            .from("tbl_project")
            .upsert([r], { onConflict: "prourl" });
          if (!e2) totalInserted++;
        }
      } else {
        totalInserted += data?.length || 0;
      }
    } catch (e) {
      console.error("Unexpected chunk upsert exception:", e);
    }
  }

  console.log(`Upsert finished: totalInserted=${totalInserted}`);
  return totalInserted;
}

// ===================================
// メインHTTPハンドラ
// ===================================
// 20260103 メインの処理ループが完成した。年明けにようやく全サイト対応できた。動いた時は嬉しかった。
/**
 * HTTPリクエストを受け付け、スクレイピング処理を実行
 * POSTリクエストで特定サイトを指定可能、それ以外は全サイトを処理
 *
 * リクエスト例:
 *   POST {"site": "freelance-start"} → freelance-startのみ処理
 *   GET または POST {} → 全サイト処理
 *
 * レスポンス例:
 *   {"ok": true, "collected": 45, "inserted": 42}
 */
serve(async (req)=>{
  try {
    // リクエストボディをパース（POSTの場合）
    const body = req.method === "POST" ? await req.json() : {};

    // 処理対象サイトを決定（指定があればそのサイトのみ、なければ全サイト）
    const targets = body.site ? [body.site] : Object.keys(siteConfigs);

    let allRows = [];        // 全サイトから取得した案件データ
    let totalProcessed = 0;  // 処理済み件数カウンター

    // サイトごとにループ処理
    for (const key of targets) {
      if (totalProcessed >= MAX_TOTAL_ITEMS) break; // 最大件数に達したら終了

      const cfg = siteConfigs[key];
      if (!cfg) continue; // 設定がないサイトはスキップ

      console.log(`\nStarting ${key}`);

      // ページごとにループ処理
      for (const page of cfg.pages) {
        if (totalProcessed >= MAX_TOTAL_ITEMS) break;

        console.log(`\nFetching list page ${page} for ${key}...`);

        // リストページから案件一覧を取得
        const items = (await fetchListPage(cfg, key, page))
          .slice(0, MAX_TOTAL_ITEMS - totalProcessed); // 最大件数を超えないように制限

        if (items.length === 0) break; // 案件が取得できなければ次のサイトへ

        // 各案件の詳細を並列度1で取得（サイト負荷を抑制）
        const processed = await mapWithConcurrency(items, async (item) => {
          try {
            const detailData = await fetchDetailData(item.href, key);
            totalProcessed++;

            // DB登録用のデータを整形
            return {
              prourl: item.href,                        // 案件URL（主キー）
              prottl: item.title,                       // 案件タイトル
              prostn: hostNameFromUrl(cfg.baseUrl),     // サイト名
              ...detailData                             // 詳細データ（prodtl, proprc, ...）
            };
          } catch (err) {
            console.warn("item processing failed:", item.href, err);
            return null;
          }
        }, DETAIL_CONCURRENCY);

        // 成功した案件のみを追加（nullを除外）
        allRows.push(...processed.filter(Boolean));

        // レート制限配慮のため300msウェイト
        await new Promise(res => setTimeout(res, 300));
      }
    }

    // 案件が1件も取得できなかった場合
    if (allRows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No items fetched" }),
        { status: 200 }
      );
    }

    // DBにUPSERT（重複排除して登録）
    console.log(`\nCollected total rows: ${allRows.length} (will dedupe & upsert)`);
    const totalInserted = await safeUpsertRows(allRows);

    // 成功レスポンス
    return new Response(
      JSON.stringify({
        ok: true,
        collected: allRows.length,    // 収集件数
        inserted: totalInserted        // 登録件数
      }),
      { status: 200 }
    );

  } catch (e) {
    // エラー発生時
    console.error("Handler error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500 }
    );
  }
});