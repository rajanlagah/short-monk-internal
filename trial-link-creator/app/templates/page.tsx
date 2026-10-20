"use client";
import { useEffect, useMemo, useState } from "react";
import { api, type CaptionTemplate } from "@/lib/api";
type Status = "all" | "active" | "hidden";
// Caption templates (servers/api/src/caption-templates.js): the editor's
// gallery shows the active ones; the worker renders each active one's card.
export default function Page() {
  const [templates, setTemplates] = useState<CaptionTemplate[] | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ templates: CaptionTemplate[] }>("/v1/admin/caption-templates")
      .then((r) => setTemplates(r.templates))
      .catch((e: Error) => setError(e.message));
  }, []);
  const categories = useMemo(() => [...new Set(templates?.map((t) => t.category))].sort(), [templates]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (templates || []).filter(
      (t) =>
        (!needle || t.name.toLowerCase().includes(needle) || t.id.includes(needle)) &&
        (!category || t.category === category) &&
        (status === "all" || t.active === (status === "active")),
    );
  }, [templates, q, category, status]);
  const activeCount = templates?.filter((t) => t.active).length ?? 0;
  async function setActive(slugs: string[], active: boolean) {
    if (!slugs.length) return;
    setBusy(true);
    setError("");
    try {
      const { updated } = await api<{ updated: string[] }>("/v1/admin/caption-templates", { method: "PATCH", body: { slugs, active } });
      const changed = new Set(updated);
      setTemplates((list) => list?.map((t) => (changed.has(t.id) ? { ...t, active } : t)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <div className="heading">
        <h1>Caption templates</h1>
        {templates && (
          <span className="muted">
            {activeCount} of {templates.length} shown in the editor
          </span>
        )}
      </div>
      <p className="muted small">
        Active templates appear in the editor’s gallery for everyone, within about 5 minutes (the list is cached). The worker
        renders a card image for each active template that doesn’t have one yet.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!templates && !error && <p className="muted">Loading…</p>}
      {templates?.length === 0 && (
        <p className="muted">
          No templates in the database. Run the seed insert from <code>servers/api/migrations/0029_caption_templates.sql</code>.
        </p>
      )}
      {templates && templates.length > 0 && (
        <section className="stack">
          <div className="filters">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or id" aria-label="Search templates" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="segmented" role="group" aria-label="Status">
              {(["all", "active", "hidden"] as Status[]).map((s) => (
                <button key={s} aria-pressed={s === status} onClick={() => setStatus(s)}>
                  {s === "all" ? "All" : s === "active" ? "Active" : "Hidden"}
                </button>
              ))}
            </div>
            <button
              className="ghost"
              disabled={busy || !shown.some((t) => !t.active)}
              onClick={() => setActive(shown.filter((t) => !t.active).map((t) => t.id), true)}
            >
              Activate {shown.length === templates.length ? "all" : "these"}
            </button>
            <button
              className="ghost"
              disabled={busy || !shown.some((t) => t.active)}
              onClick={() => setActive(shown.filter((t) => t.active).map((t) => t.id), false)}
            >
              Hide {shown.length === templates.length ? "all" : "these"}
            </button>
          </div>
          {shown.length === 0 ? (
            <p className="muted">No templates match.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Card image</th>
                    <th className="num">Order</th>
                    <th className="num">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span className="template-thumb" style={{ background: t.scene }}>
                          {t.previewUrl ? <img src={t.previewUrl} alt="" /> : <span>{t.sample.replace("|", " ")}</span>}
                        </span>
                      </td>
                      <td>
                        {t.name} <span className="muted small">{t.id}</span>
                      </td>
                      <td>{t.category}</td>
                      <td className="wrap">
                        {t.previewUrl ? (
                          <span className="good-text">Rendered</span>
                        ) : t.previewError ? (
                          <span className="error-text" title={t.previewError}>
                            Failed: {t.previewError}
                          </span>
                        ) : (
                          <span className="muted">{t.active ? "Waiting for the worker" : "Renders once active"}</span>
                        )}
                      </td>
                      <td className="num muted">{t.position}</td>
                      <td className="num">
                        <button
                          role="switch"
                          aria-checked={t.active}
                          aria-label={`Show ${t.name} in the editor`}
                          className="switch"
                          disabled={busy}
                          onClick={() => setActive([t.id], !t.active)}
                        >
                          <span />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
