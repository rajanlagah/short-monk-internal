"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Copy, Trash2 } from "lucide-react";
import { api, parseEmails, rewardText, type Recipient, type SurveyDetail } from "@/lib/api";
import { linkFor } from "@/lib/config";
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "–");
const statusOf = (r: Recipient) =>
  r.answeredAt ? "Answered" : new Date(r.expiresAt) < new Date() ? "Expired" : r.openedAt ? "Opened" : "Not opened";
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ghost"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : label}
    </button>
  );
}
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [error, setError] = useState("");
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<SurveyDetail>(`/v1/admin/surveys/${id}`)
      .then(setSurvey)
      .catch((e: Error) => setError(e.message));
  }, [id]);
  if (!survey)
    return <main className="page">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</main>;
  const { stats } = survey;
  const list = parseEmails(emails);
  async function addEmails() {
    setBusy(true);
    setError("");
    try {
      setSurvey(await api<SurveyDetail>(`/v1/admin/surveys/${id}/recipients`, { method: "POST", body: { emails: list } }));
      setEmails("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm(`Delete "${survey!.title}"? Its links stop working and its answers and files are removed.`)) return;
    try {
      await api(`/v1/admin/surveys/${id}`, { method: "DELETE" });
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const tiles: [string, number, string][] = [
    ["Links sent", stats.sent, ""],
    ["Opened", stats.opened, pct(stats.opened, stats.sent)],
    ["Answered", stats.answered, pct(stats.answered, stats.sent)],
    ["Have an account", stats.accounts, pct(stats.accounts, stats.sent)],
    ["Signed up after the link", stats.signups, pct(stats.signups, stats.sent)],
    ["Reward given", stats.rewarded, pct(stats.rewarded, stats.answered)],
  ];
  return (
    <main className="page">
      <div className="heading">
        <div>
          <h1>{survey.title}</h1>
          <p className="muted small">
            Created {new Date(survey.createdAt).toLocaleDateString()} · Reward: {rewardText(survey.rewards)}
          </p>
        </div>
        <button className="ghost danger" onClick={remove}>
          <Trash2 size={15} /> Delete
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="tiles">
        {tiles.map(([label, value, share]) => (
          <div key={label} className="tile">
            <span className="muted small">{label}</span>
            <strong>{value}</strong>
            <span className="muted small">{share}</span>
          </div>
        ))}
      </div>
      <p className="muted small">
        “Opened” means the link was opened in a browser; mail opens aren’t tracked, since the emails are sent by hand.
      </p>
      <h2>Answers</h2>
      {survey.questions.map((q, qi) => {
        const total = q.options.reduce((n, o) => n + o.votes, 0);
        return (
          <section key={q.id} className="panel">
            <h3>
              {qi + 1}. {q.prompt}
            </h3>
            <div className="option-grid">
              {q.options.map((o, oi) => (
                <div key={o.id} className="option-card">
                  {o.media && (
                    <div className="option-media">
                      {o.media.kind === "image" ? <img src={o.media.url} alt="" /> : <video src={o.media.url} controls playsInline preload="metadata" />}
                    </div>
                  )}
                  <span>{o.label || `Option ${oi + 1}`}</span>
                  <div className="bar" aria-hidden>
                    <div style={{ width: total ? `${(o.votes / total) * 100}%` : 0 }} />
                  </div>
                  <span className="small">
                    <strong>{o.votes}</strong> <span className="muted">of {total} · {pct(o.votes, total)}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <div className="heading">
        <h2>Links</h2>
        {survey.recipients.length > 0 && (
          <CopyButton label="Copy all as CSV" text={["email,link", ...survey.recipients.map((r) => `${r.email},${linkFor(r.slug)}`)].join("\n")} />
        )}
      </div>
      {survey.recipients.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Account</th>
                <th>Reward</th>
                <th>Picked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {survey.recipients.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{statusOf(r)}</td>
                  <td className="muted">{r.hasAccount ? (r.signedUpAfter ? "Signed up after" : "Had one already") : "None"}</td>
                  <td className="muted">{r.rewardGrantedAt ? "Given" : r.answeredAt && survey.rewards.length ? "Waiting for sign-up" : "–"}</td>
                  <td className="muted">
                    {survey.questions
                      .map((q, qi) => {
                        const optionId = r.answers.find((a) => a.questionId === q.id)?.optionId;
                        const index = q.options.findIndex((o) => o.id === optionId);
                        return index < 0 ? null : `${qi + 1}: ${q.options[index].label || `Option ${index + 1}`}`;
                      })
                      .filter(Boolean)
                      .join(" · ") || "–"}
                  </td>
                  <td className="num">
                    <CopyButton label="Copy link" text={linkFor(r.slug)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="panel">
        <label className="field">
          <span>Add emails, one per line</span>
          <textarea value={emails} rows={3} onChange={(e) => setEmails(e.target.value)} placeholder="asha@example.com" />
        </label>
        <div className="actions">
          <button className="button" disabled={!list.length || busy} onClick={addEmails}>
            {busy ? "Adding…" : `Add ${list.length || ""} link${list.length === 1 ? "" : "s"}`}
          </button>
          <span className="muted small">An email already on this survey keeps its link.</span>
        </div>
      </section>
    </main>
  );
}
