"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { api, rewardText, type DraftRow, type SurveyRow } from "@/lib/api";
const pct = (n: number, of: number) => (of ? ` (${Math.round((n / of) * 100)}%)` : "");
export default function Page() {
  const [surveys, setSurveys] = useState<SurveyRow[] | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<SurveyRow[]>("/v1/admin/surveys")
      .then(setSurveys)
      .catch((e: Error) => setError(e.message));
    api<DraftRow[]>("/v1/admin/survey-drafts")
      .then(setDrafts)
      .catch((e: Error) => setError(e.message));
  }, []);
  return (
    <main className="page">
      <div className="heading">
        <h1>Surveys</h1>
        <Link href="/surveys/new" className="button">
          <Plus size={16} /> New survey
        </Link>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {drafts.length > 0 && (
        <section className="panel">
          <h2>Drafts</h2>
          <ul className="draft-list">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/surveys/new?draft=${d.id}`} className="row-link">
                  <FileText size={15} aria-hidden /> {d.title || "Untitled survey"}
                </Link>
                <span className="muted small">
                  {d.questionCount} question{d.questionCount === 1 ? "" : "s"} · saved {new Date(d.updatedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!surveys && !error && <p className="muted">Loading…</p>}
      {surveys?.length === 0 && (
        <p className="muted">No surveys yet. Create one, add emails, and send each person their link.</p>
      )}
      {surveys && surveys.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Survey</th>
                <th>Reward</th>
                <th className="num">Sent</th>
                <th className="num">Opened</th>
                <th className="num">Answered</th>
                <th className="num">Have account</th>
                <th className="num">Signed up after</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {surveys.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/surveys/${s.id}`} className="row-link">
                      {s.title}
                    </Link>
                  </td>
                  <td className="muted">{rewardText(s.rewards)}</td>
                  <td className="num">{s.stats.sent}</td>
                  <td className="num">
                    {s.stats.opened}
                    <span className="muted">{pct(s.stats.opened, s.stats.sent)}</span>
                  </td>
                  <td className="num">
                    {s.stats.answered}
                    <span className="muted">{pct(s.stats.answered, s.stats.sent)}</span>
                  </td>
                  <td className="num">{s.stats.accounts}</td>
                  <td className="num">{s.stats.signups}</td>
                  <td className="muted">{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
