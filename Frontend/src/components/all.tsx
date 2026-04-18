import React, { useState, useEffect } from 'react';
import { Project } from '../types';

/**
 * 全案件一覧表示コンポーネント
 * データベースから全案件を取得して、タブ形式で一覧表示します
 */



/**
 * AllProjectsコンポーネントのProps
 */
interface AllProjectsProps {
  isOpen: boolean;  // パネルの開閉状態
  onClose: () => void;  // パネルを閉じる関数
}

const AllProjects: React.FC<AllProjectsProps> = ({ isOpen, onClose }) => {
  // 状態管理
  const [projects, setProjects] = useState<Project[]>([]);  // 案件のリスト
  const [isLoading, setIsLoading] = useState(false);  // ローディング状態
  const [error, setError] = useState<string | null>(null);  // エラーメッセージ
  const [activeTab, setActiveTab] = useState(0);  // 現在のアクティブなタブ番号
  const ITEMS_PER_TAB = 50;  // 1タブあたりの表示件数

  // パネルが開かれた時に全案件を取得
  useEffect(() => {
    if (isOpen) {
      fetchAllProjects();
    }
  }, [isOpen]);

  // 20260103 年明け初作業。全案件のフェッチ処理を書いた。お正月気分で頭が働かなかった。
  /**
   * バックエンドAPIから全案件を取得する
   */
  const fetchAllProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const API_BASE = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_BASE}/api/projects`);
      if (!response.ok) {
        throw new Error('案件の取得に失敗しました');
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('案件の取得に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 案件ソースに応じたバッジ情報を返す
   * @param source 案件のソース（サイト名）
   * @returns バッジのラベル、色、フルネーム
   */
  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'crowdworks.jp':
        return { label: 'CW', color: 'bg-green-500', fullName: 'crowdworks.jp' };
      case 'freelance-start.com':
        return { label: 'FS', color: 'bg-blue-500', fullName: 'freelance-start.com' };
      case 'lancers.jp':
        return { label: 'LA', color: 'bg-orange-500', fullName: 'lancers.jp' };
      default:
        return { label: source.slice(0, 2).toUpperCase(), color: 'bg-gray-500', fullName: source };
    }
  };

  /**
   * 日付文字列を日本語形式にフォーマット
   * @param dateString ISO形式の日付文字列
   * @returns 日本語形式の日付（例：2025年1月15日）
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };


  // 20260110 タブ切り替えのUIを追加した。50件ごとに分けたら見やすくなった。
  // タブ数を計算
  const totalTabs = Math.ceil(projects.length / ITEMS_PER_TAB);

  // 現在のタブで表示するプロジェクトを取得
  const startIndex = activeTab * ITEMS_PER_TAB;
  const endIndex = startIndex + ITEMS_PER_TAB;
  const currentProjects = projects.slice(startIndex, endIndex);

  if (!isOpen) return null;

  return (
    <>
      {/* 背景オーバーレイ */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 fade-in"
        onClick={onClose}
      />

      {/* パネル */}
      <div className="fixed top-0 right-0 h-full w-full md:w-4/5 lg:w-3/4 xl:w-2/3 bg-white shadow-2xl z-50 slide-in-right flex flex-col overflow-x-hidden">
        {/* ヘッダー */}
        <div className="bg-blue-100 text-gray-800 px-6 py-6 flex-shrink-0 border-b border-blue-200 overflow-x-hidden">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                全案件一覧
              </h2>
              <p className="text-gray-600">
                データベース接続確認 - 登録案件数: {projects.length}件 (各タブ{ITEMS_PER_TAB}件ずつ表示)
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-600 hover:bg-blue-200 rounded-full p-2 transition-all"
              aria-label="閉じる"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* タブナビゲーション */}
        {!isLoading && !error && projects.length > 0 && totalTabs > 1 && (
          <div className="bg-white border-b border-gray-300 px-6 py-3 flex-shrink-0 overflow-x-hidden">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: totalTabs }, (_, index) => {
                const tabStart = index * ITEMS_PER_TAB + 1;
                const tabEnd = Math.min((index + 1) * ITEMS_PER_TAB, projects.length);
                return (
                  <button
                    key={index}
                    onClick={() => setActiveTab(index)}
                    className={`px-4 py-2 rounded text-sm font-medium transition-all ${activeTab === index
                      ? 'bg-blue-200 text-gray-800'
                      : 'bg-white text-gray-600 hover:bg-blue-50'
                      }`}
                  >
                    {tabStart}-{tabEnd}件目
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* メインコンテンツエリア */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex space-x-2">
                <div className="w-4 h-4 bg-blue-400 rounded-full loading-dot"></div>
                <div className="w-4 h-4 bg-blue-400 rounded-full loading-dot"></div>
                <div className="w-4 h-4 bg-blue-400 rounded-full loading-dot"></div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
              <p className="font-semibold">エラー</p>
              <p>{error}</p>
              <button
                onClick={fetchAllProjects}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                再試行
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center text-gray-600 mt-10">
              <p className="text-lg">案件が見つかりませんでした。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentProjects.map((project, index) => {
                const badge = getSourceBadge(project.source);
                return (
                  <div
                    key={index}
                    className="bg-white rounded shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  >
                    <div className="p-4 flex-1 flex flex-col">
                      {/* タイトルとバッジ */}
                      <div className="mb-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-sm line-clamp-2 flex-1">
                            {project.title}
                          </h3>
                          <span
                            className={`${badge.color} text-white text-xs px-2 py-1 rounded font-semibold flex-shrink-0`}
                            title={badge.fullName}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {/* 単価を表示 */}
                      {project.price && (
                        <p className="font-bold text-gray-800 text-base mb-3">
                          {project.price}
                        </p>
                      )}

                      {/* 詳細 */}
                      <div className="text-xs text-gray-600 mb-3 flex-1 break-words overflow-hidden">
                        {project.detail || '詳細情報なし'}
                      </div>

                      {/* フッター */}
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-gray-500">
                            {formatDate(project.posted_at)}
                          </p>
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-700 hover:text-gray-900 text-xs font-semibold flex items-center gap-1 underline"
                          >
                            詳細 →
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="bg-gray-100 border-t border-gray-300 px-6 py-4 flex-shrink-0 overflow-x-hidden">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              <span className="text-gray-700">接続状態: 正常</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">
                対象サイト: freelance-start.com, crowdworks.jp, lancers.jp
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AllProjects;
