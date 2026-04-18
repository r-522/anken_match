/**
 * 共通型定義ファイル
 * アプリケーション全体で使用されるインターフェースを定義
 */
/**
 * 職務経歴の各プロジェクトを表すインターフェース
 */
export interface ProjectExperience {
    id: string; // リストレンダリング用のユニークID
    projectName: string;
    role: string;
    startDate: string; // "YYYY-MM"形式
    endDate: string;   // "YYYY-MM"形式
    developmentMethodology: 'ウォーターフォール' | 'アジャイル' | 'その他' | '';
    developmentMethodologyOther?: string;
    phases: string[]; // 「ウォーターフォール」選択時のみ有効
    technologies: string[]; // 使用技術を配列で管理
    description: string;
}

/**
 * スキルシート全体のデータを表すインターフェース
 */
export interface SkillSheet {
    templateName: string;
    summary: string;
    projectExperiences: ProjectExperience[];
}

/**
 * スキルの情報（AI分析結果）
 */
export interface Skill {
    skill_name: string;
    experience_years: number;
}

/**
 * AIによる分析結果を表すインターフェース
 */
export interface AIAnalysis {
    estimated_salary: string;
    strengths: string;
    suggestions: string;
    structured_skills: Skill[];
    search_prompt: string;
    key_skills: string[];
    preferred_role: string;
    experience_level: string;
}

/**
 * 案件の情報を表すインターフェース
 */
export interface Project {
    url: string;
    title: string;
    detail: string;
    price: string;
    period: string;
    skills: string;
    source: string;
    posted_at: string;
}

// 20251221 Messageにprojectsとai_analysisを追加した。だいぶ形になってきた気がする。
/**
 * チャットメッセージを表すインターフェース
 */
export interface Message {
    id: number;
    type: 'user' | 'ai';  // メッセージの送信者（ユーザーまたはAI）
    content: string;
    timestamp: Date;
    projects?: Project[];  // AIメッセージに含まれる案件リスト
    ai_analysis?: AIAnalysis;  // AIメッセージに含まれる分析結果
}
