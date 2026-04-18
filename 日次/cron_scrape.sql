-- ============================================
-- 📅 日次スクレイピングジョブ Cron 登録
-- ============================================

-- freelance-start
SELECT cron.schedule(
  'daily_scrape_freelance_start',
  '0 12 * * *',
$$
  SELECT net.http_post(
    url := 'https://<YOUR_PROJECT_ID>.supabase.co/functions/v1/daily-scrape-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body := '{"site":"freelance-start"}'::jsonb
  );
$$
);

-- freelance-hub
SELECT cron.schedule(
  'daily_scrape_freelance_hub',
  '0 12 * * *',
$$
  SELECT net.http_post(
    url := 'https://<YOUR_PROJECT_ID>.supabase.co/functions/v1/daily-scrape-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body := '{"site":"freelance-hub"}'::jsonb
  );
$$
);

-- lancers
SELECT cron.schedule(
  'daily_scrape_lancers',
  '0 12 * * *',
$$
  SELECT net.http_post(
    url := 'https://<YOUR_PROJECT_ID>.supabase.co/functions/v1/daily-scrape-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body := '{"site":"lancers"}'::jsonb
  );
$$
);