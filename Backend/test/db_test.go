package main

import (
	"database/sql"
	"os"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

// ============================================================
// UT-DB テストケース
// db.go の各関数に対する単体テスト
// ============================================================

// --- validateDBConfig ---

// UT-DB-001: 正常系：有効な接続情報
func TestValidateDBConfig_ValidConfig(t *testing.T) {
	config := DBConfig{
		User:     "testuser",
		Password: "testpass",
		Host:     "localhost",
		Port:     "5432",
		DBName:   "testdb",
		SSLMode:  "disable",
	}

	err := validateDBConfig(config)
	if err != nil {
		t.Errorf("UT-DB-001 FAIL: 有効な設定でエラーが発生: %v", err)
	}
}

// UT-DB-002: 異常系：無効なホスト（空のDB_HOST）
func TestValidateDBConfig_EmptyHost(t *testing.T) {
	config := DBConfig{
		User:     "testuser",
		Password: "testpass",
		Host:     "",
		Port:     "5432",
		DBName:   "testdb",
	}

	err := validateDBConfig(config)
	if err == nil {
		t.Error("UT-DB-002 FAIL: 空のDB_HOSTでエラーが返るべき")
	}
}

// UT-DB-003: 異常系：無効なパスワード（空のDB_PASSWORD）
func TestValidateDBConfig_EmptyPassword(t *testing.T) {
	config := DBConfig{
		User:     "testuser",
		Password: "",
		Host:     "localhost",
		Port:     "5432",
		DBName:   "testdb",
	}

	err := validateDBConfig(config)
	if err == nil {
		t.Error("UT-DB-003 FAIL: 空のDB_PASSWORDでエラーが返るべき")
	}
}

// 追加テスト：空のDB_USER
func TestValidateDBConfig_EmptyUser(t *testing.T) {
	config := DBConfig{
		User:     "",
		Password: "testpass",
		Host:     "localhost",
		Port:     "5432",
		DBName:   "testdb",
	}

	err := validateDBConfig(config)
	if err == nil {
		t.Error("空のDB_USERでエラーが返るべき")
	}
}

// 追加テスト：空のDB_PORT
func TestValidateDBConfig_EmptyPort(t *testing.T) {
	config := DBConfig{
		User:     "testuser",
		Password: "testpass",
		Host:     "localhost",
		Port:     "",
		DBName:   "testdb",
	}

	err := validateDBConfig(config)
	if err == nil {
		t.Error("空のDB_PORTでエラーが返るべき")
	}
}

// 追加テスト：空のDB_NAME
func TestValidateDBConfig_EmptyDBName(t *testing.T) {
	config := DBConfig{
		User:     "testuser",
		Password: "testpass",
		Host:     "localhost",
		Port:     "5432",
		DBName:   "",
	}

	err := validateDBConfig(config)
	if err == nil {
		t.Error("空のDB_NAMEでエラーが返るべき")
	}
}

// --- buildConnectionString ---

func TestBuildConnectionString(t *testing.T) {
	config := DBConfig{
		User:     "myuser",
		Password: "mypass",
		Host:     "db.example.com",
		Port:     "5432",
		DBName:   "mydb",
		SSLMode:  "require",
	}

	expected := "postgres://myuser:mypass@db.example.com:5432/mydb?sslmode=require"
	result := buildConnectionString(config)
	if result != expected {
		t.Errorf("接続文字列が不正\n期待: %s\n実際: %s", expected, result)
	}
}

// --- getEnvWithDefault ---

func TestGetEnvWithDefault_EnvExists(t *testing.T) {
	os.Setenv("TEST_ENV_KEY", "custom_value")
	defer os.Unsetenv("TEST_ENV_KEY")

	result := getEnvWithDefault("TEST_ENV_KEY", "default_value")
	if result != "custom_value" {
		t.Errorf("環境変数が設定されている場合、その値が返るべき。期待: custom_value, 実際: %s", result)
	}
}

func TestGetEnvWithDefault_EnvNotExists(t *testing.T) {
	os.Unsetenv("TEST_ENV_KEY_MISSING")

	result := getEnvWithDefault("TEST_ENV_KEY_MISSING", "default_value")
	if result != "default_value" {
		t.Errorf("環境変数が未設定の場合、デフォルト値が返るべき。期待: default_value, 実際: %s", result)
	}
}

// --- LoadDBConfig ---

func TestLoadDBConfig(t *testing.T) {
	os.Setenv("DB_USER", "test_user")
	os.Setenv("DB_PASSWORD", "test_pass")
	os.Setenv("DB_HOST", "test_host")
	os.Setenv("DB_PORT", "5432")
	os.Setenv("DB_NAME", "test_db")
	defer func() {
		os.Unsetenv("DB_USER")
		os.Unsetenv("DB_PASSWORD")
		os.Unsetenv("DB_HOST")
		os.Unsetenv("DB_PORT")
		os.Unsetenv("DB_NAME")
	}()

	config := LoadDBConfig()

	if config.User != "test_user" {
		t.Errorf("DB_USER: 期待 test_user, 実際 %s", config.User)
	}
	if config.Password != "test_pass" {
		t.Errorf("DB_PASSWORD: 期待 test_pass, 実際 %s", config.Password)
	}
	if config.Host != "test_host" {
		t.Errorf("DB_HOST: 期待 test_host, 実際 %s", config.Host)
	}
	if config.Port != "5432" {
		t.Errorf("DB_PORT: 期待 5432, 実際 %s", config.Port)
	}
	if config.DBName != "test_db" {
		t.Errorf("DB_NAME: 期待 test_db, 実際 %s", config.DBName)
	}
	if config.SSLMode != "require" {
		t.Errorf("DB_SSL_MODE: デフォルトは require。実際 %s", config.SSLMode)
	}
}

// --- UT-DB-004: 正常系：初期化後の取得 (CheckDatabaseHealth) ---

func TestCheckDatabaseHealth_Success(t *testing.T) {
	mockDB, mock, err := sqlmock.New(sqlmock.MonitorPingsOption(true))
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	mock.ExpectPing()

	err = CheckDatabaseHealth(mockDB)
	if err != nil {
		t.Errorf("UT-DB-004 FAIL: 正常なDB接続でヘルスチェックが失敗: %v", err)
	}
}

// --- UT-DB-005: 異常系：初期化前の取得 (nil DB) ---

func TestCheckDatabaseHealth_NilDB(t *testing.T) {
	err := CheckDatabaseHealth(nil)
	if err == nil {
		t.Error("UT-DB-005 FAIL: nilのDBでエラーが返るべき")
	}
}

// --- DefaultDBPoolConfig ---

func TestDefaultDBPoolConfig(t *testing.T) {
	config := DefaultDBPoolConfig()

	if config.MaxOpenConns != 25 {
		t.Errorf("MaxOpenConns: 期待 25, 実際 %d", config.MaxOpenConns)
	}
	if config.MaxIdleConns != 5 {
		t.Errorf("MaxIdleConns: 期待 5, 実際 %d", config.MaxIdleConns)
	}
}

// --- CloseDatabase ---

func TestCloseDatabase_ValidDB(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}

	mock.ExpectClose()

	// CloseDatabase should not panic
	CloseDatabase(mockDB)
}

