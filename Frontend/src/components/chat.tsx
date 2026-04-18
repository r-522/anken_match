import React, { useState, useRef, useEffect } from 'react';
import { SkillSheet, Message } from '../types';

/**
 * チャットインターフェースコンポーネント
 * ユーザーのスキル情報を入力して、AIが案件を検索・推薦する
 */



/**
 * Chatコンポーネントのprops
 */
interface ChatProps {
  onShowAllProjects: () => void;  // 全案件パネルを開く関数
  onShowTemplate: () => void;  // スキルシートパネルを開く関数
  skillSheetData: SkillSheet | null;  // スキルシートから送られてきたデータ
  onSkillSheetSent: () => void;  // スキルシートデータ送信完了後のコールバック
}

const Chat: React.FC<ChatProps> = ({ onShowAllProjects, onShowTemplate, skillSheetData, onSkillSheetSent }) => {
  // 状態管理
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'ai',
      content: 'こんにちは！スキル情報を教えていただければ、最適な案件をご紹介いたします。\n\n例: 「Java3年、TypeScript2年の経験があります。バックエンド開発が得意で、月額80〜100万円の案件を探しています」',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');  // 入力フィールドの値
  const [isLoading, setIsLoading] = useState(false);  // API通信中かどうか
  const [hasProjects, setHasProjects] = useState(false);  // 案件が表示されたことがあるか
  const messagesEndRef = useRef<HTMLDivElement>(null);  // メッセージ末尾への参照

  /**
   * メッセージリストの最下部にスクロール
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // メッセージが更新されたら自動スクロール
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 20260110 メッセージ送信処理を実装した。APIエラーのハンドリングはClaudeCodeと一緒に考えた。
  /**
   * メッセージを送信してAIからレスポンスを取得
   * @param message ユーザーのメッセージ
   */
  const handleSendMessage = async (message: string) => {
    if (message.trim() === '') return;

    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const API_BASE = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message }),
      });

      const data = await response.json();

      if (!response.ok) {
        // エラーレスポンスの場合、詳細なエラーメッセージを表示
        const errorContent = data.error || 'APIエラーが発生しました。もう一度お試しください。';
        const errorMessage: Message = {
          id: messages.length + 2,
          type: 'ai',
          content: errorContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      // 案件が見つからない場合の処理
      const hasResults = data.projects && data.projects.length > 0;
      const aiContent = hasResults
        ? 'ありがとうございます！あなたのスキルに合った案件が見つかりました。'
        : '申し訳ございません。条件に合う案件が見つかりませんでした。';

      const aiMessage: Message = {
        id: messages.length + 2,
        type: 'ai',
        content: aiContent,
        timestamp: new Date(),
        projects: hasResults ? data.projects : undefined,
        ai_analysis: data.ai_analysis,
      };

      setMessages((prev) => [...prev, aiMessage]);
      if (hasResults) {
        setHasProjects(true);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: messages.length + 2,
        type: 'ai',
        content: 'ネットワークエラーが発生しました。接続を確認してもう一度お試しください。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 送信ボタンをクリックした時の処理
   */
  const handleSend = () => {
    handleSendMessage(inputValue);
  };

  // 20260111 スキルシート整形ロジックを追加した。5000文字制限のあたりで結構試行錯誤した。
  /**
   * スキルシートを見やすいテキスト形式に変換
   * 文字数が多い場合は短縮版を使用
   * @param skillSheet スキルシートオブジェクト
   * @returns フォーマットされたテキスト
   */
  const formatSkillSheet = (skillSheet: SkillSheet): string => {
    // まず完全版を生成
    let fullText = '';

    // 職務要約が入力されている場合のみ出力
    const hasSummary = skillSheet.summary.trim() !== '';
    if (hasSummary) {
      fullText += `【職務要約】\n${skillSheet.summary}\n\n`;
    }

    // 職務経歴が入力されている場合のみ出力
    const hasProjectExperience = skillSheet.projectExperiences.length > 0;
    if (hasProjectExperience) {
      fullText += `【職務経歴】\n`;
      skillSheet.projectExperiences.forEach((project, index) => {
        fullText += `\n■ ${index + 1}. ${project.projectName || '(未入力)'}\n`;
        fullText += `  役割: ${project.role || '(未入力)'}\n`;
        fullText += `  期間: ${project.startDate} ～ ${project.endDate}\n`;

        // 開発手法
        let methodology = project.developmentMethodology || '(未選択)';
        if (project.developmentMethodology === 'その他' && project.developmentMethodologyOther) {
          methodology = `その他 (${project.developmentMethodologyOther})`;
        }
        fullText += `  開発手法: ${methodology}\n`;

        // 対応フェーズ
        if (project.phases.length > 0) {
          fullText += `  対応フェーズ: ${project.phases.join(', ')}\n`;
        }

        // 使用技術
        fullText += `  使用技術: ${project.technologies.join(', ') || '(未入力)'}\n`;

        // 業務内容
        fullText += `  業務内容: ${project.description || '(未入力)'}\n`;
      });
    }

    // 文字数制限チェック（5,000文字を超える場合は短縮版を使用）
    const MAX_LENGTH = 5000;
    if (fullText.length <= MAX_LENGTH) {
      return fullText;
    }

    // 短縮版を生成
    let shortText = '';

    if (hasSummary) {
      // 職務要約を100文字に切り詰め
      const truncatedSummary = skillSheet.summary.length > 100
        ? skillSheet.summary.substring(0, 100) + '...'
        : skillSheet.summary;
      shortText += `【職務要約】\n${truncatedSummary}\n\n`;
    }

    if (hasProjectExperience) {
      shortText += `【職務経歴】（${skillSheet.projectExperiences.length}件）\n`;
      skillSheet.projectExperiences.forEach((project, index) => {
        // 「プロジェクト名/役割/期間/使用技術」の簡潔な形式
        const projectName = project.projectName || '(未入力)';
        const role = project.role || '(未入力)';
        const period = `${project.startDate}～${project.endDate}`;
        const techs = project.technologies.length > 0
          ? project.technologies.slice(0, 5).join(', ') + (project.technologies.length > 5 ? ' 他' : '')
          : '(未入力)';

        shortText += `\n■ ${index + 1}. ${projectName} / ${role} / ${period}\n`;
        shortText += `  使用技術: ${techs}\n`;
      });
      shortText += `\n※詳細は省略されています。案件検索には十分な情報が含まれています。`;
    }

    return shortText;
  };

  /**
   * スキルシートからのデータを自動送信
   * スキルシート管理パネルから送られてきたデータを自動的にチャットで送信
   */
  useEffect(() => {
    if (skillSheetData) {
      const formattedText = formatSkillSheet(skillSheetData);
      setInputValue(formattedText);
      // 少し遅延させてから自動送信
      setTimeout(() => {
        handleSendMessage(formattedText);
        onSkillSheetSent();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillSheetData]);

  // 20260117 キーボードショートカットを実装した。Enterで送信・Ctrl+Enterで改行というUXにした。
  /**
   * キーボード入力時の処理
   * Enter: 送信、Shift+Enter/Ctrl+Enter: 改行
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Ctrl+Enterで改行、Enterで送信
    if (e.key === 'Enter' && e.ctrlKey) {
      // Ctrl+Enterで改行（デフォルトの動作を許可）
      return;
    } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * タイムスタンプを時刻形式にフォーマット
   * @param date 日時オブジェクト
   * @returns 時刻（HH:MM形式）
   */
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 案件ソースに応じたバッジ情報を返す
   * @param source 案件のソース（サイト名）
   * @returns バッジのラベルと色
   */
  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'crowdworks.jp':
        return { label: 'CW', color: 'bg-green-500' };
      case 'freelance-start.com':
        return { label: 'FS', color: 'bg-blue-500' };
      case 'lancers.jp':
        return { label: 'LA', color: 'bg-orange-500' };
      default:
        return { label: source.slice(0, 2).toUpperCase(), color: 'bg-gray-500' };
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


  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              スキル案件マッチングシステム
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              AIがあなたのスキルに最適な案件を提案します。
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onShowTemplate}
              className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              テンプレートを使用する
            </button>
            <button
              onClick={onShowAllProjects}
              className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors text-sm font-medium"
            >
              全案件を見る
            </button>
          </div>
        </div>
      </header>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto bg-white px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* メッセージ本体 */}
              <div className="relative max-w-3xl">
                {/* メッセージ内容 */}
                <div
                  className={`${message.type === 'user'
                    ? 'bg-gray-100 text-gray-900 border border-gray-300'
                    : 'bg-white text-gray-800 border border-gray-300'
                    } rounded p-4 shadow-sm`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>

                  {/* AI分析結果 */}
                  {message.ai_analysis && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h3 className="font-semibold text-lg mb-3 text-gray-700">【AI分析結果】</h3>

                      {/* 基本情報 */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-semibold text-gray-700">【経験レベル】</span>
                            <p className="text-gray-800 mt-1 font-medium">{message.ai_analysis.experience_level}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">【推奨役割】</span>
                            <p className="text-gray-800 mt-1 font-medium">{message.ai_analysis.preferred_role}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="font-semibold text-gray-700">【推定単価】</span>
                          <p className="text-gray-800 mt-1 text-lg font-bold">{message.ai_analysis.estimated_salary}</p>
                        </div>
                      </div>

                      {/* 重点スキル */}
                      {message.ai_analysis.key_skills && message.ai_analysis.key_skills.length > 0 && (
                        <div className="mb-3">
                          <span className="font-semibold text-sm text-gray-700">【重点スキル（検索優先）】</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {message.ai_analysis.key_skills.map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-gray-700 text-white text-sm rounded font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 検索プロンプト */}
                      {message.ai_analysis.search_prompt && (
                        <div className="mb-3 bg-gray-50 rounded p-3 border border-gray-300">
                          <span className="font-semibold text-sm text-gray-700">【最適化された検索条件】</span>
                          <p className="text-gray-800 mt-1 text-sm leading-relaxed">{message.ai_analysis.search_prompt}</p>
                        </div>
                      )}

                      {/* 強みと提案 */}
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">【あなたの強み】</span>
                          <p className="text-gray-800 mt-1">{message.ai_analysis.strengths}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">【キャリアアップ提案】</span>
                          <p className="text-gray-800 mt-1">{message.ai_analysis.suggestions}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 案件カード */}
                  {message.projects && message.projects.length > 0 && (
                    <div className="mt-4">
                      <div className="border-t-2 border-gray-300 pt-2 mb-3">
                        <h3 className="font-bold text-lg">
                          【マッチした案件】 ({message.projects.length}件)
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {message.projects.map((project, index) => {
                          const badge = getSourceBadge(project.source);
                          return (
                            <div
                              key={index}
                              className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                              {/* タイトルとバッジ */}
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-semibold text-base flex-1 pr-2">
                                  {project.title}
                                </h4>
                                <span
                                  className={`${badge.color} text-white text-xs px-2 py-1 rounded font-semibold flex-shrink-0`}
                                >
                                  {badge.label}
                                </span>
                              </div>

                              {/* 単価を表示 */}
                              {project.price && (
                                <p className="font-bold text-gray-800 text-lg mb-2">
                                  {project.price}
                                </p>
                              )}
                              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {project.detail}
                              </p>
                              <div className="text-sm space-y-1 mb-3">
                                {project.period && (
                                  <p className="text-gray-600 whitespace-pre-wrap">{project.period}</p>
                                )}
                                {project.skills && (
                                  <p className="text-gray-600">{project.skills}</p>
                                )}
                              </div>
                              <div className="flex justify-between items-center">
                                <p className="text-xs text-gray-500">
                                  掲載日: {formatDate(project.posted_at)}
                                </p>
                                <a
                                  href={project.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-700 hover:text-gray-900 text-sm font-semibold underline"
                                >
                                  詳細を見る →
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* タイムスタンプ */}
                  <div className="text-xs mt-2 text-gray-500">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* ローディングインジケーター */}
          {isLoading && (
            <div className="flex justify-start">
              {/* ローディング吹き出し */}
              <div className="relative">
                {/* ローディングドット本体 */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full loading-dot"></div>
                    <div className="w-3 h-3 bg-gray-400 rounded-full loading-dot"></div>
                    <div className="w-3 h-3 bg-gray-400 rounded-full loading-dot"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 入力エリア */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="スキル情報を入力してください..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 resize-none"
              disabled={isLoading}
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || inputValue.trim() === ''}
              className="px-8 py-3 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium self-end"
            >
              送信
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-right">
            Enterで送信 / Ctrl+Enterで改行
          </p>
        </div>
      </div>

      {/* フッター（案件表示後のみ） */}
      {hasProjects && (
        <footer className="bg-gray-800 text-white text-center py-3 text-sm">
          <p>
            対象サイト: freelance-start.com | crowdworks.jp | lancers.jp
          </p>
          <p className="text-gray-400 mt-1">
            © 2025 スキル案件マッチングシステム
          </p>
        </footer>
      )}
    </div>
  );
};

export default Chat;
