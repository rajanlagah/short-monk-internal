# ShortMonk internal tools

Internal tools for ShortMonk admins. The home page lists them (`lib/tools.ts`; add a new tool there):

- **Surveys** (`/surveys`): trial links, below.
- **Analytics** (`/analytics`): users per plan, processes and the failed ones with their errors, an
  estimated profit and loss for the last 7/30/90 days, and the beta switch per customer
  (API routes in `servers/api/src/admin-analytics.js`).
- **Caption templates** (`/templates`): every template in the database, hidden ones too, with its card
  image state; switch which ones the editor's gallery shows, one at a time or all filtered at once
  (API routes in `servers/api/src/caption-templates.js`).

## Surveys

Build a survey (questions, each with two
or more image/video options), choose a reward, add customer emails, and send
each customer their own link by hand. It then shows, per survey, how many
links were opened and answered and how many of those emails have an account.

It has no backend of its own: it calls the ShortMonk API (`servers/api`,
routes in `src/surveys.js`, tables in migration `0024_surveys.sql`). The page
customers open lives on the public site (`clip-chant-nextjs`, `/t/<slug>`).

## Run it

Node 22.

```bash
cp .env.example .env.local   # fill in
npm install
npm run dev                  # http://localhost:3100
```

The API and Google must both allow this origin:

- add `http://localhost:3100` to `CORS_ORIGINS` in the API's `.env` and restart it;
- add `http://localhost:3100` to the Google OAuth client's "Authorized JavaScript origins".

Sign in with an account that has `users.is_admin = true`.

## How it works

- A link is `NEXT_PUBLIC_SURVEY_SITE_URL/t/<random slug>`. The email is not in the URL.
- A link can be answered once and expires 30 days after it was created.
- The reward (extra AI thumbnail generations, AI captions, …) goes to the
  account with the link's email: at once if it exists, otherwise the first
  time that email signs in.
- A survey can't be edited after it is created; you can add more emails to it, or delete it.
- "Save draft" keeps a survey you're still writing (on the server, so it opens on any machine). Drafts
  are listed on the Surveys page; creating the survey deletes its draft.
