import React, { useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { SkillSheet, ProjectExperience } from '../types';



// 20260117 技術候補リストを整備した。100個以上になってしまった。ClaudeCodeに補完してもらった部分も多い。
// 主要な技術の候補リスト（サジェスト用）
const TECH_SUGGESTIONS = [
  // プログラミング言語
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'Go', 'Rust',
  'Ruby', 'PHP', 'Swift', 'Kotlin', 'R', 'Scala', 'Haskell', 'Perl', 'Objective-C',
  'MATLAB', 'SQL', 'Assembly', 'COBOL', 'Fortran', 'Lisp', 'Clojure', 'Dart',
  'Elixir', 'Erlang', 'VHDL', 'Verilog', 'Ada', 'PowerShell', 'Shell Script',
  'Bash', 'Zsh', 'VBA', 'VBScript', 'Groovy', 'Lua',

  // マークアップ/スタイル言語
  'HTML', 'HTML5', 'CSS', 'CSS3', 'Sass', 'SCSS', 'Less', 'Stylus', 'XML', 'XSLT',
  'Pug', 'Jade', 'Haml',

  // Webフロントエンド
  'React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js', 'Gatsby', 'Remix',
  'Quasar', 'Bootstrap', 'Tailwind CSS', 'jQuery', 'Backbone.js', 'Ember.js',

  // Webバックエンド
  'Node.js', 'Express.js', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Ruby on Rails',
  'Sinatra', 'Laravel', 'Symfony', 'CakePHP', 'CodeIgniter', 'Spring', 'Spring Boot',
  'Play Framework', 'ASP.NET Core', 'Classic ASP', 'ASP (Legacy)', 'JSP', 'Struts',
  'Gin', 'Echo', 'Fiber', 'Actix-web', 'Axum', 'Warp', 'Phoenix',

  // モバイルアプリ
  'React Native', 'Flutter', 'Xamarin', 'UIKit', 'SwiftUI', 'Android SDK',
  'Jetpack Compose',

  // その他フレームワーク
  '.NET', 'Electron', 'TensorFlow', 'PyTorch', 'Spark', 'Godot', 'Unity',
  'Unreal Engine',

  // IDE / エディタ
  'Visual Studio Code', 'IntelliJ IDEA', 'Eclipse', 'Visual Studio', 'Xcode',
  'Android Studio', 'WebStorm', 'PyCharm', 'Vim', 'Emacs', 'Sublime Text',

  // バージョン管理
  'Git', 'SVN', 'Subversion', 'Perforce',

  // リポジトリホスティング
  'GitHub', 'GitLab', 'Bitbucket', 'Azure DevOps',

  // CI/CD
  'Jenkins', 'CircleCI', 'GitHub Actions', 'GitLab CI/CD', 'Travis CI',
  'Azure Pipelines', 'Argo CD',

  // コンテナ技術
  'Docker', 'Kubernetes', 'K8s', 'Podman', 'LXD', 'LXC',

  // クラウドプラットフォーム
  'AWS', 'Amazon Web Services', 'Microsoft Azure', 'Azure', 'Google Cloud Platform',
  'GCP', 'Heroku', 'Vercel',

  // プロジェクト管理 / コミュニケーション
  'Jira', 'Trello', 'Asana', 'ClickUp', 'Slack', 'Discord', 'Microsoft Teams',

  // テスト / 品質管理
  'JUnit', 'Pytest', 'RSpec', 'Selenium', 'Cypress', 'Jest', 'Postman', 'Swagger',
  'OpenAPI',

  // データベース
  'MySQL', 'PostgreSQL', 'Oracle', 'MongoDB', 'Redis', 'Microsoft SQL Server',
  'SQLite', 'MariaDB', 'Cassandra', 'DynamoDB', 'Elasticsearch',

  // OS - PC/ワークステーション
  'Windows', 'Windows 11', 'Windows 10', 'Windows Server', 'macOS', 'Linux',
  'Ubuntu', 'Fedora', 'Debian', 'CentOS', 'RHEL', 'openSUSE', 'ChromeOS',
  'FreeBSD', 'Solaris', 'IBM AIX',

  // OS - モバイル
  'Android', 'iOS', 'iPadOS', 'watchOS', 'tvOS', 'Tizen', 'HarmonyOS',

  // OS - 組み込み/IoT
  'VxWorks', 'QNX', 'FreeRTOS', 'Embedded Linux', 'RT-Thread', 'Contiki', 'RIOT',
  'Google Fuchsia', 'AROS', 'CP/M', 'DOS'
];

// 対応フェーズの選択肢
const PHASES = [
  '要件定義',
  '基本設計',
  '詳細設計',
  '実装',
  '単体テスト',
  '結合テスト',
  '総合テスト',
  '保守・運用'
];

interface SkillSheetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (skillSheetData: SkillSheet) => void;
}

