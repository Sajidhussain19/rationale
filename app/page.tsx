"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conflict, Decision, WorkspaceData } from "@/lib/types";
import { DEMO_LIVE_MEETING } from "@/lib/demo";

type Msg = { role: "q" | "a"; text: string };
type Toast = { text: string; kind?: "err" | "warn" } | null;

const SUGGESTIONS = [
  "Why did we choose Postgres?",
  "Are we allowed to do on-prem deployments?",
  "What's our pricing for enterprise?",
  "What changed in the last meeting?",
];

function newId() {
  return "ws-" + Math.random().toString(36).slice(2, 10);
}

export default function Home() {
  const [wsId, setWsId] = useState("");
  const [data, setData] = useState<WorkspaceData>({ sources: [], decisions: [], conflicts: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [hl, setHl] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "disputed" | "superseded">("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    let id = url.searchParams.get("ws") || "";
    try {
      if (!id) id = localStorage.getItem("rationale-ws") || "";
    } catch {}
    if (!id) id = newId();
    try {
      localStorage.setItem("rationale-ws", id);
    } catch {}
    setWsId(id);
  }, []);

  const flash = (t: Toast, ms = 4000) => {
    setToast(t);
    setTimeout(() => setToast(null), ms);
  };

  const refresh = useCallback(
    async (markNew = false) => {
      if (!wsId) return;
      setLoading(true);
      try {
        const r = await fetch(`/api/workspace?id=${wsId}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData((prev) => {
          if (markNew) {
            const old = new Set([...prev.decisions.map((d) => d.id), ...prev.conflicts.map((c) => c.id)]);
            const fresh = new Set<string>([...j.decisions, ...j.conflicts].map((x: { id: string }) => x.id).filter((id: string) => !old.has(id)));
            setFreshIds(fresh);
            setTimeout(() => setFreshIds(new Set()), 6000);
          }
          return j;
        });
      } catch (e) {
        flash({ text: "Could not load workspace: " + (e as Error).message, kind: "err" });
      } finally {
        setLoading(false);
      }
    },
    [wsId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const byNum = useMemo(() => new Map(data.decisions.map((d) => [d.num, d])), [data.decisions]);
  const openConflicts = data.conflicts.filter((c) => !c.resolved);

  async function loadDemo() {
    setBusy("demo");
    try {
      const r = await fetch("/api/seed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: wsId }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setMsgs([]);
      await refresh();
      setTitle(DEMO_LIVE_MEETING.title);
      setDate(DEMO_LIVE_MEETING.date);
      setText(DEMO_LIVE_MEETING.text);
      flash({ text: "Demo workspace loaded. A new meeting is ready to analyse on the left." });
    } catch (e) {
      flash({ text: "Demo load failed: " + (e as Error).message, kind: "err" });
    } finally {
      setBusy(null);
    }
  }

  async function ingest() {
    if (!text.trim() && !file) return flash({ text: "Paste a transcript or attach a recording/document.", kind: "err" });
    setBusy("ingest");
    try {
      const fd = new FormData();
      fd.append("workspaceId", wsId);
      fd.append("title", title || file?.name || "Untitled meeting");
      fd.append("date", date);
      fd.append("text", text);
      if (file) fd.append("file", file);
      const r = await fetch("/api/ingest", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await refresh(true);
      setText("");
      setTitle("");
      setFile(null);
      if (j.conflicts > 0) {
        flash({ text: `⚠ ${j.conflicts} conflict${j.conflicts > 1 ? "s" : ""} with past decisions detected. Review in Conflict Radar.`, kind: "warn" }, 6000);
      } else {
        flash({ text: `Extracted ${j.decisions} decision${j.decisions === 1 ? "" : "s"}. No conflicts found.` });
      }
    } catch (e) {
      flash({ text: "Analysis failed: " + (e as Error).message, kind: "err" }, 6000);
    } finally {
      setBusy(null);
    }
  }

  async function ask(question?: string) {
    const qq = (question ?? q).trim();
    if (!qq) return;
    setMsgs((m) => [...m, { role: "q", text: qq }]);
    setQ("");
    setBusy("ask");
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: wsId, question: qq }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsgs((m) => [...m, { role: "a", text: j.answer }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "a", text: "Sorry, I couldn't answer: " + (e as Error).message }]);
    } finally {
      setBusy(null);
    }
  }

  async function resolve(c: Conflict, keep: "new" | "old") {
    setBusy("resolve-" + c.id);
    try {
      const r = await fetch("/api/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: wsId, conflictId: c.id, keep }) });
      if (!r.ok) throw new Error((await r.json()).error);
      await refresh();
      flash({ text: keep === "new" ? `D-${c.newDecisionNum} is now the active decision.` : `Kept D-${c.existingDecisionNum}. D-${c.newDecisionNum} marked superseded.` });
    } catch (e) {
      flash({ text: (e as Error).message, kind: "err" });
    } finally {
      setBusy(null);
    }
  }

  async function newWorkspace() {
    const id = newId();
    try {
      localStorage.setItem("rationale-ws", id);
    } catch {}
    setMsgs([]);
    setData({ sources: [], decisions: [], conflicts: [] });
    setWsId(id);
  }

  function jump(num: number) {
    setHl(num);
    setFilter("all");
    setTimeout(() => document.getElementById(`d-${num}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    setTimeout(() => setHl(null), 2500);
  }

  function renderCites(t: string) {
    return t.split(/(\[D-\d+\])/g).map((part, i) => {
      const m = part.match(/\[D-(\d+)\]/);
      return m ? (
        <span key={i} className="cite" onClick={() => jump(Number(m[1]))}>
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      );
    });
  }

  const decisions = [...data.decisions].reverse().filter((d) => filter === "all" || d.status === filter);

  return (
    <>
      <header className="top">
        <div className="brand">
          <div className="logo">R</div>
          <div>
            <h1>Rationale</h1>
            <p>The decision memory for teams · never lose the why</p>
          </div>
        </div>
        <div className="actions">
          <span className="ws" title="Workspace ID (share with ?ws=)">{wsId}</span>
          <button className="btn" onClick={newWorkspace}>New workspace</button>
          <button className="btn primary" onClick={loadDemo} disabled={!!busy}>
            {busy === "demo" ? <span className="spin" /> : null}Load demo workspace
          </button>
        </div>
      </header>

      <section className="stats">
        <div className="stat"><b>{data.sources.length}</b><span>Sources analysed</span></div>
        <div className="stat"><b>{data.decisions.filter((d) => d.status !== "superseded").length}</b><span>Active decisions</span></div>
        <div className={"stat" + (openConflicts.length ? " alert" : "")}><b>{openConflicts.length}</b><span>Open conflicts</span></div>
        <div className="stat"><b>{data.conflicts.filter((c) => c.resolved).length}</b><span>Resolved / linked</span></div>
      </section>

      <main className="grid">
        {/* LEFT: capture */}
        <div className="col-capture">
          <div className="panel">
            <h2>Capture a decision source</h2>
            <div className="field">
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly product sync" />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Transcript, notes or chat export</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste meeting transcript, Slack thread or doc text..." />
            </div>
            <div className="field">
              <div className="drop" onClick={() => fileRef.current?.click()}>
                {file ? `📎 ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : "🎙 Attach audio, video, PDF or text (max 18 MB)"}
              </div>
              <input ref={fileRef} type="file" hidden accept="audio/*,video/*,application/pdf,text/*,.txt,.md,.vtt,.srt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <button className="btn primary" style={{ width: "100%" }} onClick={ingest} disabled={!!busy || !wsId}>
              {busy === "ingest" ? <><span className="spin" />Gemini is analysing…</> : "Extract decisions & check conflicts"}
            </button>
            <p className="hint">Gemini reads the source natively (audio included), extracts decisions with their rationale, and cross-checks them against your entire decision history.</p>
          </div>

          <div className="panel">
            <h2>Sources</h2>
            {data.sources.length === 0 ? (
              <div className="empty">No sources yet.</div>
            ) : (
              data.sources.map((s) => (
                <div className="src" key={s.id}>
                  <b>{s.title}</b>
                  <span>{s.date} · {s.kind} · {s.decisionCount} decisions</span>
                  <div className="hint">{s.summary}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CENTER: ledger */}
        <div className="col-ledger">
          <div className="panel">
            <h2>
              Decision ledger {loading ? <span className="spin" /> : null}
              <span className="filters">
                {(["all", "active", "disputed", "superseded"] as const).map((f) => (
                  <button key={f} className={"btn sm" + (filter === f ? " primary" : " ghost")} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </span>
            </h2>
            {decisions.length === 0 ? (
              <div className="empty">
                Your team&apos;s decisions will appear here.<br />Click <b>Load demo workspace</b> to try it in 10 seconds.
              </div>
            ) : (
              decisions.map((d) => <DecisionCard key={d.id} d={d} fresh={freshIds.has(d.id)} hl={hl === d.num} />)
            )}
          </div>
        </div>

        {/* RIGHT: conflicts + ask */}
        <div className="col-side">
          <div className="panel">
            <h2>Conflict radar</h2>
            {data.conflicts.length === 0 ? (
              <div className="empty">No contradictions detected. Rationale checks every new decision against history.</div>
            ) : (
              data.conflicts.map((c) => {
                const nd = byNum.get(c.newDecisionNum);
                const od = byNum.get(c.existingDecisionNum);
                return (
                  <div key={c.id} className={`conf ${c.relation}${c.resolved ? " resolved" : ""}${freshIds.has(c.id) ? " new" : ""}`}>
                    <div className="conf-head">
                      {c.relation === "contradicts" ? "⚠ Contradiction" : c.relation === "supersedes" ? "↻ Supersedes" : "↳ Refines"}
                      <span className="pair" onClick={() => jump(c.newDecisionNum)}>D-{c.newDecisionNum}</span>
                      <span style={{ color: "var(--muted)" }}>vs</span>
                      <span className="pair" onClick={() => jump(c.existingDecisionNum)}>D-{c.existingDecisionNum}</span>
                      <span className="chip" style={{ marginLeft: "auto" }}>{c.severity}</span>
                    </div>
                    <p>{c.explanation}</p>
                    <div className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
                      New: “{nd?.title}” ({c.sourceTitle})<br />Was: “{od?.title}” ({od?.sourceTitle}, {od?.date})
                    </div>
                    {!c.resolved && (
                      <div className="row">
                        <button className="btn sm primary" disabled={!!busy} onClick={() => resolve(c, "new")}>Accept new decision</button>
                        <button className="btn sm" disabled={!!busy} onClick={() => resolve(c, "old")}>Keep original</button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="panel">
            <h2>Ask why</h2>
            <div className="chat" ref={chatRef}>
              {msgs.length === 0 && <div className="empty" style={{ padding: 10 }}>Ask about any past decision. Answers cite the decision and its source.</div>}
              {msgs.map((m, i) => (
                <div key={i} className={"msg " + m.role}>{m.role === "a" ? renderCites(m.text) : m.text}</div>
              ))}
              {busy === "ask" && <div className="msg a"><span className="spin" />Thinking…</div>}
            </div>
            <div className="sugs">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn sm ghost" onClick={() => ask(s)} disabled={!!busy}>{s}</button>
              ))}
            </div>
            <form className="row" onSubmit={(e) => { e.preventDefault(); ask(); }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Why did we…?" />
              <button className="btn primary" disabled={!!busy}>Ask</button>
            </form>
          </div>
        </div>
      </main>

      {toast && <div className={"toast " + (toast.kind || "")}>{toast.text}</div>}
    </>
  );
}

function DecisionCard({ d, fresh, hl }: { d: Decision; fresh: boolean; hl: boolean }) {
  return (
    <div id={`d-${d.num}`} className={`dec ${d.status}${fresh ? " new" : ""}${hl ? " hl" : ""}`}>
      <div className="dec-head">
        <div>
          <span className="dec-num">D-{d.num}</span>
          <h3>{d.title}</h3>
        </div>
        <span className={"chip status-" + d.status}>{d.status}</span>
      </div>
      <div className="stmt">{d.statement}</div>
      <div className="why"><b>Why:</b> {d.rationale}</div>
      {d.alternativesRejected?.length > 0 && (
        <div className="why" style={{ marginTop: 4 }}><b>Rejected:</b> {d.alternativesRejected.join(", ")}</div>
      )}
      {d.quote && <blockquote>“{d.quote}”</blockquote>}
      <div className="meta">
        <span className="chip">👤 {d.owner}</span>
        <span className="chip">📅 {d.date}</span>
        <span className="chip">📄 {d.sourceTitle}</span>
        {d.tags?.map((t) => <span key={t} className="chip">#{t}</span>)}
      </div>
    </div>
  );
}
