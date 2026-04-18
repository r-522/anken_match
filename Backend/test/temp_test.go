package main

import (
	"fmt"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

// ============================================================
// temp.go のテスト
// 構造体定義と searchProjects（旧バージョン）のテスト
// ============================================================

// --- 構造体の基本テスト ---

func TestChatRequest_Structure(t *testing.T) {
	req := ChatRequest{Message: "Java 5年"}
	if req.Message != "Java 5年" {
		t.Errorf("ChatRequest.Message: 期待 'Java 5年', 実際 '%s'", req.Message)
	}
}

func TestAIAnalysis_Structure(t *testing.T) {
	analysis := AIAnalysis{
		EstimatedSalary:  "70-85万円/月",
		Strengths:        "Java経験が豊富",
		Suggestions:      "AWSの資格取得",
		StructuredSkills: []Skill{{SkillName: "Java", ExperienceYears: 5}},
		KeySkills:        []string{"Java", "Spring Boot"},
		PreferredRole:    "バックエンドエンジニア",
		ExperienceLevel:  "上級",
	}

	if analysis.EstimatedSalary != "70-85万円/月" {
		t.Errorf("EstimatedSalary: 期待 '70-85万円/月', 実際 '%s'", analysis.EstimatedSalary)
	}
	if len(analysis.KeySkills) != 2 {
		t.Errorf("KeySkills: 期待 2件, 実際 %d件", len(analysis.KeySkills))
	}
}

func TestProject_Structure(t *testing.T) {
	p := Project{
		URL:      "https://test.com/1",
		Title:    "【Java】案件",
		Detail:   "詳細",
		Price:    "70万円",
		Period:   "3ヶ月",
		Skills:   "Java, Spring Boot",
		Source:   "freelance-start",
		PostedAt: "2024-12-01",
	}

	if p.Source != "freelance-start" {
		t.Errorf("Source: 期待 'freelance-start', 実際 '%s'", p.Source)
	}
}

func TestSkill_Structure(t *testing.T) {
	s := Skill{SkillName: "Java", ExperienceYears: 5.5}
	if s.SkillName != "Java" {
		t.Errorf("SkillName: 期待 'Java', 実際 '%s'", s.SkillName)
	}
	if s.ExperienceYears != 5.5 {
		t.Errorf("ExperienceYears: 期待 5.5, 実際 %f", s.ExperienceYears)
	}
}

// --- searchProjects（旧バージョン）テスト ---

func TestSearchProjects_EmptySkills(t *testing.T) {
	results, err := searchProjects([]Skill{})
	if err != nil {
		t.Errorf("空スキルでエラー: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("空スキルでは空の配列が返るべき。件数: %d", len(results))
	}
}

func TestSearchProjects_SingleSkill(t *testing.T) {
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
		AddRow("https://test.com/1", "【React】フロント開発", "TypeScriptでの開発", "65万円", "長期", "React, TypeScript", nil, "crowdworks", "2024-12-01")

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	results, err := searchProjects([]Skill{{SkillName: "React", ExperienceYears: 3}})
	if err != nil {
		t.Errorf("エラーが発生: %v", err)
	}
	if len(results) == 0 {
		t.Error("Reactスキルで案件が返るべき")
	}
}

func TestSearchProjects_MultipleSkills(t *testing.T) {
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
		AddRow("https://test.com/1", "【Java/Spring】開発", "AWS環境", "80万円", "長期", "Java, Spring Boot, AWS", nil, "freelance-start", "2024-12-01").
		AddRow("https://test.com/2", "【Java】サーバー開発", "開発案件", "70万円", "3ヶ月", "Java", nil, "crowdworks", "2024-11-30")

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	skills := []Skill{
		{SkillName: "Java", ExperienceYears: 5},
		{SkillName: "Spring Boot", ExperienceYears: 3},
	}

	results, err := searchProjects(skills)
	if err != nil {
		t.Errorf("エラーが発生: %v", err)
	}
	if len(results) == 0 {
		t.Error("複数スキルで案件が返るべき")
	}
}

func TestSearchProjects_DBError(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	originalDB := db
	db = mockDB
	defer func() { db = originalDB }()

	mock.ExpectQuery("SELECT").WillReturnError(fmt.Errorf("connection refused"))

	_, err = searchProjects([]Skill{{SkillName: "Java", ExperienceYears: 5}})
	if err == nil {
		t.Error("DBエラーの場合、エラーが返るべき")
	}
}

func TestSearchProjects_NullPeriod(t *testing.T) {
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

	results, err := searchProjects([]Skill{{SkillName: "Java", ExperienceYears: 5}})
	if err != nil {
		t.Errorf("NULLフィールドでエラー: %v", err)
	}
	if len(results) > 0 && results[0].Period != "" {
		t.Errorf("NULLのperiodは空文字列になるべき。実際: '%s'", results[0].Period)
	}
}
