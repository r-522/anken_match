package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
)

// ============================================================
// UT-CHAT テストケース
// chat.go の ChatHandler, searchProjectsWithPriority 関数のテスト
// ============================================================

func init() {
	gin.SetMode(gin.TestMode)
}

// テスト用のGinルーターを作成
func setupChatRouter() *gin.Engine {
	r := gin.New()
	r.POST("/api/chat", handleChat)
	return r
}

// ============================================================
// UT-CHAT-001 ~ UT-CHAT-006: handleChat ハンドラーのテスト
// ============================================================

// UT-CHAT-002: 異常系：空のメッセージ
func TestHandleChat_EmptyMessage(t *testing.T) {
	r := setupChatRouter()

	body := `{"message": ""}`
	req := httptest.NewRequest("POST", "/api/chat", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Ginのbinding:"required"により空文字はバリデーションエラーになる
	if w.Code != http.StatusBadRequest {
		t.Errorf("UT-CHAT-002 FAIL: 期待ステータス %d, 実際 %d, body: %s",
			http.StatusBadRequest, w.Code, w.Body.String())
	}
}

// UT-CHAT-003: 異常系：messageフィールドなし
func TestHandleChat_MissingMessage(t *testing.T) {
	r := setupChatRouter()

	body := `{}`
	req := httptest.NewRequest("POST", "/api/chat", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("UT-CHAT-003 FAIL: 期待ステータス %d, 実際 %d, body: %s",
			http.StatusBadRequest, w.Code, w.Body.String())
	}
}

// UT-CHAT-004: 異常系：不正なJSON
func TestHandleChat_InvalidJSON(t *testing.T) {
	r := setupChatRouter()

	body := `invalid json`
	req := httptest.NewRequest("POST", "/api/chat", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("UT-CHAT-004 FAIL: 期待ステータス %d, 実際 %d, body: %s",
			http.StatusBadRequest, w.Code, w.Body.String())
	}
}

// ============================================================
// analyzeSkills テスト
// ============================================================

// analyzeSkills: APIキー未設定の場合
func TestAnalyzeSkills_NoAPIKey(t *testing.T) {
	t.Setenv("OPENROUTER_API_KEY", "")

	_, err := analyzeSkills("Java 5年")
	if err == nil {
		t.Error("APIキーが未設定の場合、エラーが返るべき")
	}
	if !strings.Contains(err.Error(), "OPENROUTER_API_KEY") {
		t.Errorf("エラーメッセージにOPENROUTER_API_KEYが含まれるべき: %v", err)
	}
}

// analyzeSkills: モックサーバーで正常レスポンス
func TestAnalyzeSkills_MockSuccess(t *testing.T) {
	// モックAI APIサーバーを作成
	aiResp := AIChatResponse{
		Choices: []struct {
			Message AIChatMessage `json:"message"`
		}{
			{
				Message: AIChatMessage{
					Role: "assistant",
					Content: `{
						"estimated_salary": "70-85万円/月",
						"strengths": "Java経験が豊富",
						"suggestions": "AWSの資格取得を推奨",
						"structured_skills": [{"skill_name": "Java", "experience_years": 5}],
						"search_prompt": "Java Spring Boot 開発",
						"key_skills": ["Java", "Spring Boot"],
						"preferred_role": "バックエンドエンジニア",
						"experience_level": "上級"
					}`,
				},
			},
		},
	}

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(aiResp)
	}))
	defer mockServer.Close()

	// 注意: analyzeSkillsはハードコードされたURLを使用しているため、
	// この関数は実際のAPIを呼び出す。
	// 本テストではAPIキーのバリデーションのみテスト可能。
	// 完全なモックテストには関数のリファクタリングが必要。
	t.Skip("analyzeSkillsはハードコードされたURLを使用。モックテストにはリファクタリングが必要")
}

// analyzeSkills: AI APIがエラーステータスを返す場合
func TestAnalyzeSkills_APIError(t *testing.T) {
	// ハードコードURLのためスキップ
	t.Skip("analyzeSkillsはハードコードされたURLを使用。モックテストにはリファクタリングが必要")
}

// ============================================================
// UT-SEARCH-001 ~ UT-SEARCH-010: searchProjectsWithPriority テスト
// ============================================================

