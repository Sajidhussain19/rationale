import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { ASK_SYSTEM, askSchema } from "@/lib/prompts";
import { loadWorkspace } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { workspaceId, question } = await req.json();
    if (!question?.trim()) return NextResponse.json({ error: "Ask a question" }, { status: 400 });
    const data = await loadWorkspace(workspaceId);
    if (!data.decisions.length) {
      return NextResponse.json({ answer: "The ledger is empty. Add a meeting or load the demo workspace first.", citedDecisionNums: [] });
    }
    const ledger = data.decisions
      .map(
        (d) =>
          `D-${d.num} [${d.date}] status=${d.status} "${d.title}": ${d.statement}\n  Why: ${d.rationale}\n  Rejected: ${d.alternativesRejected.join("; ") || "-"}\n  Owner: ${d.owner} | Quote: "${d.quote}" | Source: ${d.sourceTitle}`,
      )
      .join("\n");
    const conflicts = data.conflicts
      .map((c) => `D-${c.newDecisionNum} ${c.relation} D-${c.existingDecisionNum}${c.resolved ? " (resolved)" : ""}: ${c.explanation}`)
      .join("\n");
    const sources = data.sources.map((s) => `"${s.title}" (${s.date}): ${s.summary}`).join("\n");

    const out = await generateJSON<{ answer: string; citedDecisionNums: number[] }>(
      [{ text: `DECISION LEDGER:\n${ledger}\n\nRELATIONS:\n${conflicts || "-"}\n\nSOURCES:\n${sources}\n\nQUESTION: ${question}` }],
      askSchema,
      ASK_SYSTEM,
    );
    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
