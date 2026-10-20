"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Save, Trash2, Upload, X } from "lucide-react";
import {
  api,
  parseEmails,
  type Draft,
  type DraftBody,
  type NewSurvey,
  type SurveyDetail,
  type UploadedMedia,
} from "@/lib/api";
type DraftOption = { key: number; label: string; media: UploadedMedia | null; uploading: boolean; error: string };
type DraftQuestion = { key: number; prompt: string; options: DraftOption[] };
const MIN_OPTIONS = 2,
  MAX_OPTIONS = 6;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
let nextKey = 1;
const newOption = (): DraftOption => ({ key: nextKey++, label: "", media: null, uploading: false, error: "" });
const newQuestion = (): DraftQuestion => ({ key: nextKey++, prompt: "", options: [newOption(), newOption()] });
// Compares what's on screen with what was last saved.
const snapshot = (b: DraftBody) =>
  JSON.stringify([b.title, b.intro, b.credits, b.emails, b.questions.map((q) => [q.prompt, q.options.map((o) => [o.label, o.mediaId ?? null])])]);
const bodyOf = (d: Draft): DraftBody => ({
  ...d,
  questions: d.questions.map((q) => ({
    prompt: q.prompt,
    options: q.options.map((o) => ({ label: o.label, ...(o.media ? { mediaId: o.media.id } : {}) })),
  })),
});
// useSearchParams needs a Suspense boundary to build.
export default function Page() {
  return (
    <Suspense fallback={<main className="page form muted">Loading…</main>}>
      <SurveyForm />
    </Suspense>
  );
}
function SurveyForm() {
  const router = useRouter();
  // ?draft=<id> opens a saved draft; saving a new one puts its id there.
  const draftParam = useSearchParams().get("draft");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftParam));
  const [savedAs, setSavedAs] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [credits, setCredits] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => [newQuestion()]);
  const [emails, setEmails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const draftBody = (): DraftBody => ({
    title,
    intro,
    credits,
    questions: questions.map((q) => ({
      prompt: q.prompt,
      options: q.options.map((o) => ({ label: o.label, ...(o.media ? { mediaId: o.media.id } : {}) })),
    })),
    emails,
  });
  const fill = (d: Draft) => {
    setTitle(d.title);
    setIntro(d.intro);
    setCredits(d.credits);
    setEmails(d.emails);
    setQuestions(
      d.questions.length
        ? d.questions.map((q) => ({
            key: nextKey++,
            prompt: q.prompt,
            options: q.options.map((o) => ({ ...newOption(), label: o.label, media: o.media })),
          }))
        : [newQuestion()],
    );
    setDraftId(d.id);
    setSavedAt(new Date(d.updatedAt));
    setSavedAs(snapshot(bodyOf(d)));
  };
  useEffect(() => {
    if (!draftParam || draftParam === draftId) return;
    setLoadingDraft(true);
    api<Draft>(`/v1/admin/survey-drafts/${draftParam}`)
      .then(fill)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingDraft(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam]);
  const patchQuestion = (key: number, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const patchOption = (qKey: number, oKey: number, patch: Partial<DraftOption>) =>
    setQuestions((qs) =>
      qs.map((q) =>
        q.key === qKey ? { ...q, options: q.options.map((o) => (o.key === oKey ? { ...o, ...patch } : o)) } : q,
      ),
    );
  async function upload(qKey: number, oKey: number, file: File) {
    patchOption(qKey, oKey, { uploading: true, error: "" });
    try {
      const body = new FormData();
      body.append("file", file);
      const media = await api<UploadedMedia>("/v1/admin/survey-media", { method: "POST", body });
      patchOption(qKey, oKey, { media, uploading: false });
    } catch (e) {
      patchOption(qKey, oKey, { uploading: false, error: (e as Error).message });
    }
  }
  const list = parseEmails(emails);
  const rewardCredits = Math.floor(Number(credits)) || 0;
  const uploading = questions.some((q) => q.options.some((o) => o.uploading));
  const problem = !title.trim()
    ? "Give the survey a title."
    : questions.some((q) => !q.prompt.trim())
      ? "Every question needs its text."
      : questions.some((q) => q.options.some((o) => !o.label.trim() && !o.media))
        ? "Every option needs a label, a picture or a video."
        : uploading
          ? "Wait for the uploads to finish."
          : rewardCredits < 0 || rewardCredits > 1000
            ? "Reward must be between 0 and 1000 credits."
            : "";
  async function saveDraft() {
    setSavingDraft(true);
    setError("");
    try {
      const body = draftBody();
      const d = draftId
        ? await api<Draft>(`/v1/admin/survey-drafts/${draftId}`, { method: "PUT", body })
        : await api<Draft>("/v1/admin/survey-drafts", { method: "POST", body });
      setDraftId(d.id);
      setSavedAt(new Date(d.updatedAt));
      setSavedAs(snapshot(body));
      // Next's router picks this up, so a reload opens the draft.
      if (!draftId) window.history.replaceState(null, "", `?draft=${d.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingDraft(false);
    }
  }
  async function deleteDraft() {
    if (!draftId || !window.confirm("Delete this draft? Its uploaded pictures and videos are removed too.")) return;
    try {
      await api(`/v1/admin/survey-drafts/${draftId}`, { method: "DELETE" });
      router.push("/surveys");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    setSaving(true);
    setError("");
    const body: NewSurvey = {
      title,
      intro,
      rewards: rewardCredits > 0 ? { credits: rewardCredits } : {},
      questions: questions.map((q) => ({
        prompt: q.prompt,
        options: q.options.map((o) => ({ label: o.label, ...(o.media ? { mediaId: o.media.id } : {}) })),
      })),
      emails: list,
      ...(draftId ? { draftId } : {}),
    };
    try {
      const survey = await api<SurveyDetail>("/v1/admin/surveys", { method: "POST", body });
      router.push(`/surveys/${survey.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }
  const unsaved = snapshot(draftBody()) !== savedAs;
  if (loadingDraft) return <main className="page form muted">Loading draft…</main>;
  return (
    <main className="page form">
      <div className="heading">
        <h1>New survey</h1>
        {draftId && (
          <button className="ghost danger" onClick={deleteDraft}>
            <Trash2 size={15} /> Delete draft
          </button>
        )}
      </div>
      <section className="panel">
        <label className="field">
          <span>Title</span>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Which thumbnail would you click?" />
        </label>
        <label className="field">
          <span>Intro (optional)</span>
          <textarea value={intro} maxLength={1000} rows={2} onChange={(e) => setIntro(e.target.value)} placeholder="Shown above the questions." />
        </label>
      </section>
      <section className="panel">
        <h2>Reward for answering</h2>
        <p className="muted small">
          Bonus credits added to the customer’s account on top of their plan’s monthly credits. They don’t reset and stay
          until spent. Leave at 0 for none.
        </p>
        <label className="field row">
          <span>Credits</span>
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            value={credits}
            placeholder="0"
            onChange={(e) => setCredits(e.target.value)}
          />
        </label>
      </section>
      {questions.map((q, qi) => (
        <section key={q.key} className="panel">
          <div className="heading">
            <h2>Question {qi + 1}</h2>
            {questions.length > 1 && (
              <button className="ghost" onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}>
                <Trash2 size={15} /> Remove
              </button>
            )}
          </div>
          <label className="field">
            <span>Question</span>
            <input value={q.prompt} maxLength={300} onChange={(e) => patchQuestion(q.key, { prompt: e.target.value })} placeholder="Which one do you like most?" />
          </label>
          <div className="option-grid">
            {q.options.map((o, oi) => (
              <div key={o.key} className="option-card">
                <div
                  className={`option-media${dropTarget === o.key ? " dropping" : ""}`}
                  onDragOver={(e) => {
                    if (o.uploading || !e.dataTransfer.types.includes("Files")) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    setDropTarget(o.key);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTarget(null);
                    const file = e.dataTransfer.files[0];
                    if (!file) return;
                    if (!ACCEPT.split(",").includes(file.type))
                      return patchOption(q.key, o.key, { error: "Drop a JPEG, PNG, WebP, GIF, MP4, WebM or MOV file." });
                    void upload(q.key, o.key, file);
                  }}
                >
                  {o.media?.kind === "image" && <img src={o.media.url} alt="" />}
                  {o.media?.kind === "video" && <video src={o.media.url} controls playsInline preload="metadata" />}
                  {!o.media && (
                    <label className="upload">
                      <Upload size={18} />
                      {o.uploading ? "Uploading…" : "Drop or choose an image or video"}
                      <input
                        type="file"
                        accept={ACCEPT}
                        disabled={o.uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void upload(q.key, o.key, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                {o.error && <p className="error small">{o.error}</p>}
                <input value={o.label} maxLength={120} onChange={(e) => patchOption(q.key, o.key, { label: e.target.value })} placeholder={`Option ${oi + 1} label`} aria-label={`Option ${oi + 1} label`} />
                <div className="option-actions">
                  {o.media && (
                    <button className="ghost" onClick={() => patchOption(q.key, o.key, { media: null })}>
                      <X size={15} /> Change file
                    </button>
                  )}
                  {q.options.length > MIN_OPTIONS && (
                    <button className="ghost" onClick={() => patchQuestion(q.key, { options: q.options.filter((x) => x.key !== o.key) })}>
                      <Trash2 size={15} /> Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {q.options.length < MAX_OPTIONS && (
            <button className="ghost" onClick={() => patchQuestion(q.key, { options: [...q.options, newOption()] })}>
              <Plus size={15} /> Add option
            </button>
          )}
        </section>
      ))}
      <button className="ghost" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
        <Plus size={15} /> Add question
      </button>
      <section className="panel">
        <h2>Send to</h2>
        <label className="field">
          <span>Emails, one per line (you can add more later)</span>
          <textarea value={emails} rows={5} onChange={(e) => setEmails(e.target.value)} placeholder={"asha@example.com\nvikram@example.com"} />
        </label>
        <p className="muted small">
          {list.length} email{list.length === 1 ? "" : "s"}. Each gets its own link, valid for 30 days. Nothing is emailed from here.
        </p>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="button" disabled={Boolean(problem) || saving || savingDraft} onClick={save}>
          {saving ? "Creating…" : "Create survey"}
        </button>
        <button className="ghost" disabled={!unsaved || uploading || savingDraft || saving} onClick={saveDraft}>
          <Save size={15} /> {savingDraft ? "Saving…" : "Save draft"}
        </button>
        <span className="muted small">
          {savedAt && (unsaved ? "Unsaved changes. " : `Draft saved ${savedAt.toLocaleTimeString()}. `)}
          {problem || "A survey can’t be edited after it’s created."}
        </span>
      </div>
    </main>
  );
}
