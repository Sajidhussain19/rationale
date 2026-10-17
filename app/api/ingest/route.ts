import { NextResponse } from "next/server";
import type { Part } from "@google/genai";
import { ws } from "@/lib/firebase";
import { generateJSON } from "@/lib/gemini";
import { EXTRACT_SYSTEM, extractSchema, ledgerContext, type ExtractResult } from "@/lib/prompts";
import { loadWorkspace } from "@/lib/store";
import type { Decision } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 18 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const workspaceId = String(form.get("workspaceId") || "");
    const title = String(form.get("title") || "Untitled source").slice(0, 120);
    const date = String(form.get("date") || new Date().toISOString().slice(0, 10));
    const text = String(form.get("text") || "").slice(0, 200_000);
    const file = form.get("file");

    const parts: Part[] = [];
    let kind = "transcript";
    if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File too large for the prototype (max 18 MB)." }, { status: 413 });
      }
      const mime = file.type || "application/octet-stream";
      const buf = Buffer.from(await file.arrayBuffer());
      if (mime.startsWith("text/") || /\.(txt|md|vtt|srt|csv|json)$/i.test(file.name)) {
        parts.push({ text: `ARTEFACT (${file.name}):\n${buf.toString("utf8").slice(0, 200_000)}` });
        kind = "document";
      } else {
        parts.push({ inlineData: { mimeType: mime, data: buf.toString("base64") } });
        kind = mime.startsWith("audio/") ? "recording" : mime.startsWith("video/") ? "video" : "document";
      }
    }
    if (text.trim()) parts.push({ text: `ARTEFACT TEXT:\n${text}` });
    if (!parts.length) return NextResponse.json({ error: "Provide text or a file." }, { status: 400 });

    const existing = await loadWorkspace(workspaceId);
    parts.unshift({
      text: `${ledgerContext(existing.decisions)}\n\nNEW ARTEFACT: "${title}" dated ${date}. Extract decisions and relations.`,
    });

    const result = await generateJSON<ExtractResult>(parts, extractSchema, EXTRACT_SYSTEM);

    const ref = ws(workspaceId);
    const now = Date.now();
    const sourceRef = ref.collection("sources").doc();
    const batch = ref.firestore.batch();
    let nextNum = existing.decisions.reduce((m, d) => Math.max(m, d.num), 0) + 1;

    const created: Decision[] = (result.decisions || []).map((d, i) => {
      const dref = ref.collection("decisions").doc();
      const dec: Decision = {
        id: dref.id,
        num: nextNum++,
        title: d.title,
        statement: d.statement,
        rationale: d.rationale,
        alternativesRejected: d.alternativesRejected || [],
        owner: d.owner || "Team",
        quote: d.quote || "",
        tags: (d.tags || []).slice(0, 3),
        sourceId: sourceRef.id,
        sourceTitle: title,
        date,
        status: "active",
        createdAt: now + i,
      };
      const { id: _id, ...data } = dec;
      batch.set(dref, data);
      return dec;
    });

    const byNum = new Map(existing.decisions.map((d) => [d.num, d]));
    let conflictCount = 0;
    for (const r of result.relations || []) {
      const nd = created[r.newDecisionIndex];
      const old = byNum.get(r.existingDecisionNum);
      if (!nd || !old) continue;
      batch.set(ref.collection("conflicts").doc(), {
        relation: r.relation,
        severity: r.severity,
        explanation: r.explanation,
        newDecisionId: nd.id,
        newDecisionNum: nd.num,
        existingDecisionId: old.id,
        existingDecisionNum: old.num,
        sourceTitle: title,
        resolved: r.relation !== "contradicts",
        createdAt: now,
      });
      if (r.relation === "contradicts") {
        batch.update(ref.collection("decisions").doc(old.id), { status: "disputed" });
        conflictCount++;
      } else if (r.relation === "supersedes") {
        batch.update(ref.collection("decisions").doc(old.id), { status: "superseded" });
      }
    }

    batch.set(sourceRef, {
      title,
      date,
      kind,
      summary: result.summary || "",
      openQuestions: result.openQuestions || [],
      decisionCount: created.length,
      createdAt: now,
    });
    batch.set(ref, { updatedAt: now }, { merge: true });
    await batch.commit();

    return NextResponse.json({ ok: true, decisions: created.length, conflicts: conflictCount });
  } catch (e) {
    console.error("ingest failed", e);
    return NextResponse.json({ error: (e as Error).message || "Ingest failed" }, { status: 500 });
  }
}
