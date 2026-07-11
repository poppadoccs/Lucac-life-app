# Research Prompt 05 — Backend, API Security, Spam Protection, Privacy Hardening

## Role

You are a research analyst helping upgrade **lucacllc.com**. Research only — do
not implement, build, or edit anything. Use current web research and cite your
sources.

## About Lucac LLC

Lucac LLC is a small service-business tech company for contractors, trades, local
service businesses, and serious small businesses.

Services offered:
- Websites
- AI intake chatbots
- Business email setup
- Email migration
- Email automations
- Google Business Profile setup
- Custom apps
- Existing system audits / takeovers
- Monthly care plans

**Founder differentiator:** 18 years in construction/trades. Plain-spoken.
Practical. Not corporate. Not generic AI hype.

## Current goal

We are upgrading lucacllc.com into a top-tier, complete, trust-building website.
Your research must directly help improve the website — not become abstract
strategy.

## Rules for this research

- Research only. No implementation.
- Use current web research and cite sources.
- Prioritize practical recommendations we can apply to the website.
- Every recommendation must become one of these:
  - a page to add
  - a section to add
  - copy to change
  - metadata/schema to add
  - a backend/security improvement
  - a tracking event
  - a trust signal
  - a risk disclaimer
  - a specific implementation checklist item
- No generic advice.
- Keep Lucac plain-spoken, trades-friendly, and practical.
- Avoid fake proof, fake testimonials, guaranteed leads, guaranteed rankings,
  unlimited support, same-day fix promises, or AI hype.

## Canonical pricing (use when relevant)

- Websites from $1,500
- Website refresh/rebuild from $1,000
- Landing page from $750
- Website migration/hosting transfer from $500
- AI chatbot from $750
- Lead capture chatbot from $1,000
- Routing/CRM/booking chatbot from $1,500+
- Simple email automation from $1,000
- Full follow-up automation system from $1,500+
- Business email setup from $450
- Email migration from $750
- Deliverability hardening $150–$300
- Google Business setup from $300
- Existing System Takeover / Audit from $300+
- Custom apps from $5,000+
- Small internal tools from $2,500+ if tightly scoped
- Site Care / Basic Care: $149/mo
- Growth Care: $349/mo
- Managed Systems: $749/mo

## Research subject

Research what the backend needs so the contact form and chatbot do not get
abused. Assume the site is deployed on Vercel with serverless functions handling
the contact form and the chatbot API.

Include:
- Vercel serverless rate limiting (approaches that work in a serverless context)
- Upstash / Vercel KV options for rate-limit state
- honeypot vs Cloudflare Turnstile vs hCaptcha (trade-offs, friction, cost)
- Zod or another validation approach for request payloads
- max field lengths (sensible caps per field)
- safe email HTML escaping (preventing injection in notification emails)
- CORS policy for the API routes
- chatbot abuse prevention (rate limits, token caps, message caps)
- prompt-injection concerns for the chatbot
- logging without unnecessary PII
- Sentry or a lightweight error-logging approach
- security headers: CSP, HSTS, Referrer-Policy, Permissions-Policy,
  X-Content-Type-Options, frame-ancestors
- what can break if CSP is too strict (analytics, fonts, chatbot, embeds)

## Required output

- **Security checklist** — concrete, ordered backend hardening items.
- **Recommended headers** — each security header with a recommended value and a
  one-line note on what it protects and what it might break.
- **Contact API hardening plan** — validation, rate limiting, escaping, CORS,
  spam defense, logging — specific to the contact endpoint.
- **Chatbot API hardening plan** — rate limits, token/message caps,
  prompt-injection mitigations, abuse handling — specific to the chatbot
  endpoint.
- **Spam prevention plan** — the chosen approach (honeypot vs Turnstile vs
  hCaptcha) with reasoning and a fallback.
- **Privacy policy additions** — the specific data-handling statements this
  backend behavior requires us to add to the Privacy page.

## Final output requirements (every prompt)

Do not implement anything.

Your final answer must end with:

1. Highest-priority changes for lucacllc.com
2. Specific website pages/sections affected
3. Exact copy or checklist items where possible
4. What is known
5. What is likely
6. What still needs verification
