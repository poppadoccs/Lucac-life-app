# Research Prompt 06 — Performance, Mobile Polish, Accessibility

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

Research how to make the frontend feel high-end and not janky, on a static
multi-page site. The audience often visits on phones, sometimes on slower
connections in the field.

Include:
- Core Web Vitals (current thresholds for LCP, INP, CLS)
- Lighthouse targets (what scores to aim for)
- animation performance (what's cheap vs. what causes jank)
- scroll reveal best practices (without hurting CLS or feeling slow)
- reduced motion (prefers-reduced-motion handling)
- image optimization (formats, sizing, lazy loading)
- font loading (avoiding FOIT/FOUT, limiting weights)
- mobile nav (patterns that work, what to avoid)
- touch targets (minimum sizes)
- contrast (Alex, the founder, is colorblind — never rely on color alone; this
  matters for the whole site's UI guidance too)
- keyboard navigation
- focus states
- form labels
- chatbot accessibility
- whether the chatbot widget blocks CTAs or content on mobile

## Required output

- **Performance checklist** — concrete, ordered items with target metrics.
- **Accessibility checklist** — concrete WCAG-aligned items, including
  colorblind-safe guidance (labels/icons/patterns alongside color, never color
  alone).
- **Mobile QA checklist** — what to manually verify on a phone before launch.
- **Animation do / don't list** — specific techniques to use and to avoid.
- **Implementation notes for a static multi-page site** — practical notes on how
  to apply the above given the static, multi-page architecture.

## Final output requirements (every prompt)

Do not implement anything.

Your final answer must end with:

1. Highest-priority changes for lucacllc.com
2. Specific website pages/sections affected
3. Exact copy or checklist items where possible
4. What is known
5. What is likely
6. What still needs verification
