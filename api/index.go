package handler

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
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

// =====================
// 型定義
// =====================

type ChatRequest struct {
	Message string `json:"message" binding:"required"`
}

type ChatResponse struct {
	AIAnalysis AIAnalysis `json:"ai_analysis"`
	Projects   []Project  `json:"projects"`
}

type AIAnalysis struct {
	EstimatedSalary  string   `json:"estimated_salary"`
	Strengths        string   `json:"strengths"`
	Suggestions      string   `json:"suggestions"`
	StructuredSkills []Skill  `json:"structured_skills"`
	SearchPrompt     string   `json:"search_prompt"`
	KeySkills        []string `json:"key_skills"`
	PreferredRole    string   `json:"preferred_role"`
	ExperienceLevel  string   `json:"experience_level"`
}

type Skill struct {
	SkillName       string  `json:"skill_name"`
	ExperienceYears float64 `json:"experience_years"`
}

type Project struct {
	URL      string `json:"url"`
	Title    string `json:"title"`
	Detail   string `json:"detail"`
	Price    string `json:"price"`
	Period   string `json:"period"`
	Skills   string `json:"skills"`
	Source   string `json:"source"`
	PostedAt string `json:"posted_at"`
}

type AllProjectsResponse struct {
	Projects []Project `json:"projects"`
	Total    int       `json:"total"`
}

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

// =====================
// DB接続（遅延初期化）
// =====================

var (
	db         *sql.DB
	dbOnce     sync.Once
	router     *gin.Engine
	routerOnce sync.Once
)

func getDB() *sql.DB {
	dbOnce.Do(func() {
		sslMode := os.Getenv("DB_SSL_MODE")
		if sslMode == "" {
			sslMode = "require"
		}
		connStr := fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=%s",
			os.Getenv("DB_USER"),
			os.Getenv("DB_PASSWORD"),
			os.Getenv("DB_HOST"),
			os.Getenv("DB_PORT"),
			os.Getenv("DB_NAME"),
			sslMode,
		)
		var err error
		db, err = sql.Open("postgres", connStr)
		if err != nil {
			log.Printf("[ERROR] Failed to open DB: %v", err)
			return
		}
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(2)
		db.SetConnMaxLifetime(5 * time.Minute)
		db.SetConnMaxIdleTime(30 * time.Second)
		if err := db.Ping(); err != nil {
			log.Printf("[ERROR] DB ping failed: %v", err)
		}
	})
	return db
}

// =====================
// ルーター初期化
// =====================

func getRouter() *gin.Engine {
	routerOnce.Do(func() {
		gin.SetMode(gin.ReleaseMode)
		r := gin.New()
		r.Use(gin.Recovery())

		config := cors.DefaultConfig()
		config.AllowAllOrigins = true
		config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
		config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
		r.Use(cors.New(config))

		api := r.Group("/api")
		{
			api.GET("/health", handleHealth)
			api.POST("/chat", handleChat)
			api.GET("/projects", getAllProjects)
		}

		router = r
	})
	return router
}

// =====================
// Vercel エントリーポイント
// =====================

func Handler(w http.ResponseWriter, r *http.Request) {
	getRouter().ServeHTTP(w, r)
}

// =====================
// ハンドラー
// =====================

func handleHealth(c *gin.Context) {
	c.JSON(200, gin.H{"status": "ok"})
}

func handleChat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	aiAnalysis, err := analyzeSkills(req.Message)
	if err != nil {
		log.Printf("AI API error: %v", err)
		errorMsg := err.Error()
		if strings.Contains(errorMsg, "quota") || strings.Contains(errorMsg, "429") || strings.Contains(errorMsg, "insufficient_quota") {
			c.JSON(500, gin.H{"error": "AI APIの利用上限に達しました。しばらく時間をおいてから再度お試しください。", "detail": errorMsg})
		} else {
			c.JSON(500, gin.H{"error": "AI分析に失敗しました。もう一度お試しください。", "detail": errorMsg})
		}
		return
	}

	projects, err := searchProjectsWithPriority(aiAnalysis.KeySkills, aiAnalysis.StructuredSkills)
	if err != nil {
		log.Printf("Database search error: %v", err)
		c.JSON(500, gin.H{"error": "Database search failed: " + err.Error()})
		return
	}

	c.JSON(200, ChatResponse{
		AIAnalysis: aiAnalysis,
		Projects:   projects,
	})
}

