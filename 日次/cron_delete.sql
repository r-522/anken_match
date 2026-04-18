-- ============================================
-- 🗑️ 古いデータ削除ジョブ Cron 登録
-- ============================================
-- 5日前より古いデータを削除して、Supabase無料枠のストレージを節約
-- 毎日午前12時に実行

SELECT cron.schedule(
  'daily_delete_old_data',
  '0 12 * * *',
$$
  SELECT net.http_post(
    url := 'https://<YOUR_PROJECT_ID>.supabase.co/functions/v1/delete-old-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
$$
);

-- ============================================
-- 📋 Cron ジョブの確認・管理用コマンド
-- ============================================

-- 登録済みのCronジョブを確認
-- SELECT * FROM cron.job;

-- 特定のCronジョブを削除する場合
-- SELECT cron.unschedule('daily_delete_old_data');

-- Cronジョブの実行履歴を確認
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
