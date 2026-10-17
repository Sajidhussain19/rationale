import { NextResponse } from "next/server";
import { ws } from "@/lib/firebase";
import { DEMO_DECISIONS, DEMO_SOURCES } from "@/lib/demo";
import { clearWorkspace } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Loads a pre-built demo workspace instantly (no AI calls) so judges always have a working baseline. */
export async function POST(req: Request) {
  try {
    const { workspaceId } = await req.json();
    await clearWorkspace(workspaceId);
    const ref = ws(workspaceId);
    const batch = ref.firestore.batch();
    const base = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const srcIds: Record<string, { id: string; title: string; date: string }> = {};

    DEMO_SOURCES.forEach((s, i) => {
      const sref = ref.collection("sources").doc();
      srcIds[s.key] = { id: sref.id, title: s.title, date: s.date };
      const { key: _k, ...rest } = s;
      batch.set(sref, {
        ...rest,
        decisionCount: DEMO_DECISIONS.filter((d) => d.source === s.key).length,
        createdAt: base + i * 1000,
      });
    });

    DEMO_DECISIONS.forEach((d, i) => {
      const src = srcIds[d.source];
      const { source: _s, ...rest } = d;
      batch.set(ref.collection("decisions").doc(), {
        ...rest,
        num: i + 1,
        sourceId: src.id,
        sourceTitle: src.title,
        date: src.date,
        status: "active",
        createdAt: base + i * 1000,
      });
    });
    batch.set(ref, { updatedAt: Date.now(), demo: true }, { merge: true });
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
