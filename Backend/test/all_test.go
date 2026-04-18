package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
)

// ============================================================
// UT-ALL テストケース
// all.go の getAllProjects 関数のテスト
// ============================================================

func setupAllRouter() *gin.Engine {
	r := gin.New()
	r.GET("/api/projects", getAllProjects)
	return r
}

// UT-ALL-001: 正常系：案件が存在する
func TestGetAllProjects_WithData(t *testing.T) {
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
		AddRow("https://test.com/1", "【Java】バックエンド開発", "Spring Bootでの開発", "70-80万円", "3ヶ月〜", "Java, Spring Boot", nil, "freelance-start", "2024-12-01").
		AddRow("https://test.com/2", "【React】フロントエンド開発", "TypeScriptでのSPA開発", "60-70万円", "長期", "React, TypeScript", nil, "crowdworks", "2024-11-30").
		AddRow("https://test.com/3", "【Python】機械学習エンジニア", "TensorFlowでのモデル開発", "80-90万円", "6ヶ月", "Python, TensorFlow", nil, "lancers", "2024-11-28")

	mock.ExpectQuery("SELECT prourl, prottl, prodtl, proprc, proprd, proot1, proot2, prostn, procrt FROM tbl_project").
		WillReturnRows(rows)

	r := setupAllRouter()
	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("UT-ALL-001 FAIL: 期待ステータス %d, 実際 %d", http.StatusOK, w.Code)
	}

	var resp AllProjectsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースエラー: %v", err)
	}

	if resp.Total != 3 {
		t.Errorf("UT-ALL-001 FAIL: 期待 Total=3, 実際 Total=%d", resp.Total)
	}

	if len(resp.Projects) != 3 {
		t.Errorf("UT-ALL-001 FAIL: 期待案件数 3, 実際 %d", len(resp.Projects))
	}

	// 案件の内容を確認
	if resp.Projects[0].Title != "【Java】バックエンド開発" {
		t.Errorf("UT-ALL-001 FAIL: 最初の案件タイトルが不正: %s", resp.Projects[0].Title)
	}
}

// UT-ALL-002: 正常系：案件が0件
func TestGetAllProjects_EmptyDB(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	columns := []string{"prourl", "prottl", "prodtl", "proprc", "proprd", "proot1", "proot2", "prostn", "procrt"}
	rows := sqlmock.NewRows(columns) // 0件

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	r := setupAllRouter()
	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("UT-ALL-002 FAIL: 期待ステータス %d, 実際 %d", http.StatusOK, w.Code)
	}

	var resp AllProjectsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースエラー: %v", err)
	}

	if resp.Total != 0 {
		t.Errorf("UT-ALL-002 FAIL: 0件の場合 Total=0 であるべき。実際: %d", resp.Total)
	}
}

// UT-ALL-003: ソート順確認（procrt降順）
func TestGetAllProjects_SortOrder(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	columns := []string{"prourl", "prottl", "prodtl", "proprc", "proprd", "proot1", "proot2", "prostn", "procrt"}
	// procrt降順で返すモックデータ
	rows := sqlmock.NewRows(columns).
		AddRow("https://test.com/new", "新しい案件", "詳細", "80万円", "長期", "Java", nil, "freelance-start", "2024-12-10").
		AddRow("https://test.com/mid", "中間の案件", "詳細", "70万円", "3ヶ月", "React", nil, "crowdworks", "2024-12-05").
		AddRow("https://test.com/old", "古い案件", "詳細", "60万円", "短期", "Python", nil, "lancers", "2024-12-01")

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	r := setupAllRouter()
	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	var resp AllProjectsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースエラー: %v", err)
	}

	// ソート順の確認（DBモックから返されたデータは既にソート済み）
	if len(resp.Projects) >= 2 {
		if resp.Projects[0].PostedAt < resp.Projects[1].PostedAt {
			t.Error("UT-ALL-003 FAIL: 案件がprocrt降順でソートされていない")
		}
	}
}

// getAllProjects: DBエラーの場合
func TestGetAllProjects_DBError(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	mock.ExpectQuery("SELECT").WillReturnError(fmt.Errorf("connection refused"))

	r := setupAllRouter()
	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("DBエラー時: 期待ステータス %d, 実際 %d", http.StatusInternalServerError, w.Code)
	}
}

// getAllProjects: NULLフィールドの処理
func TestGetAllProjects_NullFields(t *testing.T) {
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
		AddRow("https://test.com/1", "案件1", "詳細1", "70万円", nil, "Java", nil, "freelance-start", "2024-12-01")

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	r := setupAllRouter()
	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("NULLフィールド: 期待ステータス %d, 実際 %d", http.StatusOK, w.Code)
	}

	var resp AllProjectsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースエラー: %v", err)
	}

	if len(resp.Projects) > 0 && resp.Projects[0].Period != "" {
		t.Errorf("NULLのperiodは空文字列になるべき。実際: %s", resp.Projects[0].Period)
	}
}

// getAllProjects: 大量データのテスト
func TestGetAllProjects_LargeDataset(t *testing.T) {
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
	for i := 0; i < 100; i++ {
		rows.AddRow(
			fmt.Sprintf("https://test.com/%d", i),
			fmt.Sprintf("案件%d", i),
			"詳細",
			"70万円",
			"長期",
			"Java",
			nil,
			"freelance-start",
			"2024-12-01",
		)
	}

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	r := setupAllRouter()
	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("大量データ: 期待ステータス %d, 実際 %d", http.StatusOK, w.Code)
	}

	var resp AllProjectsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースエラー: %v", err)
	}

	if resp.Total != 100 {
		t.Errorf("100件の場合 Total=100 であるべき。実際: %d", resp.Total)
	}
}
