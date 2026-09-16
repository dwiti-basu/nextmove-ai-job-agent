# NextMove — Setup Guide (multi-user version)

Free. No credit card required anywhere. This version supports real, separate
accounts — safe to share the deployed URL with other people, since everyone
gets their own private login, their own fact bank, and their own job search.
Nobody can see anyone else's data.

## What changed from the single-user version

- **Real accounts** (Supabase Auth, free) instead of one shared password
- **Private fact bank per person** — each person pastes their own facts on
  their Profile page; nothing is hardcoded in the code anymore
- **Shared job pool, private scoring** — one scan benefits everyone (saves
  API quota), but each person's fit score and CV are generated only from
  their own facts
- **Row-level security** in the database — even a bug in the app code
  couldn't leak one person's data to another; the database itself enforces
  the separation

Same hard rule as every version before: nothing in this codebase applies to
a job or sends a message on anyone's behalf. That's still always a manual,
human step.

## Step 1 — Supabase

1. supabase.com → new project (free)
2. SQL Editor → New Query → paste all of `schema.sql` → Run (creates the
   tables, enables Row Level Security, and sets the access policies)
3. Settings → API → copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to expose
     to the browser — this is how sign-in works)
   - **service_role key** → `SUPABASE_SERVICE_KEY` (keep this one secret;
     only the server-side scanner uses it)
4. Optional but recommended for a smoother experience: Authentication →
   Providers → Email → turn OFF "Confirm email" if you want people to be
   able to sign up and use the app immediately without checking their inbox
   first. Leave it on if you'd rather have that verification step.

## Step 2 — Gemini API key

aistudio.google.com/apikey → Create API key → `GEMINI_API_KEY`

## Step 3 — Google Custom Search (powers the broad job scanning)

1. console.cloud.google.com → create/select a project → search "Custom
   Search API" → Enable → Credentials → Create API Key → `GOOGLE_SEARCH_API_KEY`
2. programmablesearchengine.google.com/controlpanel/create → under "Sites
   to search" choose **"Search the entire web"** → create → copy the
   **Search engine ID** → `GOOGLE_SEARCH_CX`

## Step 4 — Push to GitHub

```
cd job-agent-app
git init
git add .
git commit -m "NextMove — multi-user"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

## Step 5 — Deploy to Vercel

1. vercel.com → Add New Project → import your repo
2. Add environment variables before deploying: `GEMINI_API_KEY`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_KEY`, `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_CX`, and
   `CRON_SECRET` (make up any random string yourself)
3. Deploy → you get a live URL, e.g. `nextmove-yourname.vercel.app`
4. Vercel Dashboard → your project → **Cron Jobs** tab → confirm `/api/cron`
   is scheduled for `30 3 * * *` (9am IST)

## Sharing it with others

Once deployed, just send people the Vercel URL. Each person:
1. Creates their own account on the login page (email + password)
2. Fills in their own fact bank on the Profile page — the app gives them a
   template to fill out (their own name, work history, skills, and an
   "explicitly not true" section to keep their own CVs honest)
3. Sees only their own scored jobs, their own target companies, and their
   own CVs — never yours, and you never see theirs

## Day-to-day use

1. Sign in → the dashboard automatically scores any newly-scanned jobs
   against your own profile the moment you load the page
2. Skip anything scored "Weak" — click "Generate CV" on "Strong" or
   "Moderate" roles worth pursuing; it downloads straight to your computer
3. For the hidden job market: add a target company, click "Draft outreach
   message," review it, and send it yourself

## Honest limits worth knowing

- Google Custom Search's free tier is 100 queries/day, shared across
  everyone using the app (the scan is shared, not per-user) — the default
  role/site combination uses about 32 per scan, so a few runs a day stays
  comfortably within quota
- The per-user relevance assessor scores up to 20 unscored jobs per visit —
  if there's a backlog, just reload the dashboard again to keep going
- Always read every CV and outreach draft before using it — the agents stay
  grounded in each person's own fact bank by design, but everyone should
  still be their own final check
