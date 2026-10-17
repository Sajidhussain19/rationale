import { NextResponse } from "next/server";
import { ws } from "@/lib/firebase";

export const dynamic = "force-dynamic";

/** Resolve a conflict: keep the new decision (old -> superseded) or keep the old one (new -> superseded). */
export async function POST(req: Request) {
  try {
    const { workspaceId, conflictId, keep } = await req.json();
    const ref = ws(workspaceId);
    const cref = ref.collection("conflicts").doc(conflictId);
    const c = (await cref.get()).data();
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const batch = ref.firestore.batch();
    const loser = keep === "old" ? c.newDecisionId : c.existingDecisionId;
    const winner = keep === "old" ? c.existingDecisionId : c.newDecisionId;
    batch.update(ref.collection("decisions").doc(loser), { status: "superseded" });
    batch.update(ref.collection("decisions").doc(winner), { status: "active" });
    batch.update(cref, { resolved: true, resolution: keep === "old" ? "kept-original" : "accepted-new" });
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
