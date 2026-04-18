# スキル案件マッチングシステム

エンジニア向けの案件マッチングサービス。スキルシートや条件をチャットで投げると、複数のフリーランスサイトから適した案件を探す。

## 概要

フリーランスサイトに散らばっている案件情報を一箇所でまとめて検索する。OpenRouter API を使ってスキル情報を解析し、適切な案件を提案する。

現在対応しているサイト：
- freelance-start.com
- crowdworks.jp
- lancers.jp

## 主な機能

### チャット機能
シンプルなチャットUIでスキル情報を入力する。「Java3年」と入力すると、AIが解析して案件を探す。

### 案件検索
入力されたスキルを元に、DBから関連する案件を検索する。複数の案件を一度に表示し、元のサイトへのリンクも含む。

### AI解析
OpenRouter API（GPT-3.5）を使ってスキルシートを解析。スキルセットと狙える単価を判定する。

## アーキテクチャと技術選定の理由

| 技術 | 選定理由 |
|------|----------|
| **Go / Gin** | 静的型付けによる安全性と、並列処理(goroutine)による高速なスクレイピング対応。シングルバイナリでDockerイメージが軽量 |
| **React + TypeScript** | 型安全なUIコンポーネント管理。チャット/スキルシート/案件一覧の3画面構成でstate管理が明確 |
| **Supabase (PostgreSQL)** | 無料枠が充実、PostgreSQL互換でSQLが使える。AWS RDS・Neon等の代替を検討したが、近距離リージョン×無料枠ではSupabaseが最適 |
| **OpenRouter API** | 当初はGemini APIを使用していたが、無料枠の上限(rate limit)に達したため移行。複数LLMモデルを1つのAPIで統一的に呼び出せる柔軟性も利点。現在はGPT-3.5を使用中 |
| **Docker Compose** | フロント(port 3000)とバック(port 8080)を1コマンドで起動・停止できる開発効率のため |
| **Vercel** | フロントエンド(React)のCDNホスティングとGoのサーバーレス関数を一括デプロイできるため |

## 使用技術スタック

### フロントエンド
- React 18 + TypeScript
- TailwindCSS（スタイリング）
- Create React App（ビルド）

### バックエンド
- Go 1.24
- Ginフレームワーク
- Supabase（PostgreSQLホスティング）
- OpenRouter API（LLM呼び出し）

### インフラ
- Docker + Docker Compose
- Vercel（フロントエンドホスティング）

## プロジェクト構成

```
anken_match/
├── Backend/
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   ├── temp.go
│   ├── all.go
│   ├── db.go
│   └── chat.go
├── Frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── all.tsx       # 案件一覧
│   │   │   ├── temp.tsx      # スキルシート
│   │   │   └── chat.tsx      # チャットコンポーネント
│   │   ├── index.tsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── 日次/
│   ├── cron.sql              # 日次登録
│   └── index.ts              # 日次処理
├── .env
└── docker-compose.yml
```

## セットアップ手順

### 必要なもの

- Docker、Docker Compose
- OpenRouter APIキー
- Go 1.24
- Node.js 18

### インストール

1. リポジトリをクローン

```bash
git clone <repository-url>
cd anken_match
```

2. 環境変数を設定

プロジェクトルートに`.env`ファイルを作成：

```env
# OpenRouter API
OPENROUTER_API_KEY=xxxxxxxx

# Supabase
user=postgres.xxxxxxx
password=xxxx
host=aws-xxxxxx
port=xxxx
dbname=postgres
```

3. Dockerで起動

```bash
# ビルドして起動
docker-compose up --build

# バックグラウンドで動かす場合
docker-compose up -d
```

4. ブラウザでアクセス

- フロントエンド: http://localhost:3000
- API: http://localhost:8080

### Dockerを使わない場合

バックエンド：
```bash
cd Backend
go mod download
go run chat.go
```

フロントエンド：
```bash
cd Frontend
npm install
npm start
```

## 使い方

1. http://localhost:3000 を開く

2. チャット欄にスキル情報を入力
   - 例: 「Java言語を3年、TypeScriptを2年。バックエンド開発メインで、月80〜100万円の案件希望」

3. 送信するとAIが解析開始
   - スキル、経験年数、希望単価を抽出

4. マッチした案件を表示
   - 案件カードから詳細確認
   - 「詳細を見る」から元サイトへ

## データベース設計

### TBL_PROJECTテーブル

案件情報を格納するテーブル：

```sql
create table public.tbl_project (
  prourl text not null,     -- URL
  prottl text not null,     -- 案件名
  prodtl text null,         -- 詳細
  proprc text null,         -- 単価
  proprd text null,         -- 期間
  proot1 text null,         -- その他1 (スキル)
  proot2 text null,         -- その他2 (その他)
  proot3 text null,         -- その他3 (予備)
  prostn text not null,     -- 登録日時
  procrt timestamp with time zone null default now(),
  constraint tbl_project_pkey primary key (prourl)
) TABLESPACE pg_default;
```

## API仕様

### POST /api/chat

チャットメッセージを送信して案件を取得

リクエスト:
```json
{
  "message": "Java3年の経験"
}
```

レスポンス:
```json
{
  "ai_analysis": {
    "estimated_salary": "月額85万円〜105万円",
    "strengths": "Javaを用いたバックエンド開発、特にAPI設計と実装に強みがあります。",
    "suggestions": "今後はクラウド（AWS/GCP）関連の知識を深めることで、より高単価なインフラ構築案件も視野に入れることができます。",
    "structured_skills": [
      {
        "skill_name": "Java",
        "experience_years": 3
      }
    ]
  },
  "projects": [
    {
      "url": "https://freelance-start.com/jobs/detail/1536580",
      "title": "PHP／大手エンタメ企業のバックエンドエンジニア案件",
      "detail": "【業務内容】 ・PHP（Laravel）で構築されているサイトの改修業務に携わっていただきます...",
      "price": "〜90万円/月",
      "period": "即日〜長期",
      "skills": "PHP, Laravel, JavaScript, Docker, Jenkins",
      "source": "freelance-start.com",
      "posted_at": "2025-10-27T04:51:08Z"
    }
  ]
}
```

### GET /api/health

死活監視用

```json
{
  "status": "ok"
}
```

## 日次バッチ処理

毎日12:00に各サイトから新着案件を取得してDBに登録する。`index.ts`をcronに登録して日次処理を行う。
