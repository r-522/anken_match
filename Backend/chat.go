package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// AI API用の構造体定義
type AIChatRequest struct {
	Model       string          `json:"model"`
	Messages    []AIChatMessage `json:"messages"`
	Temperature float64         `json:"temperature"`
}

type AIChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AIChatResponse struct {
	Choices []struct {
		Message AIChatMessage `json:"message"`
	} `json:"choices"`
}

/**
 * スキル案件マッチングシステムのメインバックエンド
 * チャット機能、AI分析、案件検索を提供
 */

// データベース接続のグローバル変数
var db *sql.DB

// 構造体は temp.go に移動しました

// 20251221 チャットハンドラの実装完了。クォータエラーのメッセージを丁寧にしたら使い心地が良くなった。
/**
 * チャットAPIのハンドラー
 * ユーザーのスキル情報を受け取り、AIで分析して案件を検索
 */
func handleChat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// AIでスキル解析
	aiAnalysis, err := analyzeSkills(req.Message)
	if err != nil {
		log.Printf("AI API error: %v", err)
		errorMsg := err.Error()
		// クォータエラーの場合、より分かりやすいメッセージに変換
		if strings.Contains(errorMsg, "quota") || strings.Contains(errorMsg, "429") || strings.Contains(errorMsg, "insufficient_quota") {
			c.JSON(500, gin.H{"error": "AI APIの利用上限に達しました。しばらく時間をおいてから再度お試しください。", "detail": errorMsg})
		} else {
			c.JSON(500, gin.H{"error": "AI分析に失敗しました。もう一度お試しください。", "detail": errorMsg})
		}
		return
	}

	// データベースから関連案件を検索（key_skillsを優先）
	projects, err := searchProjectsWithPriority(aiAnalysis.KeySkills, aiAnalysis.StructuredSkills)
	if err != nil {
		log.Printf("Database search error: %v", err)
		c.JSON(500, gin.H{"error": "Database search failed: " + err.Error()})
		return
	}

	// レスポンスを返す
	c.JSON(200, ChatResponse{
		AIAnalysis: aiAnalysis,
		Projects:   projects,
	})
}

// 20251227 AI呼び出し処理を実装した。プロンプト設計が意外と時間かかった。JSON強制するのが肝だった。
/**
 * AIを使ってスキル情報を解析
 * OpenAI互換のAPIを使用
 */
