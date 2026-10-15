import { apiBaseUrl } from "./config";
export type Reward = { key: string; label: string; amount: number };
export type Stats = {
  sent: number;
  opened: number;
  answered: number;
  accounts: number;
  signups: number;
  rewarded: number;
};
export type SurveyRow = {
  id: string;
  title: string;
  createdAt: string;
  questionCount: number;
  rewards: Reward[];
  stats: Stats;
};
export type Media = { kind: "image" | "video"; url: string };
export type Option = { id: string; label: string; media: Media | null; votes: number };
export type Question = { id: string; prompt: string; options: Option[] };
export type Recipient = {
  id: string;
  email: string;
  slug: string;
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  answeredAt: string | null;
  hasAccount: boolean;
  signedUpAfter: boolean;
  rewardGrantedAt: string | null;
  answers: { questionId: string; optionId: string }[];
};
export type SurveyDetail = Omit<SurveyRow, "questionCount"> & {
  intro: string;
  questions: Question[];
  recipients: Recipient[];
};
export type UploadedMedia = Media & { id: string; bytes: number };
export type NewSurvey = {
  title: string;
  intro: string;
  rewards: Record<string, number>;
  questions: { prompt: string; options: { label: string; mediaId?: string }[] }[];
  emails: string[];
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const TOKEN_KEY = "trial-link-creator-token";
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};
export const setToken = (token: string) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
};
// JSON in, JSON out; a FormData body is sent as it is (file upload).
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const form = init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(apiBaseUrl + path, {
      method: init.method || "GET",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        ...(init.body !== undefined && !form ? { "Content-Type": "application/json" } : {}),
      },
      body: form ? (init.body as FormData) : init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("Couldn’t reach the API. Is it running, and is this origin in its CORS_ORIGINS?", 0);
  }
  const body = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error || `Request failed (${res.status})`, res.status);
  return body as T;
}
// One email per line, or separated by commas or spaces.
export const parseEmails = (text: string) => [
  ...new Set(
    text
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
];
export const rewardText = (rewards: Reward[]) =>
  rewards.length ? rewards.map((r) => `${r.amount} ${r.label}`).join(" + ") : "No reward";
