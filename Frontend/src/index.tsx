import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Chat from './components/chat';
import AllProjects from './components/all';
import SkillSheetManager from './components/temp';
import { SkillSheet } from './types';

/**
 * アプリケーションのメインコンポーネント
 * チャット機能、全案件表示、スキルシート管理の3つの主要機能を統合
 */
function App() {
  // 全案件パネルの開閉状態
  const [isAllProjectsOpen, setIsAllProjectsOpen] = useState(false);
  // スキルシート管理パネルの開閉状態
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  // スキルシートのデータを保持（チャットに送信するため）
  const [skillSheetData, setSkillSheetData] = useState<SkillSheet | null>(null);

  // 20251228 スキルシートのデータをチャットに渡す仕組みを実装した。年内になんとか形にできてよかった。
  /**
   * スキルシート送信時のハンドラー
   * スキルシート管理パネルを閉じて、データをチャットコンポーネントに渡す
   */
  const handleTemplateSubmit = (skillSheet: SkillSheet) => {
    setIsTemplateOpen(false);
    setSkillSheetData(skillSheet);
  };

  return (
    <div className="App">
      {/* チャット画面（メイン画面） */}
      <Chat
        onShowAllProjects={() => setIsAllProjectsOpen(true)}
        onShowTemplate={() => setIsTemplateOpen(true)}
        skillSheetData={skillSheetData}
        onSkillSheetSent={() => setSkillSheetData(null)}
      />
      {/* 全案件表示パネル（右側スライドイン） */}
      <AllProjects
        isOpen={isAllProjectsOpen}
        onClose={() => setIsAllProjectsOpen(false)}
      />
      {/* スキルシート管理パネル（右側スライドイン） */}
      <SkillSheetManager
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        onSubmit={handleTemplateSubmit}
      />
    </div>
  );
}

// Reactアプリケーションのルート要素を作成してレンダリング
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