func analyzeSkills(message string) (AIAnalysis, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return AIAnalysis{}, fmt.Errorf("OPENROUTER_API_KEY not set")
	}

	// プロンプトの作成
	systemPrompt := `あなたはIT案件マッチングの専門家です。ユーザーのスキルシート情報を深く分析し、案件検索に最適なJSON形式で回答してください。

以下の形式でJSONを返してください（他の説明文は含めないでください）:
{
  "estimated_salary": "月額XX万円〜XX万円",
  "strengths": "具体的な強みの説明",
  "suggestions": "今後のキャリアアップの提案",
  "structured_skills": [
    {
      "skill_name": "スキル名",
      "experience_years": 年数
    }
  ],
  "search_prompt": "案件検索用の最適化されたプロンプト",
  "key_skills": ["最も重要なスキル1", "最も重要なスキル2", "最も重要なスキル3"],
  "preferred_role": "最適な役割（例：フロントエンドエンジニア、フルスタック開発者、など）",
  "experience_level": "初級/中級/上級/エキスパート のいずれか"
}

重要:
- 必ず有効なJSONのみを返してください。Markdownのコードブロック（` + "```" + `json など）は含めないでください。
- すべてのフィールドを必ず含めてください。
`

	reqBody := AIChatRequest{
		Model: "openai/gpt-3.5-turbo",
		Messages: []AIChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: message},
		},
		Temperature: 0.7,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return AIAnalysis{}, fmt.Errorf("failed to marshal request: %v", err)
	}

	req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewBuffer(jsonBody))
	if err != nil {
		return AIAnalysis{}, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return AIAnalysis{}, fmt.Errorf("AI API call failed: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return AIAnalysis{}, fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != 200 {
		return AIAnalysis{}, fmt.Errorf("AI API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var chatResp AIChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return AIAnalysis{}, fmt.Errorf("failed to parse AI response: %v", err)
	}

	if len(chatResp.Choices) == 0 {
		return AIAnalysis{}, fmt.Errorf("empty choices from AI")
	}

	responseText := chatResp.Choices[0].Message.Content

	// JSONのパース
	var analysis AIAnalysis
	// コードブロックを除去（念のため）
	cleanedText := strings.TrimSpace(responseText)
	cleanedText = strings.TrimPrefix(cleanedText, "```json")
	cleanedText = strings.TrimPrefix(cleanedText, "```")
	cleanedText = strings.TrimSuffix(cleanedText, "```")
	cleanedText = strings.TrimSpace(cleanedText)

	if err := json.Unmarshal([]byte(cleanedText), &analysis); err != nil {
		log.Printf("Failed to parse AI response. Raw: %s", responseText)
		return AIAnalysis{}, fmt.Errorf("failed to parse AI JSON: %v", err)
	}

	return analysis, nil
}

// 20260103 スコアリング方式の検索を実装した。key_skillsを優先する設計にした。年明けから本腰入れた。
/**
 * データベースから案件を検索（key_skillsを優先、スコアリング方式）
 * 重点スキルにマッチする案件を優先的に検索し、サイトごとに均等に取得
 */
func searchProjectsWithPriority(keySkills []string, allSkills []Skill) ([]Project, error) {
	if len(keySkills) == 0 && len(allSkills) == 0 {
		return []Project{}, nil
	}

	// key_skillsを優先的に使用（最大3個まで）
	var primarySkills []string
	for i, skill := range keySkills {
		if i >= 3 {
			break
		}
		primarySkills = append(primarySkills, skill)
	}

	// プライマリスキルがない場合は検索しない
	if len(primarySkills) == 0 {
		return []Project{}, nil
	}

	// スコアリングクエリ：重点スキルにマッチする案件を優先
	// 各スキルの出現回数とマッチしたスキル数をカウント
	var scoreConditions []string
	var matchCountConditions []string
	var args []interface{}
	argIndex := 1

	for _, skill := range primarySkills {
		// 各スキルに対して、タイトル/詳細/スキル欄での出現をスコア化
		// タイトル: 5点、スキル欄: 3点、詳細: 1点
		scoreCondition := fmt.Sprintf(`
			(CASE WHEN prottl ILIKE $%d THEN 5 ELSE 0 END) +
			(CASE WHEN proot1 ILIKE $%d THEN 3 ELSE 0 END) +
			(CASE WHEN prodtl ILIKE $%d THEN 1 ELSE 0 END)
		`, argIndex, argIndex+1, argIndex+2)
		scoreConditions = append(scoreConditions, scoreCondition)

		// マッチしたスキルの数をカウント（ボーナスポイント用）
		matchCountCondition := fmt.Sprintf(`
			(CASE WHEN prottl ILIKE $%d OR proot1 ILIKE $%d OR prodtl ILIKE $%d THEN 1 ELSE 0 END)
		`, argIndex, argIndex+1, argIndex+2)
		matchCountConditions = append(matchCountConditions, matchCountCondition)

		args = append(args, "%"+skill+"%", "%"+skill+"%", "%"+skill+"%")
		argIndex += 3
	}

	scoreSum := strings.Join(scoreConditions, " + ")
	matchCountSum := strings.Join(matchCountConditions, " + ")

	// 少なくとも1つのプライマリスキルにマッチする案件のみ取得
	var whereConditions []string
	for i := range primarySkills {
		baseIndex := i * 3
		whereCondition := fmt.Sprintf("(prottl ILIKE $%d OR proot1 ILIKE $%d OR prodtl ILIKE $%d)",
			baseIndex+1, baseIndex+2, baseIndex+3)
		whereConditions = append(whereConditions, whereCondition)
	}
	whereClause := strings.Join(whereConditions, " OR ")

	// スコアリング＋サイト分散クエリ
	// 改善点：
	// 1. スコアが4以上の案件のみ（タイトルマッチまたは複数箇所マッチ）
	// 2. 複数スキルマッチにボーナス（match_count * 2）
	// 3. 各サイトから最大3件
	// 4. 合計8件まで
	query := fmt.Sprintf(`
		WITH scored_projects AS (
			SELECT
				prourl, prottl, prodtl, proprc, proprd, proot1, proot2, prostn, procrt,
				(%s) + ((%s) * 2) as match_score,
				(%s) as match_count
			FROM tbl_project
			WHERE %s
		),
		ranked_projects AS (
			SELECT
				prourl, prottl, prodtl, proprc, proprd, proot1, proot2, prostn, procrt, match_score, match_count,
				ROW_NUMBER() OVER (PARTITION BY prostn ORDER BY match_score DESC, match_count DESC, procrt DESC) as rn
			FROM scored_projects
			WHERE match_score >= 4
		)
		SELECT prourl, prottl, prodtl, proprc, proprd, proot1, proot2, prostn, procrt
		FROM ranked_projects
		WHERE rn <= 3
		ORDER BY match_score DESC, match_count DESC, procrt DESC
		LIMIT 8
	`, scoreSum, matchCountSum, matchCountSum, whereClause)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("database query failed: %v", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		var proot2 *string
		var proprd *string // 期間フィールドがNULL対応

		if err := rows.Scan(
			&p.URL,
			&p.Title,
			&p.Detail,
			&p.Price,
			&proprd,
			&p.Skills,
			&proot2,
			&p.Source,
			&p.PostedAt,
		); err != nil {
			log.Printf("Row scan error: %v", err)
			continue
		}

		// NULL値の場合は空文字列に変換
		if proprd != nil {
			p.Period = *proprd
		} else {
			p.Period = ""
		}

		projects = append(projects, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %v", err)
	}

	return projects, nil
}

// searchProjects は temp.go に移動しました

/**
 * ヘルスチェックエンドポイント
 * サーバーが正常に動作しているかを確認
 */
func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status": "ok",
	})
}

// 20260111 mainの整理完了。CORSの設定とルーティングをClaudeCodeにレビューしてもらってスッキリした。
/**
 * メイン関数
 * サーバーの初期化と起動を行う
 */
func main() {
	// 環境変数の読み込み
	if err := godotenv.Load("../.env"); err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	// データベース接続（新しいdb.goモジュールを使用）
	var err error
	db, err = ConnectDatabase()
	if err != nil {
		log.Fatal("Database connection failed:", err)
	}
	defer CloseDatabase(db)

	// データベース接続ヘルスチェック
	if err := CheckDatabaseHealth(db); err != nil {
		log.Fatal("Database health check failed:", err)
	}
	log.Println("Database connected successfully")

	// Ginルーターの初期化
	router := gin.Default()

	// CORS設定
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000", "http://localhost:3001", "http://localhost:80"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	router.Use(cors.New(config))

	// ルーティング
	api := router.Group("/api")
	{
		api.GET("/health", healthCheck)
		api.POST("/chat", handleChat)
		api.GET("/projects", getAllProjects)
	}

	// サーバー起動
	serverPort := os.Getenv("SERVER_PORT")
	if serverPort == "" {
		serverPort = "8080"
	}

	log.Printf("Server starting on port %s...", serverPort)
	if err := router.Run(":" + serverPort); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
