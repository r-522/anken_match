package main

import (
	"fmt"
	"log"
	"strings"
)

// 20251213 構造体の定義をchat.goから分離した。ファイルがごちゃごちゃしてきたので整理。
// チャットリクエストの構造体
// `json:"message"` はJSONのフィールド名とGoのフィールド名を紐付けるタグです
type ChatRequest struct {
	Message string `json:"message" binding:"required"`
}

// チャットレスポンスの構造体
type ChatResponse struct {
	AIAnalysis AIAnalysis `json:"ai_analysis"` // AI分析結果
	Projects   []Project  `json:"projects"`    // マッチした案件リスト
}

// AI分析結果の構造体
type AIAnalysis struct {
	EstimatedSalary  string   `json:"estimated_salary"`  // 推定単価
	Strengths        string   `json:"strengths"`         // 強み
	Suggestions      string   `json:"suggestions"`       // キャリアアップ提案
	StructuredSkills []Skill  `json:"structured_skills"` // 構造化されたスキルリスト
	SearchPrompt     string   `json:"search_prompt"`     // 自動生成された検索用プロンプト
	KeySkills        []string `json:"key_skills"`        // 重点スキル（検索優先度高）
	PreferredRole    string   `json:"preferred_role"`    // 希望する役割
	ExperienceLevel  string   `json:"experience_level"`  // 経験レベル（初級/中級/上級/エキスパート）
}

// スキル情報の構造体
type Skill struct {
	SkillName       string  `json:"skill_name"`       // スキル名
	ExperienceYears float64 `json:"experience_years"` // 経験年数（小数対応）
}

// 案件情報の構造体
type Project struct {
	URL      string `json:"url"`       // 案件URL
	Title    string `json:"title"`     // 案件タイトル
	Detail   string `json:"detail"`    // 案件詳細
	Price    string `json:"price"`     // 単価
	Period   string `json:"period"`    // 期間
	Skills   string `json:"skills"`    // 必要スキル
	Source   string `json:"source"`    // ソース（サイト名）
	PostedAt string `json:"posted_at"` // 掲載日
}

// 20251220 旧バージョンのsearchProjectsは互換性のためとりあえず残す。新しいやつはchat.goに移した。いつか消すかも。
/**
 * データベースから案件を検索（サイト偏りを解消）- 旧バージョン
 * 互換性のため残しているが、現在は使用していない
 */
func searchProjects(skills []Skill) ([]Project, error) {
	if len(skills) == 0 {
		return []Project{}, nil
	}

	// スキル名を抽出してOR検索用のクエリを作成
	var skillNames []string
	for _, skill := range skills {
		skillNames = append(skillNames, skill.SkillName)
	}

	// ILIKE条件を動的に生成（タイトル、詳細、スキルで検索）
	var conditions []string
	var args []interface{}
	argIndex := 1

	for _, skillName := range skillNames {
		// タイトル、詳細、スキル（proot1）で検索
		condition := fmt.Sprintf("(prottl ILIKE $%d OR prodtl ILIKE $%d OR proot1 ILIKE $%d)", argIndex, argIndex+1, argIndex+2)
		conditions = append(conditions, condition)
		args = append(args, "%"+skillName+"%", "%"+skillName+"%", "%"+skillName+"%")
		argIndex += 3
	}

	whereClause := strings.Join(conditions, " OR ")

	// サイトごとに均等に案件を取得するクエリ
	// ROW_NUMBER()を使って各サイトから最大4件ずつ取得
	query := fmt.Sprintf(`
		WITH ranked_projects AS (
			SELECT
				prourl, prottl, prodtl, proprc, proprd, proot1, proot2, prostn, procrt,
				ROW_NUMBER() OVER (PARTITION BY prostn ORDER BY procrt DESC) as rn
			FROM tbl_project
			WHERE %s
		)
		SELECT prourl, prottl, prodtl, proprc, proprd, proot1, proot2, prostn, procrt
		FROM ranked_projects
		WHERE rn <= 4
		ORDER BY procrt DESC
		LIMIT 12
	`, whereClause)

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
