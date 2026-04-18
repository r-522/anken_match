package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

/**
 * データベース接続管理モジュール
 * PostgreSQLへの接続、接続プール管理、ヘルスチェックを提供
 */

// DB接続設定の構造体
type DBConfig struct {
	User     string // データベースユーザー名
	Password string // データベースパスワード
	Host     string // データベースホスト
	Port     string // データベースポート
	DBName   string // データベース名
	SSLMode  string // SSL接続モード
}

// DB接続プール設定の構造体
type DBPoolConfig struct {
	MaxOpenConns    int           // 最大オープン接続数
	MaxIdleConns    int           // 最大アイドル接続数
	ConnMaxLifetime time.Duration // 接続の最大生存時間
	ConnMaxIdleTime time.Duration // アイドル接続の最大時間
}

/**
 * 環境変数からDB設定を読み込む
 * @return DBConfig データベース接続設定
 */
func LoadDBConfig() DBConfig {
	return DBConfig{
		User:     os.Getenv("DB_USER"),
		Password: os.Getenv("DB_PASSWORD"),
		Host:     os.Getenv("DB_HOST"),
		Port:     os.Getenv("DB_PORT"),
		DBName:   os.Getenv("DB_NAME"),
		SSLMode:  getEnvWithDefault("DB_SSL_MODE", "require"),
	}
}

/**
 * デフォルトのDB接続プール設定を取得
 * @return DBPoolConfig 接続プール設定
 */
func DefaultDBPoolConfig() DBPoolConfig {
	return DBPoolConfig{
		MaxOpenConns:    25,                // 最大25接続
		MaxIdleConns:    5,                 // 最大5アイドル接続
		ConnMaxLifetime: 5 * time.Minute,   // 接続は5分で破棄
		ConnMaxIdleTime: 30 * time.Second,  // アイドル接続は30秒で破棄
	}
}

/**
 * 環境変数を取得、存在しない場合はデフォルト値を返す
 * @param key 環境変数名
 * @param defaultValue デフォルト値
 * @return string 環境変数の値またはデフォルト値
 */
func getEnvWithDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

/**
 * データベース接続文字列を構築
 * @param config データベース接続設定
 * @return string PostgreSQL接続文字列
 */
func buildConnectionString(config DBConfig) string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		config.User,
		config.Password,
		config.Host,
		config.Port,
		config.DBName,
		config.SSLMode,
	)
}

// 20251213 DB接続処理を別モジュールに切り出した。ClaudeCodeに構成を相談したら綺麗に書いてくれた。
/**
 * データベース接続を確立
 * 接続プール設定を適用し、接続テストを実施
 * @return *sql.DB データベース接続オブジェクト
 * @return error エラー情報
 */
func ConnectDatabase() (*sql.DB, error) {
	// DB設定の読み込み
	config := LoadDBConfig()
	
	// 設定の検証
	if err := validateDBConfig(config); err != nil {
		return nil, fmt.Errorf("invalid database configuration: %v", err)
	}

	// 接続文字列の構築
	connStr := buildConnectionString(config)
	
	// データベース接続の確立
	database, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %v", err)
	}

	// 接続プール設定の適用
	poolConfig := DefaultDBPoolConfig()
	database.SetMaxOpenConns(poolConfig.MaxOpenConns)
	database.SetMaxIdleConns(poolConfig.MaxIdleConns)
	database.SetConnMaxLifetime(poolConfig.ConnMaxLifetime)
	database.SetConnMaxIdleTime(poolConfig.ConnMaxIdleTime)

	// 接続テスト
	if err := database.Ping(); err != nil {
		database.Close()
		return nil, fmt.Errorf("failed to ping database: %v", err)
	}

	log.Printf("[INFO] Database connected successfully (Host: %s, DB: %s)", config.Host, config.DBName)
	return database, nil
}

/**
 * DB設定の検証
 * 必須項目の存在チェック
 * @param config データベース接続設定
 * @return error 検証エラー（問題がなければnil）
 */
func validateDBConfig(config DBConfig) error {
	if config.User == "" {
		return fmt.Errorf("DB_USER is not set")
	}
	if config.Password == "" {
		return fmt.Errorf("DB_PASSWORD is not set")
	}
	if config.Host == "" {
		return fmt.Errorf("DB_HOST is not set")
	}
	if config.Port == "" {
		return fmt.Errorf("DB_PORT is not set")
	}
	if config.DBName == "" {
		return fmt.Errorf("DB_NAME is not set")
	}
	return nil
}

// 20251214 ヘルスチェック機能を追加した。本番稼働を意識してみた。接続プール統計もログ出力するようにした。
/**
 * データベース接続のヘルスチェック
 * 接続が正常かどうかを確認
 * @param db データベース接続オブジェクト
 * @return error エラー情報（正常な場合はnil）
 */
func CheckDatabaseHealth(db *sql.DB) error {
	if db == nil {
		return fmt.Errorf("database connection is nil")
	}
	
	// Ping実行
	if err := db.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %v", err)
	}
	
	// 統計情報の取得
	stats := db.Stats()
	log.Printf("[DEBUG] DB Stats - OpenConnections: %d, InUse: %d, Idle: %d",
		stats.OpenConnections,
		stats.InUse,
		stats.Idle,
	)
	
	return nil
}

/**
 * データベース接続を安全にクローズ
 * @param db データベース接続オブジェクト
 */
func CloseDatabase(db *sql.DB) {
	if db != nil {
		if err := db.Close(); err != nil {
			log.Printf("[ERROR] Failed to close database connection: %v", err)
		} else {
			log.Println("[INFO] Database connection closed successfully")
		}
	}
}

/**
 * トランザクションを開始
 * @param db データベース接続オブジェクト
 * @return *sql.Tx トランザクションオブジェクト
 * @return error エラー情報
 */
func BeginTransaction(db *sql.DB) (*sql.Tx, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	return tx, nil
}

/**
 * トランザクションをコミット
 * @param tx トランザクションオブジェクト
 * @return error エラー情報
 */
func CommitTransaction(tx *sql.Tx) error {
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}
	return nil
}

/**
 * トランザクションをロールバック
 * @param tx トランザクションオブジェクト
 * @return error エラー情報
 */
func RollbackTransaction(tx *sql.Tx) error {
	if err := tx.Rollback(); err != nil {
		return fmt.Errorf("failed to rollback transaction: %v", err)
	}
	return nil
}