const SkillSheetManager: React.FC<SkillSheetManagerProps> = ({ isOpen, onClose, onSubmit }) => {
  // スキルシート全体のステート管理
  const [skillSheet, setSkillSheet] = useState<SkillSheet>({
    templateName: 'スキルシート',
    summary: '',
    projectExperiences: []
  });

  /**
   * 職務要約の更新
   */
  const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSkillSheet(prev => ({
      ...prev,
      summary: e.target.value
    }));
  };

  /**
   * 職務経歴を追加
   */
  const addProjectExperience = () => {
    const newProject: ProjectExperience = {
      id: crypto.randomUUID(),
      projectName: '',
      role: '',
      startDate: '',
      endDate: '',
      developmentMethodology: '',
      developmentMethodologyOther: '',
      phases: [],
      technologies: [],
      description: ''
    };
    setSkillSheet(prev => ({
      ...prev,
      projectExperiences: [...prev.projectExperiences, newProject]
    }));
  };

  /**
   * 職務経歴を削除
   */
  const removeProjectExperience = (id: string) => {
    setSkillSheet(prev => ({
      ...prev,
      projectExperiences: prev.projectExperiences.filter(p => p.id !== id)
    }));
  };

  /**
   * 職務経歴の各フィールドを更新
   */
  const updateProjectExperience = (
    id: string,
    field: keyof ProjectExperience,
    value: any
  ) => {
    setSkillSheet(prev => ({
      ...prev,
      projectExperiences: prev.projectExperiences.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    }));
  };

  /**
   * 開発手法の変更処理
   * ウォーターフォール以外が選択された場合、phasesをリセット
   */
  const handleMethodologyChange = (
    id: string,
    value: 'ウォーターフォール' | 'アジャイル' | 'その他' | ''
  ) => {
    setSkillSheet(prev => ({
      ...prev,
      projectExperiences: prev.projectExperiences.map(p => {
        if (p.id === id) {
          // ウォーターフォール以外に変更された場合、phasesをリセット
          const shouldResetPhases = value !== 'ウォーターフォール';
          return {
            ...p,
            developmentMethodology: value,
            phases: shouldResetPhases ? [] : p.phases
          };
        }
        return p;
      })
    }));
  };

  /**
   * 対応フェーズのチェックボックス変更処理
   */
  const handlePhaseToggle = (id: string, phase: string) => {
    setSkillSheet(prev => ({
      ...prev,
      projectExperiences: prev.projectExperiences.map(p => {
        if (p.id === id) {
          const newPhases = p.phases.includes(phase)
            ? p.phases.filter(ph => ph !== phase)
            : [...p.phases, phase];
          return { ...p, phases: newPhases };
        }
        return p;
      })
    }));
  };

  /**
   * ファイルに保存する機能
   * テキスト形式でダウンロード
   */
  const saveToFile = () => {
    // バリデーション: 職務要約か職務経歴のどちらかが入力されているかチェック
    // バリデーション: 職務要約か職務経歴のどちらかが入力されているかチェック
    const hasSummary = skillSheet.summary.trim() !== '';
    // 職務経歴は、プロジェクト名または業務内容が入力されているものがあるかチェック
    const hasProjectExperience = skillSheet.projectExperiences.some(p =>
      p.projectName.trim() !== '' || p.description.trim() !== ''
    );

    if (!hasSummary && !hasProjectExperience) {
      alert('職務要約を入力するか、職務経歴に具体的な内容（プロジェクト名や業務内容）を入力してください。');
      return;
    }

    // テキスト形式にフォーマット
    let text = '';

    // 職務要約が入力されている場合のみ出力
    if (hasSummary) {
      text += `【職務要約】\n${skillSheet.summary}\n\n`;
    }

    // 職務経歴が入力されている場合のみ出力
    if (hasProjectExperience) {
      text += `【職務経歴】\n`;
      skillSheet.projectExperiences.forEach((project, index) => {
        text += `\n■ ${index + 1}. ${project.projectName || '(未入力)'}\n`;
        text += `  役割: ${project.role || '(未入力)'}\n`;
        text += `  期間: ${project.startDate} ～ ${project.endDate}\n`;

        // 開発手法
        let methodology = project.developmentMethodology || '(未選択)';
        if (project.developmentMethodology === 'その他' && project.developmentMethodologyOther) {
          methodology = `その他 (${project.developmentMethodologyOther})`;
        }
        text += `  開発手法: ${methodology}\n`;

        // 対応フェーズ
        if (project.phases.length > 0) {
          text += `  対応フェーズ: ${project.phases.join(', ')}\n`;
        }

        // 使用技術
        text += `  使用技術: ${project.technologies.join(', ') || '(未入力)'}\n`;

        // 業務内容
        text += `  業務内容: ${project.description || '(未入力)'}\n`;
      });
    }

    // テキストファイルとしてダウンロード
    const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skillsheet.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 20260118 経験年数の算出ロジックを実装した。重複期間のマージに2時間以上かかった。意外と奥が深い。
  /**
   * スキルと合計経験年数の動的算出
   * 重複期間を考慮して計算
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const calculateSkillExperience = (): Map<string, number> => {
    // 技術ごとに期間のリストを保持
    const techPeriods: Map<string, Array<{ start: Date; end: Date }>> = new Map();

    // 全ての職務経歴から技術と期間を抽出
    skillSheet.projectExperiences.forEach(project => {
      const startDate = parseDate(project.startDate);
      const endDate = parseDate(project.endDate);

      // 日付が有効な場合のみ処理
      if (startDate && endDate && startDate <= endDate) {
        project.technologies.forEach(tech => {
          if (!techPeriods.has(tech)) {
            techPeriods.set(tech, []);
          }
          techPeriods.get(tech)!.push({ start: startDate, end: endDate });
        });
      }
    });

    // 技術ごとに合計経験年数を算出
    const skillExperience = new Map<string, number>();

    techPeriods.forEach((periods, tech) => {
      // 開始日でソート
      periods.sort((a, b) => a.start.getTime() - b.start.getTime());

      // 重複期間をマージ
      const mergedPeriods: Array<{ start: Date; end: Date }> = [];
      let current = periods[0];

      for (let i = 1; i < periods.length; i++) {
        const next = periods[i];
        // 期間が重複または連続する場合はマージ
        if (next.start <= current.end) {
          current = {
            start: current.start,
            end: new Date(Math.max(current.end.getTime(), next.end.getTime()))
          };
        } else {
          mergedPeriods.push(current);
          current = next;
        }
      }
      mergedPeriods.push(current);

      // 合計月数を計算
      let totalMonths = 0;
      mergedPeriods.forEach(period => {
        const months = monthDiff(period.start, period.end);
        totalMonths += months;
      });

      // 年数に変換（小数点第一位まで）
      const years = Math.round(totalMonths / 12 * 10) / 10;
      skillExperience.set(tech, years);
    });

    return skillExperience;
  };

  /**
   * 日付文字列（YYYY-MM形式）をDateオブジェクトに変換
   */
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || !dateStr.match(/^\d{4}-\d{2}$/)) {
      return null;
    }
    const [year, month] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, 1);
  };

  /**
   * 2つの日付間の月数を計算
   */
  const monthDiff = (start: Date, end: Date): number => {
    const months = (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) + 1;
    return months;
  };

  // 20260124 バリデーション処理を整備した。入力なしで送信されるとAIが混乱するから必要だった。
  /**
   * チャットに送信ボタンの処理
   * 職務要約または職務経歴のいずれかが入力されていることを確認
   */
  const handleSubmitToChat = () => {
    // バリデーション: 職務要約か職務経歴のどちらかが入力されているかチェック
    // バリデーション: 職務要約か職務経歴のどちらかが入力されているかチェック
    const hasSummary = skillSheet.summary.trim() !== '';
    // 職務経歴は、プロジェクト名または業務内容が入力されているものがあるかチェック
    const hasProjectExperience = skillSheet.projectExperiences.some(p =>
      p.projectName.trim() !== '' || p.description.trim() !== ''
    );

    if (!hasSummary && !hasProjectExperience) {
      alert('職務要約を入力するか、職務経歴に具体的な内容（プロジェクト名や業務内容）を入力してください。');
      return;
    }

    onSubmit(skillSheet);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 背景オーバーレイ */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 fade-in"
        onClick={onClose}
      />

      {/* サイドパネル */}
      <div className="fixed top-0 right-0 h-full w-full md:w-4/5 lg:w-3/4 xl:w-2/3 bg-white shadow-2xl z-50 slide-in-right flex flex-col">
        {/* ヘッダー */}
        <div className="bg-green-100 text-gray-800 px-6 py-6 flex-shrink-0 border-b border-green-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                スキルシート管理
              </h2>
              <p className="text-gray-600">
                スキル情報を入力して、AIによる案件検索用のデータを作成します
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-600 hover:bg-green-200 rounded-full p-2 transition-all"
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

          {/* アクションボタン */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={saveToFile}
              className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-all shadow font-semibold"
            >
              ファイルに保存
            </button>
            <button
              onClick={handleSubmitToChat}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-all shadow font-semibold"
            >
              この内容で案件を探す
            </button>
          </div>
        </div>

        {/* メインコンテンツエリア */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-5xl mx-auto">
            {/* スキルシート情報セクション */}
            <div className="bg-white border border-gray-200 rounded shadow-sm p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">▼ スキルシート情報</h3>
              <label className="block mb-2 font-semibold text-gray-700">
                職務要約:
              </label>
              <textarea
                value={skillSheet.summary}
                onChange={handleSummaryChange}
                placeholder="こちらに職務要約を自由記述します。&#10;自身の強みや得意領域、経験などを簡潔にまとめてください。"
                className="w-full min-h-[100px] p-3 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500"
              />
            </div>

            {/* 職務経歴セクション */}
            <div className="bg-white border border-gray-200 rounded shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">▼ 職務経歴</h3>

              {/* 職務経歴リスト */}
              {skillSheet.projectExperiences.map((project, index) => (
                <div
                  key={project.id}
                  className="border border-gray-300 rounded-lg p-4 mb-4 bg-gray-50"
                >
                  {/* プロジェクト名と削除ボタン */}
                  <div className="flex items-center gap-3 mb-3">
                    <label className="font-semibold text-gray-700 w-32">プロジェクト名:</label>
                    <input
                      type="text"
                      value={project.projectName}
                      onChange={(e) => updateProjectExperience(project.id, 'projectName', e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={() => removeProjectExperience(project.id)}
                      className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      削除
                    </button>
                  </div>

                  {/* 担当/役割 */}
                  <div className="flex items-center gap-3 mb-3">
                    <label className="font-semibold text-gray-700 w-32">担当/役割:</label>
                    <input
                      type="text"
                      value={project.role}
                      onChange={(e) => updateProjectExperience(project.id, 'role', e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* 期間 */}
                  <div className="flex items-center gap-3 mb-3">
                    <label className="font-semibold text-gray-700 w-32">期間:</label>
                    <input
                      type="month"
                      value={project.startDate}
                      onChange={(e) => updateProjectExperience(project.id, 'startDate', e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <span className="text-gray-600">～</span>
                    <input
                      type="month"
                      value={project.endDate}
                      onChange={(e) => updateProjectExperience(project.id, 'endDate', e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* 開発手法 */}
                  <div className="mb-3">
                    <label className="font-semibold text-gray-700 block mb-2">開発手法:</label>
                    <div className="flex items-center flex-wrap gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`methodology-${project.id}`}
                          value="ウォーターフォール"
                          checked={project.developmentMethodology === 'ウォーターフォール'}
                          onChange={() => handleMethodologyChange(project.id, 'ウォーターフォール')}
                          className="mr-2"
                        />
                        ウォーターフォール
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`methodology-${project.id}`}
                          value="アジャイル"
                          checked={project.developmentMethodology === 'アジャイル'}
                          onChange={() => handleMethodologyChange(project.id, 'アジャイル')}
                          className="mr-2"
                        />
                        アジャイル
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`methodology-${project.id}`}
                          value="その他"
                          checked={project.developmentMethodology === 'その他'}
                          onChange={() => handleMethodologyChange(project.id, 'その他')}
                          className="mr-2"
                        />
                        その他:
                      </label>
                      <input
                        type="text"
                        value={project.developmentMethodologyOther || ''}
                        onChange={(e) => updateProjectExperience(project.id, 'developmentMethodologyOther', e.target.value)}
                        disabled={project.developmentMethodology !== 'その他'}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                        style={{ width: '200px' }}
                      />
                    </div>
                  </div>

                  {/* 対応フェーズ */}
                  <div className="mb-3">
                    <label className="font-semibold text-gray-700 block mb-2">
                      対応フェーズ: <span className="text-sm text-gray-500">(ウォーターフォール選択時に活性化)</span>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {PHASES.map((phase) => (
                        <label key={phase} className="flex items-center min-w-[130px]">
                          <input
                            type="checkbox"
                            checked={project.phases.includes(phase)}
                            onChange={() => handlePhaseToggle(project.id, phase)}
                            disabled={project.developmentMethodology !== 'ウォーターフォール'}
                            className="mr-2"
                          />
                          {phase}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 使用技術 */}
                  <div className="mb-3">
                    <label className="font-semibold text-gray-700 block mb-2">
                      使用技術: <span className="text-sm text-gray-500">(入力補完付きのタグ形式)</span>
                    </label>
                    <CreatableSelect
                      isMulti
                      value={project.technologies.map(tech => ({ label: tech, value: tech }))}
                      onChange={(selectedOptions) => {
                        const technologies = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                        updateProjectExperience(project.id, 'technologies', technologies);
                      }}
                      options={TECH_SUGGESTIONS.map(tech => ({ label: tech, value: tech }))}
                      placeholder="技術を入力または選択してください..."
                      className="text-sm"
                    />
                  </div>

                  {/* 業務内容 */}
                  <div>
                    <label className="font-semibold text-gray-700 block mb-2">業務内容:</label>
                    <textarea
                      value={project.description}
                      onChange={(e) => updateProjectExperience(project.id, 'description', e.target.value)}
                      placeholder="要件定義からリリース後の保守・運用まで一貫して担当しました。&#10;特に、バックエンドのアーキテクチャ設計と、若手メンバーの育成..."
                      className="w-full min-h-[80px] p-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              ))}

              {/* 職務経歴を追加ボタン */}
              <button
                onClick={addProjectExperience}
                className="w-full px-6 py-3 text-sm bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors font-semibold"
              >
                + 職務経歴を追加
              </button>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="bg-gray-100 border-t border-gray-300 px-6 py-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              入力したスキルシート情報をもとに、AIが最適な案件を検索します
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

export default SkillSheetManager;
