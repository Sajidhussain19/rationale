import { ws } from "./firebase";
import type { Conflict, Decision, Source, WorkspaceData } from "./types";

export async function loadWorkspace(workspaceId: string): Promise<WorkspaceData> {
  const ref = ws(workspaceId);
  const [s, d, c] = await Promise.all([
    ref.collection("sources").orderBy("createdAt", "desc").get(),
    ref.collection("decisions").orderBy("num", "asc").get(),
    ref.collection("conflicts").orderBy("createdAt", "desc").get(),
  ]);
  return {
    sources: s.docs.map((x) => ({ id: x.id, ...x.data() }) as Source),
    decisions: d.docs.map((x) => ({ id: x.id, ...x.data() }) as Decision),
    conflicts: c.docs.map((x) => ({ id: x.id, ...x.data() }) as Conflict),
  };
}

export async function clearWorkspace(workspaceId: string) {
  const ref = ws(workspaceId);
  for (const col of ["sources", "decisions", "conflicts"]) {
    const snap = await ref.collection(col).get();
    const batch = ref.firestore.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}