func TestCloseDatabase_NilDB(t *testing.T) {
	// nilのDBでもパニックしないこと
	CloseDatabase(nil)
}

// --- BeginTransaction ---

func TestBeginTransaction_Success(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	mock.ExpectBegin()

	tx, err := BeginTransaction(mockDB)
	if err != nil {
		t.Errorf("トランザクション開始エラー: %v", err)
	}
	if tx == nil {
		t.Error("トランザクションがnilであるべきではない")
	}
}

// --- CommitTransaction ---

func TestCommitTransaction_Success(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	mock.ExpectBegin()
	mock.ExpectCommit()

	tx, _ := mockDB.Begin()
	err = CommitTransaction(tx)
	if err != nil {
		t.Errorf("コミットエラー: %v", err)
	}
}

// --- RollbackTransaction ---

func TestRollbackTransaction_Success(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	defer mockDB.Close()

	mock.ExpectBegin()
	mock.ExpectRollback()

	tx, _ := mockDB.Begin()
	err = RollbackTransaction(tx)
	if err != nil {
		t.Errorf("ロールバックエラー: %v", err)
	}
}

// --- ConnectDatabase 異常系 ---

func TestConnectDatabase_MissingEnvVars(t *testing.T) {
	// 環境変数をクリア
	os.Unsetenv("DB_USER")
	os.Unsetenv("DB_PASSWORD")
	os.Unsetenv("DB_HOST")
	os.Unsetenv("DB_PORT")
	os.Unsetenv("DB_NAME")

	_, err := ConnectDatabase()
	if err == nil {
		t.Error("環境変数が未設定の場合、エラーが返るべき")
	}
}

// テストヘルパー: sqlmockからDBを作成
func newMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock作成エラー: %v", err)
	}
	return mockDB, mock
}
