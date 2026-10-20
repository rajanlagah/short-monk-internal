"use client";
import { useEffect, useState } from "react";
import { api, type Analytics, type Customer, type FailedJob } from "@/lib/api";
const PERIODS = [7, 30, 90];
const KIND_NAMES: Record<string, string> = {
  export: "Export",
  transcribe: "Auto captions",
  probe: "YouTube check",
  ingest: "YouTube import",
  highlights: "AI shorts",
  rate: "Short rating",
  post_copy: "Titles & hashtags",
  thumbnails: "AI thumbnails",
};
const kindName = (k: string) => KIND_NAMES[k] || k;
const inr = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "–");
const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GB`;
export default function Page() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [failed, setFailed] = useState<FailedJob[] | null>(null);
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setData(null);
    api<Analytics>(`/v1/admin/analytics?days=${days}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [days]);
  useEffect(() => {
    setFailed(null);
    api<FailedJob[]>(`/v1/admin/failed-jobs?days=${days}${kind ? `&kind=${kind}` : ""}`)
      .then(setFailed)
      .catch((e: Error) => setError(e.message));
  }, [days, kind]);
  return (
    <main className="page">
      <div className="heading">
        <h1>Analytics</h1>
        <div className="segmented" role="group" aria-label="Period">
          {PERIODS.map((d) => (
            <button key={d} aria-pressed={d === days} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && <Overview data={data} days={days} />}
      {data && (
        <section className="stack">
          <h2>Processes</h2>
          {data.jobs.length === 0 ? (
            <p className="muted">No processes in the last {days} days.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Process</th>
                    <th className="num">Started</th>
                    <th className="num">Completed</th>
                    <th className="num">Failed</th>
                    <th className="num">Cancelled</th>
                    <th className="num">Failure rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((j) => (
                    <tr key={j.kind}>
                      <td>{kindName(j.kind)}</td>
                      <td className="num">{j.total}</td>
                      <td className="num">{j.completed}</td>
                      <td className="num">
                        {j.failed > 0 ? (
                          <button className="link danger-text" onClick={() => setKind(j.kind)}>
                            {j.failed}
                          </button>
                        ) : (
                          0
                        )}
                      </td>
                      <td className="num">{j.cancelled}</td>
                      <td className="num">{pct(j.failed, j.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <section className="stack">
        <div className="heading">
          <h2>Failed processes{kind && ` · ${kindName(kind)}`}</h2>
          {kind && (
            <button className="ghost" onClick={() => setKind("")}>
              Show all kinds
            </button>
          )}
        </div>
        {!failed && <p className="muted">Loading…</p>}
        {failed?.length === 0 && <p className="muted">Nothing failed in the last {days} days.</p>}
        {failed && failed.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Process</th>
                  <th>Customer</th>
                  <th>Project</th>
                  <th className="num">Tries</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((j) => (
                  <tr key={j.id}>
                    <td className="muted">{new Date(j.createdAt).toLocaleString()}</td>
                    <td>{kindName(j.kind)}</td>
                    <td>
                      {j.user ? (
                        <>
                          {j.user.email} <span className="muted small">{j.user.plan}</span>
                        </>
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                    <td className="muted">{j.project?.title || "–"}</td>
                    <td className="num">{j.attempts}</td>
                    <td className="wrap error-text" title={j.error || ""}>
                      {j.error || "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {failed?.length === 100 && <p className="muted small">Showing the latest 100.</p>}
      </section>
      <BetaAccess features={data?.betaFeatures || []} plans={data?.plans.map((p) => ({ slug: p.slug, name: p.name })) || []} />
    </main>
  );
}
function Overview({ data, days }: { data: Analytics; days: number }) {
  const { money, credits } = data;
  const total = data.plans.reduce((n, p) => n + p.users, 0);
  const fresh = data.plans.reduce((n, p) => n + p.newUsers, 0);
  const usedCredits = Math.max(0, credits.spent - credits.refunded);
  return (
    <>
      <section className="stack">
        <h2>Users</h2>
        <div className="tiles">
          <div className="tile">
            <span className="muted small">All users</span>
            <strong>{total}</strong>
            <span className="muted small">+{fresh} in {days} days</span>
          </div>
          {data.plans.map((p) => (
            <div key={p.slug} className="tile">
              <span className="muted small">
                {p.name} {p.priceInr > 0 && `· ${inr(p.priceInr)}/mo`}
              </span>
              <strong>{p.users}</strong>
              <span className="muted small">
                +{p.newUsers} new · {pct(p.users, total)}
                {p.admins > 0 && ` · ${p.admins} admin${p.admins === 1 ? "" : "s"}`}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="stack">
        <h2>Profit and loss · last {days} days</h2>
        <div className="tiles">
          <div className="tile">
            <span className="muted small">Revenue</span>
            <strong>{inr(money.revenue.total)}</strong>
            <span className="muted small">expected</span>
          </div>
          <div className="tile">
            <span className="muted small">Cost</span>
            <strong>{inr(money.cost.total)}</strong>
            <span className="muted small">worst case</span>
          </div>
          <div className="tile">
            <span className="muted small">Net {money.profit < 0 ? "loss" : "profit"}</span>
            <strong className={money.profit < 0 ? "error-text" : "good-text"}>{inr(money.profit)}</strong>
            <span className="muted small">{money.revenue.total > 0 ? `${pct(money.profit, money.revenue.total)} margin` : ""}</span>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <tbody>
              <tr>
                <td>Paid plans</td>
                <td className="muted">monthly price for the days each was active; admin accounts left out</td>
                <td className="num">{inr(money.revenue.subscriptions)}</td>
              </tr>
              <tr>
                <td>Credit top-ups</td>
                <td className="muted">{credits.toppedUp} credits granted as top-ups, at the buyer’s pack price</td>
                <td className="num">{inr(money.revenue.topups)}</td>
              </tr>
              <tr>
                <td>AI processing</td>
                <td className="muted">
                  {usedCredits} credits used ({credits.spent} spent, {credits.refunded} refunded) × ${money.rates.usdPerCredit}
                </td>
                <td className="num">−{inr(money.cost.ai)}</td>
              </tr>
              <tr>
                <td>Storage</td>
                <td className="muted">
                  {gb(money.storedBytes)} stored × ${money.rates.usdPerGbMonth}/GB-month
                </td>
                <td className="num">−{inr(money.cost.storage)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">
          An estimate until checkout ships: plans and top-ups are set by hand, and cost is the worst case per credit from
          the cost sheet at ₹{money.rates.inrPerUsd}/$. Not included: servers, database, hosting and payment fees.{" "}
          {credits.given > 0 && `${credits.given} credits were also given away (signup, surveys, admin); they cost only once spent.`}
        </p>
      </section>
    </>
  );
}
function BetaAccess({ features, plans }: { features: string[]; plans: { slug: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [betaOnly, setBetaOnly] = useState(false);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (plan) params.set("plan", plan);
    if (betaOnly) params.set("beta", "true");
    // Wait for typing to stop.
    const timer = setTimeout(() => {
      api<Customer[]>(`/v1/admin/customers?${params}`)
        .then(setCustomers)
        .catch((e: Error) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, plan, betaOnly]);
  async function toggle(c: Customer) {
    setBusy(c.id);
    setError("");
    try {
      const updated = await api<Customer>(`/v1/admin/customers/${c.id}/beta`, { method: "PATCH", body: { enabled: !c.betaEnabled } });
      setCustomers((list) => list?.map((x) => (x.id === c.id ? updated : x)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="stack">
      <h2>Beta access</h2>
      <p className="muted small">
        Beta turns on every beta feature for that account
        {features.length > 0 && (
          <>
            : <code>{features.join(", ")}</code>
          </>
        )}
        . It takes effect the next time their app loads.
      </p>
      <div className="filters">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name" aria-label="Search customers" />
        <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan">
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={betaOnly} onChange={(e) => setBetaOnly(e.target.checked)} /> Beta only
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!customers && <p className="muted">Loading…</p>}
      {customers?.length === 0 && <p className="muted">No customers match.</p>}
      {customers && customers.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Plan</th>
                <th>Joined</th>
                <th className="num">Beta</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.email} {c.isAdmin && <span className="muted small">admin</span>}
                  </td>
                  <td className="muted">{c.name || "–"}</td>
                  <td>{plans.find((p) => p.slug === c.plan)?.name || c.plan}</td>
                  <td className="muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="num">
                    <button
                      role="switch"
                      aria-checked={c.betaEnabled}
                      aria-label={`Beta for ${c.email}`}
                      className="switch"
                      disabled={busy === c.id}
                      onClick={() => toggle(c)}
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
      {customers?.length === 50 && <p className="muted small">Showing the newest 50. Search to find others.</p>}
    </section>
  );
}
