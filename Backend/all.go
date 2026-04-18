package main

import (
	"log"

	"github.com/gin-gonic/gin"
)

/**
 * 全案件一覧表示機能
 * データベース内の全案件を取得するAPIを提供
 */

// 全案件取得のレスポンス構造体
type AllProjectsResponse struct {
	Projects []Project `json:"projects"` // 案件のリスト
	Total    int       `json:"total"`    // 総件数
}

// 20251220 全案件一覧のエンドポイントを追加した。DBの中身が確認できるようになって少し安心した。
/**
 * 全案件を取得するハンドラー
 * データベースから全案件を取得して返す
 */
func getAllProjects(c *gin.Context) {
	// データベースから全案件を取得
	query := `
		SELECT prourl, prottl, prodtl, proprc, proprd, proot1, proot2, prostn, procrt
		FROM tbl_project
		ORDER BY procrt DESC
	`

	rows, err := db.Query(query)
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

		// 20251221 proprdがNULLになるケースがあって30分ぐらいハマった。NULL対応を追加した。
		// NULL値の場合は空文字列に変換
		if proprd != nil {
			p.Period = *proprd
		} else {
			p.Period = ""
		}

		projects = append(projects, p)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Row iteration error: %v", err)
		c.JSON(500, gin.H{"error": "Row iteration failed"})
		return
	}

	// レスポンスを返す
	c.JSON(200, AllProjectsResponse{
		Projects: projects,
		Total:    len(projects),
	})
}
