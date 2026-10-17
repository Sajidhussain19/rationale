import { Type } from "@google/genai";
import type { Decision } from "./types";

export const EXTRACT_SYSTEM = `You are Rationale, an organisational memory engine.
Your job: read a team artefact (meeting recording, transcript, chat export, or document) and extract ONLY real DECISIONS -
commitments the team agreed on (not ideas, not open discussion). For each decision capture what was decided, who drove it,
WHY (the rationale), which alternatives were rejected, and a short verbatim supporting quote.

Then compare every NEW decision against the EXISTING DECISION LEDGER provided and flag relationships:
- "contradicts": the new decision is incompatible with an existing active decision and nobody explicitly acknowledged reversing it.
- "supersedes": the new decision explicitly and knowingly replaces an existing one.
- "refines": the new decision narrows, extends or adds an exception to an existing one without negating it.
CRITICAL RULE: if an existing decision explicitly PROHIBITS or rules out something ("no", "not", "never", "will not support")
and the new decision does that thing - even framed as a one-off "exception" or for a single customer - classify it as
"contradicts" with severity "high", UNLESS the owner of the original decision explicitly agrees to reverse it in the new artefact.
Use "refines" only when the new decision is fully compatible with the original (adds detail or scope without violating it).
Only flag genuine relationships. Unrelated decisions must NOT be flagged. Be precise and conservative.
Write explanations for a busy manager: one or two crisp sentences, name the people involved when known.`;

export const extractSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "2-3 sentence summary of the artefact" },
    openQuestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Unresolved questions raised" },
    decisions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short title, max 8 words" },
          statement: { type: Type.STRING, description: "The decision as one clear sentence" },
          rationale: { type: Type.STRING, description: "Why it was decided" },
          alternativesRejected: { type: Type.ARRAY, items: { type: Type.STRING } },
          owner: { type: Type.STRING, description: "Person who made/drove the decision, or 'Team'" },
          quote: { type: Type.STRING, description: "Short verbatim supporting quote" },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-3 lowercase topic tags" },
        },
        required: ["title", "statement", "rationale", "alternativesRejected", "owner", "quote", "tags"],
      },
    },
    relations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          newDecisionIndex: { type: Type.INTEGER, description: "0-based index into decisions[]" },
          existingDecisionNum: { type: Type.INTEGER, description: "The D-number of the existing ledger decision" },
          relation: { type: Type.STRING, enum: ["contradicts", "supersedes", "refines"] },
          severity: { type: Type.STRING, enum: ["high", "medium", "low"] },
          explanation: { type: Type.STRING },
        },
        required: ["newDecisionIndex", "existingDecisionNum", "relation", "severity", "explanation"],
      },
    },
  },
  required: ["summary", "openQuestions", "decisions", "relations"],
};

export interface ExtractResult {
  summary: string;
  openQuestions: string[];
  decisions: Omit<Decision, "id" | "num" | "sourceId" | "sourceTitle" | "date" | "status" | "createdAt">[];
  relations: {
    newDecisionIndex: number;
    existingDecisionNum: number;
    relation: "contradicts" | "supersedes" | "refines";
    severity: "high" | "medium" | "low";
    explanation: string;
  }[];
}

export function ledgerContext(decisions: Decision[]): string {
  if (!decisions.length) return "EXISTING DECISION LEDGER: (empty)";
  const lines = decisions
    .filter((d) => d.status !== "superseded")
    .slice(-80)
    .map(
      (d) =>
        `D-${d.num} [${d.date}] (${d.status}) "${d.title}": ${d.statement} | Why: ${d.rationale} | Owner: ${d.owner} | Source: ${d.sourceTitle}`,
    );
  return `EXISTING DECISION LEDGER:\n${lines.join("\n")}`;
}

export const ASK_SYSTEM = `You are Rationale, a team's decision memory. Answer the user's question ONLY from the decision ledger
and source summaries provided. Explain the WHY behind decisions, mention who decided and when, and note if a decision is disputed
or superseded. Cite decisions inline like [D-3]. If the ledger does not contain the answer, say so plainly and suggest what
meeting or document would be needed. Keep answers under 140 words.`;

export const askSchema = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    citedDecisionNums: { type: Type.ARRAY, items: { type: Type.INTEGER } },
  },
  required: ["answer", "citedDecisionNums"],
};