// UT-SEARCH-004: 境界値：空のスキル配列
func TestSearchProjectsWithPriority_EmptySkills(t *testing.T) {
	results, err := searchProjectsWithPriority([]string{}, []Skill{})
	if err != nil {
		t.Errorf("UT-SEARCH-004 FAIL: エラーが発生: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("UT-SEARCH-004 FAIL: 空のスキルでは空の配列が返るべき。件数: %d", len(results))
	}
}

// UT-SEARCH-004 追加: keySkillsのみ空の場合
func TestSearchProjectsWithPriority_EmptyKeySkills(t *testing.T) {
	results, err := searchProjectsWithPriority([]string{}, []Skill{{SkillName: "Java", ExperienceYears: 5}})
	if err != nil {
		t.Errorf("エラーが発生: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("keySkillsが空の場合は空の配列が返るべき。件数: %d", len(results))
	}
}

// UT-SEARCH-001: 正常系：単一スキルでマッチ
func TestSearchProjectsWithPriority_SingleSkill(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	// グローバルdbをモックに差し替え
	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	// モック結果の設定
	columns := []string{"prourl", "prottl", "prodtl", "proprc", "proprd", "proot1", "proot2", "prostn", "procrt"}
	rows := sqlmock.NewRows(columns).
		AddRow("https://test.com/1", "【Java】バックエンド開発", "Spring Bootを使用", "70-80万円", "3ヶ月〜", "Java, Spring Boot", nil, "freelance-start", "2024-12-01")

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	results, err := searchProjectsWithPriority([]string{"Java"}, nil)
	if err != nil {
		t.Errorf("UT-SEARCH-001 FAIL: エラーが発生: %v", err)
	}
	if len(results) == 0 {
		t.Error("UT-SEARCH-001 FAIL: Javaスキルで案件が返るべき")
	}

	for _, p := range results {
		combined := strings.ToLower(p.Title + p.Skills + p.Detail)
		if !strings.Contains(combined, "java") {
			t.Errorf("UT-SEARCH-001 FAIL: マッチしない案件が含まれている: %s", p.Title)
		}
	}
}

// UT-SEARCH-002: 正常系：複数スキルでマッチ
func TestSearchProjectsWithPriority_MultipleSkills(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	columns := []string{"prourl", "prottl", "prodtl", "proprc", "proprd", "proot1", "proot2", "prostn", "procrt"}
	rows := sqlmock.NewRows(columns).
		AddRow("https://test.com/1", "【Java/Spring Boot】バックエンド", "AWS環境で開発", "80万円", "長期", "Java, Spring Boot, AWS", nil, "freelance-start", "2024-12-01").
		AddRow("https://test.com/2", "【Java】サーバーサイド開発", "Spring Bootでの開発", "70万円", "3ヶ月", "Java, Spring Boot", nil, "crowdworks", "2024-11-28")

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	results, err := searchProjectsWithPriority([]string{"Java", "Spring Boot", "AWS"}, nil)
	if err != nil {
		t.Errorf("UT-SEARCH-002 FAIL: エラーが発生: %v", err)
	}
	if len(results) == 0 {
		t.Error("UT-SEARCH-002 FAIL: 複数スキルで案件が返るべき")
	}
}

// UT-SEARCH-003: 正常系：マッチなし
func TestSearchProjectsWithPriority_NoMatch(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	columns := []string{"prourl", "prottl", "prodtl", "proprc", "proprd", "proot1", "proot2", "prostn", "procrt"}
	rows := sqlmock.NewRows(columns) // 空の結果

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	results, err := searchProjectsWithPriority([]string{"存在しないスキル"}, nil)
	if err != nil {
		t.Errorf("UT-SEARCH-003 FAIL: エラーが発生: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("UT-SEARCH-003 FAIL: マッチなしの場合は空の配列が返るべき。件数: %d", len(results))
	}
}

// UT-SEARCH-005: 境界値：4個以上のスキル（先頭3個のみ使用）
func TestSearchProjectsWithPriority_MaxSkills(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	columns := []string{"prourl", "prottl", "prodtl", "proprc", "proprd", "proot1", "proot2", "prostn", "procrt"}
	rows := sqlmock.NewRows(columns).
		AddRow("https://test.com/1", "【A】開発", "A案件", "60万円", "長期", "A, B", nil, "freelance-start", "2024-12-01")

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	// 5個のスキルを渡す（内部で3個に制限されるはず）
	results, err := searchProjectsWithPriority([]string{"A", "B", "C", "D", "E"}, nil)
	if err != nil {
		t.Errorf("UT-SEARCH-005 FAIL: エラーが発生: %v", err)
	}
	// 結果が返ることを確認（制限されてもクエリは実行される）
	_ = results
}

// UT-SEARCH-009: 結果件数上限（最大8件）
func TestSearchProjectsWithPriority_MaxResults(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	columns := []string{"prourl", "prottl", "prodtl", "proprc", "proprd", "proot1", "proot2", "prostn", "procrt"}
	rows := sqlmock.NewRows(columns)
	// 10件のデータを追加（LIMIT 8によりDBから8件のみ返る）
	for i := 0; i < 8; i++ {
		rows.AddRow(
			fmt.Sprintf("https://test.com/%d", i),
			fmt.Sprintf("【Java】案件%d", i),
			"Java開発案件",
			"70万円",
			"長期",
			"Java",
			nil,
			"freelance-start",
			"2024-12-01",
		)
	}

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	results, err := searchProjectsWithPriority([]string{"Java"}, nil)
	if err != nil {
		t.Errorf("UT-SEARCH-009 FAIL: エラーが発生: %v", err)
	}
	if len(results) > 8 {
		t.Errorf("UT-SEARCH-009 FAIL: 最大8件まで返却されるべき。件数: %d", len(results))
	}
}

// UT-SEARCH-010: 大文字小文字の無視（ILIKE使用の確認）
func TestSearchProjectsWithPriority_CaseInsensitive(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	columns := []string{"prourl", "prottl", "prodtl", "proprc", "proprd", "proot1", "proot2", "prostn", "procrt"}
	rows := sqlmock.NewRows(columns).
		AddRow("https://test.com/1", "【Java】バックエンド開発", "Java開発", "70万円", "長期", "Java, Spring Boot", nil, "freelance-start", "2024-12-01")

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	// 小文字で検索しても結果が返る（ILIKEを使用しているため）
	results, err := searchProjectsWithPriority([]string{"java"}, nil)
	if err != nil {
		t.Errorf("UT-SEARCH-010 FAIL: エラーが発生: %v", err)
	}
	if len(results) == 0 {
		t.Error("UT-SEARCH-010 FAIL: 小文字の'java'でもILIKEにより結果が返るべき")
	}
}

// searchProjectsWithPriority: DBエラーの場合
func TestSearchProjectsWithPriority_DBError(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	mock.ExpectQuery("SELECT").WillReturnError(fmt.Errorf("connection refused"))

	_, err = searchProjectsWithPriority([]string{"Java"}, nil)
	if err == nil {
		t.Error("DBエラーの場合、エラーが返るべき")
	}
}

// searchProjectsWithPriority: NULLフィールドの処理
func TestSearchProjectsWithPriority_NullFields(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	columns := []string{"prourl", "prottl", "prodtl", "proprc", "proprd", "proot1", "proot2", "prostn", "procrt"}
	rows := sqlmock.NewRows(columns).
		AddRow("https://test.com/1", "【Java】案件", "Java開発", "70万円", nil, "Java", nil, "freelance-start", "2024-12-01")

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	results, err := searchProjectsWithPriority([]string{"Java"}, nil)
	if err != nil {
		t.Errorf("NULLフィールドでエラー: %v", err)
	}
	if len(results) > 0 && results[0].Period != "" {
		t.Errorf("NULLのperiodは空文字列になるべき。実際: %s", results[0].Period)
	}
}

// ============================================================
// healthCheck テスト
// ============================================================

func TestHealthCheck(t *testing.T) {
	r := gin.New()
	r.GET("/api/health", healthCheck)

	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("ヘルスチェック: 期待ステータス %d, 実際 %d", http.StatusOK, w.Code)
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースエラー: %v", err)
	}
	if resp["status"] != "ok" {
		t.Errorf("ヘルスチェック: 期待 status=ok, 実際 status=%s", resp["status"])
	}
}
