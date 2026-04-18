// ===============================
// delete-old-data
// ・5日前より古いデータを削除
// ・Supabase無料枠のストレージ節約のため
// ・テーブル: public.tbl_project
// ===============================
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.35.0?no-check";

// --- 環境変数 ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: {
    persistSession: false
  }
});

// --- 設定 ---
const DAYS_TO_KEEP = 5; // 保持する日数

// 20260124 古いデータ削除処理を実装した。Supabaseの無料枠がすぐ埋まるから必要だった。
// --- 古いデータを削除する関数 ---
async function deleteOldData() {
  try {
    // 5日前の日付を計算
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
    const cutoffDateStr = cutoffDate.toISOString();

    console.log(`🗑️ Deleting data older than ${DAYS_TO_KEEP} days (before ${cutoffDateStr})...`);

    // 削除前のカウント
    const { count: beforeCount, error: countError } = await supabase
      .from("tbl_project")
      .select("*", { count: "exact", head: true })
      .lt("procrt", cutoffDateStr);

    if (countError) {
      console.error("❌ Error counting old records:", countError);
      return { ok: false, error: countError.message };
    }

    console.log(`📊 Found ${beforeCount} records to delete`);

    if (beforeCount === 0) {
      console.log("✅ No old data to delete");
      return { ok: true, deleted: 0, message: "No old data to delete" };
    }

    // 古いデータを削除
    const { data, error } = await supabase
      .from("tbl_project")
      .delete()
      .lt("procrt", cutoffDateStr);

    if (error) {
      console.error("❌ Error deleting old data:", error);
      return { ok: false, error: error.message };
    }

    console.log(`✅ Successfully deleted ${beforeCount} old records`);

    // 削除後の総レコード数を確認
    const { count: afterCount, error: afterCountError } = await supabase
      .from("tbl_project")
      .select("*", { count: "exact", head: true });

    if (!afterCountError) {
      console.log(`📊 Remaining records: ${afterCount}`);
    }

    return {
      ok: true,
      deleted: beforeCount,
      remaining: afterCount,
      cutoffDate: cutoffDateStr
    };
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return { ok: false, error: String(err) };
  }
}

// 20260125 HTTPハンドラを追加してデプロイ準備完了。これで毎日自動で古いデータが消えるはず。
// --- HTTPハンドラー ---
serve(async (req) => {
  try {
    console.log("\n🚀 Starting old data deletion process...");
    const result = await deleteOldData();

    const statusCode = result.ok ? 200 : 500;
    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("❌ Handler error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
