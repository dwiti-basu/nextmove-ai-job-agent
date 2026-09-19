export interface RawJob {
  title: string;
  company: string;
  location: string;
  link: string;
  source: 'job_board' | 'web_search';
}

// ============================================================
// PRIMARY MECHANISM: broad web search, not restricted to any
// fixed company list. This is what makes the scanner search
// "the internet" rather than only companies you've pre-picked.
// ============================================================

// Role variations searched by default before anyone has accepted any
// suggestions from the Role Suggestion agent. Once people start accepting
// suggestions, the scan pulls from the shared `search_terms` table instead
// (see scan/route.ts) — this array is only the day-one fallback.
const DEFAULT_ROLE_TERMS = [
  'Director Data Science',
  'Head of AI',
  'VP Data Analytics',
  'Head of Data Science'
];

// Job platforms to sweep via Google's site: operator — this is what makes
// the search span the internet broadly instead of one board at a time.
const JOB_SITES = [
  'site:linkedin.com/jobs',
  'site:naukri.com',
  'site:indeed.com',
  '' // one unrestricted query per role term too, to catch company career pages directly
];

const LOCATION_TERM = 'Bengaluru OR Bangalore OR India';

// Builds the actual query strings sent to Google Custom Search. Takes the
// role term list as a parameter (rather than a fixed constant) so it can
// be the shared, growing list from search_terms instead of a hardcoded array.
function buildSearchQueries(roleTerms: string[]): string[] {
  const queries: string[] = [];
  for (const role of roleTerms) {
    for (const site of JOB_SITES) {
      queries.push(site ? `${site} "${role}" ${LOCATION_TERM}` : `"${role}" ${LOCATION_TERM} jobs`);
    }
  }
  return queries;
}

const TITLE_KEYWORDS = [
  'director', 'head of', 'vp', 'vice president', 'chief ai', 'chief data',
  'senior director', 'sr. director', 'sr director'
];
const DOMAIN_KEYWORDS = [
  'ai', 'artificial intelligence', 'data science', 'machine learning',
  'genai', 'generative ai', 'analytics', 'ml'
];

function looksLikeJobPosting(title: string): boolean {
  const t = title.toLowerCase();
  const titleMatch = TITLE_KEYWORDS.some(k => t.includes(k));
  const domainMatch = DOMAIN_KEYWORDS.some(k => t.includes(k));
  return titleMatch && domainMatch;
}

// Google Custom Search — free tier: 100 queries/day, no credit card.
// Setup: console.cloud.google.com -> enable "Custom Search API" -> create API key.
// Then programmablesearchengine.google.com -> create a search engine, set "Search the entire web".
//
// NOTE ON QUOTA: buildSearchQueries() above generates ROLE_TERMS.length * JOB_SITES.length
// queries (currently 8 * 4 = 32) per run. At the default daily cron run, that's well within
// the 100/day free quota, with headroom left for manual re-runs. If you widen ROLE_TERMS or
// JOB_SITES significantly, watch this multiplication — trim one list if you hit the cap.
export async function fetchWebSearchJobs(roleTerms?: string[]): Promise<{ jobs: RawJob[]; errors: string[] }> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) {
    const msg = 'GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_CX not set — web search sweep skipped. See SETUP_GUIDE.md.';
    console.warn(msg);
    return { jobs: [], errors: [msg] };
  }

  const results: RawJob[] = [];
  const errors: string[] = [];
  const queries = buildSearchQueries(roleTerms && roleTerms.length ? roleTerms : DEFAULT_ROLE_TERMS);

  for (const query of queries) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 429) {
          const msg = 'Google Custom Search daily quota hit — stopping web sweep for this run.';
          console.warn(msg);
          errors.push(msg);
          break;
        }
        // Log and surface the actual error instead of silently skipping —
        // this is what was hiding an invalid API key / search engine ID /
        // bad request as a quiet "zero results" instead of a visible error.
        const errorBody = await res.text();
        const msg = `Google Custom Search error (status ${res.status}): ${errorBody.slice(0, 300)}`;
        console.error(msg);
        if (errors.length < 3) errors.push(msg); // avoid flooding the response with repeats
        continue;
      }
      const data = await res.json();
      for (const item of data.items || []) {
        if (!looksLikeJobPosting(item.title)) continue; // cheap pre-filter before the LLM relevance pass
        results.push({
          title: item.title,
          company: item.displayLink || 'Unknown',
          location: '',
          link: item.link,
          source: 'web_search'
        });
      }
      await new Promise(r => setTimeout(r, 250)); // stay gentle on quota / rate limits
    } catch (e) {
      const msg = `Web search failed for "${query}": ${String(e)}`;
      console.error(msg);
      if (errors.length < 3) errors.push(msg);
    }
  }
  return { jobs: results, errors };
}

