export type DecisionStatus = "active" | "disputed" | "superseded";

export interface Decision {
  id: string;
  num: number;
  title: string;
  statement: string;
  rationale: string;
  alternativesRejected: string[];
  owner: string;
  quote: string;
  tags: string[];
  sourceId: string;
  sourceTitle: string;
  date: string;
  status: DecisionStatus;
  createdAt: number;
}

export interface Conflict {
  id: string;
  relation: "contradicts" | "supersedes" | "refines";
  severity: "high" | "medium" | "low";
  explanation: string;
  newDecisionId: string;
  newDecisionNum: number;
  existingDecisionId: string;
  existingDecisionNum: number;
  sourceTitle: string;
  resolved: boolean;
  createdAt: number;
}

export interface Source {
  id: string;
  title: string;
  date: string;
  kind: string;
  summary: string;
  openQuestions: string[];
  decisionCount: number;
  createdAt: number;
}

export interface WorkspaceData {
  sources: Source[];
  decisions: Decision[];
  conflicts: Conflict[];
}
