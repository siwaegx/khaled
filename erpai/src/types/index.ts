export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  category: "bug" | "feature" | "refactor" | "test" | "docs";
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnalysisFinding {
  type: "bug" | "improvement" | "info" | "warning";
  message: string;
  file?: string;
}

export interface AnalysisResult {
  analysis: string;
}

export interface TaskSuggestion {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  category: "bug" | "feature" | "refactor" | "test" | "docs";
}