func getAllProjects(c *gin.Context) {
	database := getDB()
	if database == nil {
		c.JSON(500, gin.H{"error": "Database connection failed"})
		return
	}

	query := `
		SELECT prourl, prottl, prodtl, proprc, proprd, proot1, proot2, prostn, procrt
		FROM tbl_project
		ORDER BY procrt DESC
	`
	rows, err := database.Query(query)
	if err != nil {
		log.Printf("Database query failed: %v", err)
		c.JSON(500, gin.H{"error": "Database query failed"})
		return
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		var proot2 *string
		var proprd *string
		if err := rows.Scan(
			&p.URL, &p.Title, &p.Detail, &p.Price, &proprd,
			&p.Skills, &proot2, &p.Source, &p.PostedAt,
		); err != nil {
			log.Printf("Row scan error: %v", err)
			continue
		}
		if proprd != nil {
			p.Period = *proprd
		}
		projects = append(projects, p)
	}

	if err := rows.Err(); err != nil {
		c.JSON(500, gin.H{"error": "Row iteration failed"})
		return
	}

	c.JSON(200, AllProjectsResponse{Projects: projects, Total: len(projects)})
}

// =====================
// AI分析
// =====================

func analyzeSkills(message string) (AIAnalysis, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return AIAnalysis{}, fmt.Errorf("OPENROUTER_API_KEY not set")
	}

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
	cleanedText := strings.TrimSpace(responseText)
	cleanedText = strings.TrimPrefix(cleanedText, "```json")
	cleanedText = strings.TrimPrefix(cleanedText, "```")
	cleanedText = strings.TrimSuffix(cleanedText, "```")
	cleanedText = strings.TrimSpace(cleanedText)

	var analysis AIAnalysis
	if err := json.Unmarshal([]byte(cleanedText), &analysis); err != nil {
		log.Printf("Failed to parse AI response. Raw: %s", responseText)
		return AIAnalysis{}, fmt.Errorf("failed to parse AI JSON: %v", err)
	}

	return analysis, nil
}

// =====================
// 案件検索
// =====================

func searchProjectsWithPriority(keySkills []string, allSkills []Skill) ([]Project, error) {
	if len(keySkills) == 0 && len(allSkills) == 0 {
		return []Project{}, nil
	}

	var primarySkills []string
	for i, skill := range keySkills {
		if i >= 3 {
			break
		}
		primarySkills = append(primarySkills, skill)
	}

	if len(primarySkills) == 0 {
		return []Project{}, nil
	}

	var scoreConditions []string
	var matchCountConditions []string
	var args []interface{}
	argIndex := 1

	for _, skill := range primarySkills {
		scoreCondition := fmt.Sprintf(`
			(CASE WHEN prottl ILIKE $%d THEN 5 ELSE 0 END) +
			(CASE WHEN proot1 ILIKE $%d THEN 3 ELSE 0 END) +
			(CASE WHEN prodtl ILIKE $%d THEN 1 ELSE 0 END)
		`, argIndex, argIndex+1, argIndex+2)
		scoreConditions = append(scoreConditions, scoreCondition)

		matchCountCondition := fmt.Sprintf(`
			(CASE WHEN prottl ILIKE $%d OR proot1 ILIKE $%d OR prodtl ILIKE $%d THEN 1 ELSE 0 END)
		`, argIndex, argIndex+1, argIndex+2)
		matchCountConditions = append(matchCountConditions, matchCountCondition)

		args = append(args, "%"+skill+"%", "%"+skill+"%", "%"+skill+"%")
		argIndex += 3
	}

	scoreSum := strings.Join(scoreConditions, " + ")
	matchCountSum := strings.Join(matchCountConditions, " + ")

	var whereConditions []string
	for i := range primarySkills {
		baseIndex := i * 3
		whereCondition := fmt.Sprintf("(prottl ILIKE $%d OR proot1 ILIKE $%d OR prodtl ILIKE $%d)",
			baseIndex+1, baseIndex+2, baseIndex+3)
		whereConditions = append(whereConditions, whereCondition)
	}
	whereClause := strings.Join(whereConditions, " OR ")

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

	database := getDB()
	if database == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	rows, err := database.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("database query failed: %v", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		var proot2 *string
		var proprd *string
		if err := rows.Scan(
			&p.URL, &p.Title, &p.Detail, &p.Price, &proprd,
			&p.Skills, &proot2, &p.Source, &p.PostedAt,
		); err != nil {
			log.Printf("Row scan error: %v", err)
			continue
		}
		if proprd != nil {
			p.Period = *proprd
		}
		projects = append(projects, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %v", err)
	}

	return projects, nil
}