// ============================================================
// OPTIONAL SUPPLEMENT: specific company job-board APIs.
// Not required — the web search above already covers company
// career pages indirectly through search indexing. Add slugs
// here only for specific companies you want guaranteed, direct
// (non-search-dependent) coverage of.
// ============================================================

export const GREENHOUSE_BOARDS: string[] = [
  // 'example-company-slug',
];

export const LEVER_BOARDS: string[] = [
  // 'example-company-slug',
];

const LOCATION_KEYWORDS = ['india', 'bengaluru', 'bangalore', 'remote'];

function matchesFilters(title: string, location: string): boolean {
  const t = title.toLowerCase();
  const l = (location || '').toLowerCase();
  const titleMatch = TITLE_KEYWORDS.some(k => t.includes(k));
  const domainMatch = DOMAIN_KEYWORDS.some(k => t.includes(k));
  const locationMatch = LOCATION_KEYWORDS.length === 0 || LOCATION_KEYWORDS.some(k => l.includes(k));
  return titleMatch && domainMatch && locationMatch;
}

export async function fetchGreenhouseJobs(): Promise<RawJob[]> {
  const results: RawJob[] = [];
  for (const slug of GREENHOUSE_BOARDS) {
    try {
      const res = await fetch(`https://api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of data.jobs || []) {
        const location = job.location?.name || '';
        if (matchesFilters(job.title, location)) {
          results.push({ title: job.title, company: slug, location, link: job.absolute_url, source: 'job_board' });
        }
      }
    } catch (e) {
      console.error(`Greenhouse fetch failed for ${slug}:`, e);
    }
  }
  return results;
}

export async function fetchLeverJobs(): Promise<RawJob[]> {
  const results: RawJob[] = [];
  for (const slug of LEVER_BOARDS) {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of data || []) {
        const location = job.categories?.location || '';
        if (matchesFilters(job.text, location)) {
          results.push({ title: job.text, company: slug, location, link: job.hostedUrl, source: 'job_board' });
        }
      }
    } catch (e) {
      console.error(`Lever fetch failed for ${slug}:`, e);
    }
  }
  return results;
}

export async function fetchJobDescriptionText(url: string): Promise<string> {
  const res = await fetch(url);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 12000);
}

// Public job feeds that do not require Google Custom Search credentials.
// These feeds are supplementary and may emphasize remote/international roles.
export async function fetchPublicFeedJobs(): Promise<{ jobs: RawJob[]; errors: string[] }> {
  const jobs: RawJob[] = [];
  const errors: string[] = [];
  const relevant = (title: string, description = '') => {
    const text = `${title} ${description}`.toLowerCase();
    const leadership = /\b(director|head|vice president|\bvp\b|chief|lead|leader|principal)\b/.test(text);
    const domain = /\b(ai|artificial intelligence|data science|machine learning|\bml\b|genai|generative ai|analytics|data platform|data & analytics)\b/.test(text);
    return leadership && domain;
  };
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`Arbeitnow HTTP ${res.status}`);
    const payload = await res.json();
    for (const j of payload.data || []) {
      if (relevant(j.title, j.description) && j.url) jobs.push({
        title: j.title, company: j.company_name || 'Unknown', location: j.location || (j.remote ? 'Remote' : ''),
        link: j.url, source: 'job_board'
      });
    }
  } catch (e) { errors.push(`Arbeitnow feed: ${String(e)}`); }
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?limit=100', { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
    const payload = await res.json();
    for (const j of payload.jobs || []) {
      if (relevant(j.title, j.description) && j.url) jobs.push({
        title: j.title, company: j.company_name || 'Unknown', location: j.candidate_required_location || 'Remote',
        link: j.url, source: 'job_board'
      });
    }
  } catch (e) { errors.push(`Remotive feed: ${String(e)}`); }
  return { jobs, errors };
}
