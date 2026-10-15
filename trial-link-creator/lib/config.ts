const clean = (v: string | undefined) => (v || "").trim().replace(/\/+$/, "");
// One API and one Google OAuth client serve the app, the site and this tool.
export const apiBaseUrl = clean(process.env.NEXT_PUBLIC_API_BASE_URL);
export const googleClientId = clean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
export const surveySiteUrl = clean(process.env.NEXT_PUBLIC_SURVEY_SITE_URL);
export const linkFor = (slug: string) => `${surveySiteUrl}/t/${slug}`;
