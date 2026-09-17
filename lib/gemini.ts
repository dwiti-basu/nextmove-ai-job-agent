const GEMINI_URL =
  // Using the "latest" alias rather than a pinned version — Google has
  // been retiring specific Gemini model versions every few months (2.0-flash
  // was shut down entirely), and this alias is maintained by Google to
  // always point at their current recommended fast model, so this app
  // doesn't need a code update every time they retire a version.
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

async function callGemini(prompt: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in Vercel env vars');

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    })
  });

  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini API error: ' + JSON.stringify(body).slice(0, 300));
  return JSON.parse(text);
}

// Plain-text variant — used when the output is a large, free-form block of
// text (like a whole restructured resume). Wrapping a big multi-line block
// inside a JSON string value is fragile: even correct model output can fail
// JSON.parse if any character isn't escaped exactly right. Skipping the
// JSON wrapper for this kind of output avoids that failure mode entirely.
async function callGeminiRaw(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in Vercel env vars');

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    })
  });

  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini API error: ' + JSON.stringify(body).slice(0, 300));
  return text;
}

export async function assessRelevance(facts: string, jdText: string, jobTitle: string, company: string) {
  const prompt = `You are honestly assessing job fit for a real candidate. Be direct about gaps — do not oversell.

Using ONLY the fact bank below (never invent achievements), assess fit for this role.

Output strictly valid JSON:
{
  "fitScore": "Strong" | "Moderate" | "Weak",
  "notes": "2-3 sentences: what genuinely matches, and the most important real gap, if any"
}

Guidance: "Strong" = core requirements are genuinely met with little stretching.
"Moderate" = real overlap but at least one significant gap (a required degree, a named tool,
a domain) that would need honest acknowledgement.
"Weak" = fundamental mismatch in role type, domain, or seniority track — flag clearly even
if some individual skills overlap.

=== FACT BANK ===
${facts}

=== TARGET ROLE ===
Job Title: ${jobTitle}
Company: ${company}

=== JOB DESCRIPTION TEXT ===
${jdText}`;

  return callGemini(prompt);
}

export async function tailorCV(facts: string, jdText: string, jobTitle: string, company: string) {
  const prompt = `You are building a tailored CV section set for a real candidate applying to a specific job.

STRICT RULES:
1. You may ONLY use facts, numbers, and achievements from the FACT BANK below. Never invent
   metrics, tools, titles, employers, or skills not present in the fact bank.
2. Reword and reorder the fact bank content to mirror the language and priorities of the job
   description, but do not fabricate anything.
3. If the JD requires something not present in the fact bank (a degree, a tool, a domain),
   do NOT claim it. Instead note it plainly in "gaps".
4. Never present the "Personal AI Practice" projects as employment, a business, or a commercial
   venture — they are explicitly non-commercial per the fact bank.
5. Output strictly valid JSON matching the schema below. No markdown, no commentary outside JSON.

SCHEMA:
{
  "tagline": "one line, under 12 words",
  "profileSummary": "4-5 sentences",
  "coreCompetencies": ["...", "... up to 12 items"],
  "experienceBullets": ["...", "... 6-8 bullets for the current/most relevant role"],
  "matchNotes": "2-3 sentence honest assessment of fit, including any real gaps",
  "gaps": ["short phrases naming anything the JD wants that the fact bank does not support"]
}

=== FACT BANK (the only source of truth) ===
${facts}

=== TARGET ROLE ===
Job Title: ${jobTitle}
Company: ${company}

=== JOB DESCRIPTION TEXT ===
${jdText}`;

  return callGemini(prompt);
}

export async function suggestRoles(facts: string) {
  const prompt = `You are a career strategist studying a candidate's real work history to identify
roles and companies they should actively be targeting — including ones they might not think to
search for themselves, because the title doesn't obviously match their background even though the
substance does.

Using ONLY the fact bank below, identify:
1. 5-8 specific job titles worth searching for. Include titles that are a genuine stretch of
   phrasing but a real match of substance (e.g. someone who founded an AI Centre of Excellence
   inside a large company is also a strong match for "Head of GBS Insights & Analytics" or
   "GCC Transformation Director" — titles that don't share obvious keywords with their resume
   but describe the same real work).
2. 4-6 specific companies or company types worth proactive outreach, with a concrete reason tied
   to something in their background (e.g. "FMCG companies building GCCs" if their background is
   FMCG + GCC-building) — name real, plausible companies where you can, not just categories.

Be honest and grounded — do not suggest roles requiring things the fact bank says they don't
have (see the "EXPLICITLY NOT TRUE" section if present). Favor titles/companies that stretch
the SEARCH TERMS, not the person's actual qualifications.

Output strictly valid JSON:
{
  "suggestedRoles": [{ "title": "...", "rationale": "one sentence, specific to this person's facts" }],
  "suggestedCompanies": [{ "name": "...", "rationale": "one sentence, specific to this person's facts" }]
}

=== FACT BANK ===
${facts}`;

  return callGemini(prompt);
}

export async function structureResume(rawText: string): Promise<string> {
  const prompt = `You are converting a real person's uploaded resume into a structured fact bank.

STRICT RULES:
1. Use ONLY what is actually in the resume text below. Never invent, infer, or embellish
   anything — no metrics, dates, titles, or achievements that aren't explicitly stated.
2. If something is ambiguous or unclear in the source text, phrase it as it was written
   rather than guessing at what it "probably" means.
3. Organize the output using this exact structure, as plain text:

NAME — VERIFIED FACT BANK
(Only facts listed here should be used to score jobs or tailor a CV.)

=== IDENTITY ===
Name:
Location:
Email:
Phone:
LinkedIn:

=== HEADLINE FACTS ===
- (years of experience, industries, current role — only if stated in the resume)

=== [COMPANY NAME] — [TITLE] (dates) ===
- (bullet-point achievements, exactly as substantively stated in the resume)
(repeat this section per job in the resume, most recent first)

=== TECHNICAL SKILLS / TOOLS ===
- (only tools/skills explicitly listed in the resume)

=== EDUCATION ===
- (degrees exactly as stated)

=== EXPLICITLY NOT TRUE — NEVER CLAIM THESE ===
- Leave this section with a placeholder comment telling the person to fill it in
  themselves — you cannot infer what is NOT true from a resume alone.

Output ONLY the formatted text above. Do not wrap it in JSON, markdown code fences, or any
commentary before or after it.

=== RESUME TEXT ===
${rawText}`;

  return callGeminiRaw(prompt);
}

export async function draftOutreach(
  facts: string,
  companyName: string,
  whyTargeted: string,
  likelySignal: string,
  recipientRole: string
) {
  const prompt = `You are drafting a warm, professional cold-outreach message from a real candidate
to a company where no specific job posting exists yet — this is "hidden job market" outreach,
not a job application.

STRICT RULES:
1. Use ONLY facts from the FACT BANK below. Never invent achievements, metrics, or claims.
2. The tone should be confident but not presumptuous — this is a conversation-starter, not a
   demand for a role. Acknowledge there may not be an open position and frame it as exploring
   a potential fit.
3. Keep it short — 120-180 words. Recipients of cold outreach skim.
4. Reference the specific signal (why this company, what they seem to be building) naturally,
   not as an obvious template fill.
5. Output strictly valid JSON: { "subject": "...", "messageBody": "..." }

=== FACT BANK ===
${facts}

=== TARGET COMPANY ===
Company: ${companyName}
Why targeted: ${whyTargeted}
Likely signal (what they seem to be building/need): ${likelySignal}
Likely recipient role: ${recipientRole}`;

  return callGemini(prompt);
}
