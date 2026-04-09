# Budget App Research — C5 / BUD-01
**Date:** 2026-04-09  
**Scope:** Top 6 consumer budget apps — feature scrape for Lucac Life App BudgetTab upgrade  
**Time-boxed:** ~45 min research session

---

## Apps Surveyed

| App | Platform | Price | Status |
|-----|----------|-------|--------|
| YNAB (You Need A Budget) | Web, iOS, Android | $14.99/mo or $99/yr | Active |
| Mint | Web, iOS, Android | Free | **Discontinued Jan 2024** — redirected to Credit Karma |
| Rocket Money | Web, iOS, Android | Free / $6–12/mo Premium | Active |
| Monarch Money | Web, iOS, Android | $14.99/mo or $99/yr | Active |
| Copilot | iOS only | $13/mo or $95/yr | Active (iOS-only limitation) |
| PocketGuard | Web, iOS, Android | Free / $7.99/mo Plus | Active |

---

## Per-App Feature Matrix

### 1. YNAB (You Need A Budget)
**Core philosophy:** Give Every Dollar a Job — proactive zero-based budgeting.

**Features:**
- Envelope (category) budgeting — allocate income to categories before spending
- Manual entry + bank import (OAuth sync)
- Goal tracking per category (save by date, monthly contribution, target balance)
- Age of money metric — how long you hold money before spending
- Scheduled transactions (recurring income/expenses with skip/modify controls)
- Live bank sync with duplicate detection
- Reports: spending, net worth, income vs expense, age of money
- Web + mobile, family sharing (6 accounts on one subscription)
- Loan accounts, credit card flow modeling

**Category model:** Fully custom, organized into groups (e.g. "Monthly Bills" group → Electric, Internet, Rent). No presets forced on you.

**Recurring handling:** Scheduled transactions with `nextDate` + frequency (weekly/monthly/yearly/custom). On the due date they auto-appear in the budget view as pending; you approve them. They do NOT auto-add without user confirmation — YNAB calls this "intentional."

**Visualizations:** Bar charts (monthly spending by category), line graph (net worth over time), spending wheel (donut by category), age-of-money gauge.

**Export:** CSV download of all transactions, filtered by date range and account.

**UX notes:** Complex onboarding (4-step method), steep learning curve. Best-in-class for serious budgeters. Desktop/web UI is dense.

**Ratings:**
| Dimension | Score (1–5) |
|-----------|-------------|
| Simplicity | 2 |
| Kid-visibility-safe | 3 |
| Free | 1 (paid) |
| Visual clarity (colorblind) | 3 (color used but labels present) |

---

### 2. Mint (Discontinued Jan 2024)
**Status:** Shut down Jan 1, 2024. Users redirected to Credit Karma (Intuit product).  
**Included for historical reference — do not model current features on this.**

**Was notable for:**
- Free automatic bank sync (largest user base at closure, ~3.5M users)
- Auto-categorization via ML
- Bill tracker with due-date alerts
- Credit score monitoring
- Monthly budget alerts ("You've used 80% of your Groceries budget")

**Why it died:** Intuit could not monetize Mint's free users; Credit Karma's credit-product model was more profitable.

**Lesson for us:** Auto-categorization is the killer feature users miss most. Groq parsing is our answer to this.

**Ratings:** N/A (discontinued)

---

### 3. Rocket Money (formerly Truebill)
**Core philosophy:** Find and cancel subscriptions you forgot about.

**Features:**
- **Subscription detection** — scans bank statements for recurring charges, surfaces unknown subscriptions
- Negotiation service — Rocket Money will negotiate bills on your behalf (premium, takes 30–60% of savings)
- Budget tracking by category (auto-categorized from bank sync)
- Net worth tracking (connects all accounts)
- Savings "vault" — set aside money in virtual envelope
- Bill pay reminders
- Credit score monitoring (premium)

**Category model:** System-defined presets with ability to recategorize. Not fully custom.

**Recurring handling:** Identifies recurring charges automatically from transaction patterns. Shows "subscriptions" view with monthly cost estimates. Can mark as cancelled.

**Visualizations:** Spending by category donut, monthly totals bar chart, subscription cost breakdown list.

**Export:** CSV (premium only).

**UX notes:** Very clean onboarding. The subscription detection is genuinely magical. Free tier is useful without bank sync. Upsell is aggressive.

**Ratings:**
| Dimension | Score (1–5) |
|-----------|-------------|
| Simplicity | 4 |
| Kid-visibility-safe | 4 |
| Free | 3 (core free, good features paywalled) |
| Visual clarity (colorblind) | 4 (text labels on all charts) |

**Steal from Rocket Money:** Subscription/recurring expense detection surface — show a dedicated "Recurring" list distinct from one-off transactions.

---

### 4. Monarch Money
**Core philosophy:** Modern couples/family budget app — collaborative, beautiful.

**Features:**
- Multi-user (up to 2 users on standard, family plans for more)
- Bank sync with manual fallback
- Zero-based budget with rollover option
- Goal tracking (debt payoff, emergency fund, vacation)
- Net worth timeline
- Investment tracking (read-only)
- Cash flow calendar — see upcoming bills on a calendar view
- Custom reports with date range filtering
- Transaction splitting (split one transaction across multiple categories)
- "Flex spending" vs fixed expenses distinction

**Category model:** System presets + full custom with sub-categories. Hierarchical (parent category → sub-categories).

**Recurring handling:** Automatic detection of recurring patterns from bank sync. Also manual scheduling. Upcoming bills shown in cash flow calendar.

**Visualizations:** Sankey diagram (income → categories → subcategories), bar charts by month, line charts for net worth. The Sankey is visually impressive.

**Export:** CSV, PDF reports.

**UX notes:** Most polished UI of all surveyed apps. Great for partners who share finances. Overkill for solo use. Subscription is steep ($14.99/mo).

**Ratings:**
| Dimension | Score (1–5) |
|-----------|-------------|
| Simplicity | 3 |
| Kid-visibility-safe | 4 |
| Free | 1 (paid only) |
| Visual clarity (colorblind) | 4 (Sankey uses color + text labels) |

**Steal from Monarch:** Sankey-style flow chart (complex — skip for now). Cash flow calendar (bills on calendar = good idea for integration with existing Home tab calendar).

---

### 5. Copilot
**Core philosophy:** iOS-native, premium design, "Mint but beautiful and maintained."

**Features (iOS only):**
- Bank sync via Plaid
- Smart auto-categorization with learning (corrects over time)
- Budgets with "rollover" option (unused budget carries forward next month)
- Transaction review workflow (confirm/modify categorizations daily)
- "Upcoming" view — recurring transactions shown before they hit
- Custom reports and date range views
- Widgets for iOS home screen

**Category model:** Smart system presets + fully custom. Categories have colors and icons.

**Recurring handling:** Learns recurring patterns automatically, shows "Upcoming" tab with predicted future transactions and dates. One of the best recurring UX.

**Visualizations:** Spending timeline (vertical), category bars, trend chart (last 12 months per category). All charts use color + text labels.

**Export:** CSV.

**UX notes:** Considered the best-designed budget app by many iOS users. iOS-only is a dealbreaker for Android/web users. Subscription is $13/mo.

**Ratings:**
| Dimension | Score (1–5) |
|-----------|-------------|
| Simplicity | 4 |
| Kid-visibility-safe | 4 |
| Free | 1 (paid) |
| Visual clarity (colorblind) | 4 (color + text + icons) |

**Steal from Copilot:** Per-category trend lines (last 6 months per category). Rollover budget option.

---

### 6. PocketGuard
**Core philosophy:** "How much can I safely spend today?"

**Features:**
- **"In My Pocket"** — the killer feature: calculates safe-to-spend after bills, goals, necessities. Updates in real time.
- Bank sync + manual entry
- Bill tracker with due dates
- Savings goals
- Subscription tracking
- Budget categories with monthly limits
- Insights: spending patterns, overspending alerts

**Category model:** Presets with recategorize ability. Limited custom support.

**Recurring handling:** Bill tracker with manual input of due dates and amounts. "Bills" calendar view. Auto-detect from bank sync (premium).

**Visualizations:** Simple number displays (In My Pocket = big number), spending donut, monthly bar.

**Export:** CSV (premium).

**UX notes:** Focused and simple. The "safe to spend" number is genuinely useful and reduces anxiety. Free tier is quite usable. Android/web support is better than Copilot.

**Ratings:**
| Dimension | Score (1–5) |
|-----------|-------------|
| Simplicity | 5 |
| Kid-visibility-safe | 5 |
| Free | 4 |
| Visual clarity (colorblind) | 5 (number-first design, minimal color reliance) |

**Steal from PocketGuard:** "Safe to spend" prominent number — this is the **#1 feature to add**. Users want to know one thing: can I afford to spend money today?

---

## Feature Rating Summary

| Feature | Source | Priority | Complexity | Already In App |
|---------|--------|----------|------------|----------------|
| Safe to spend (daily/period) | PocketGuard | **HIGH** | Low | ❌ |
| Recurring expense scheduler | YNAB, Copilot | **HIGH** | Medium | ⚠️ partial (flag only) |
| Monthly category trend chart | All apps | **HIGH** | Low | ❌ |
| CSV export (file download) | All apps | **MEDIUM** | Low | ❌ (clipboard only) |
| Envelope budgets with rollover | YNAB, Copilot | **MEDIUM** | Medium | ⚠️ limits exist, no rollover |
| Subscription detection | Rocket Money | **LOW** | High | ❌ |
| Sankey diagram | Monarch | **LOW** | High | ❌ |
| Cash flow calendar | Monarch, Copilot | **LOW** | Medium | ❌ |
| Per-category trend lines | Copilot | **MEDIUM** | Medium | ❌ |
| Transaction split | Monarch | **LOW** | High | ❌ |

---

## Features Selected for BUD-02/03 Implementation

Based on research, implementing these 4 features (highest value, lowest complexity):

### 1. Safe to Spend (PocketGuard-inspired)
**Why:** Single most useful number for a busy co-parent. Reduces decision anxiety.  
**How:** `safeToSpend = budgetLimit - totalSpent`. Show prominently in summary card. Also show `safePerDay = safeToSpend / daysLeft`.

### 2. Recurring Expense Scheduler (YNAB-inspired)
**Why:** Alex clearly has recurring expenses (Spotify, utilities, kids' activities). The current `recurring: boolean` flag is just a label — doesn't auto-add.  
**How:** New `recurringExpenses` array in Firebase: `{id, description, amount, category, frequency, nextDate}`. On app load, auto-add any due entries and advance `nextDate`.  
**UX:** Dedicated collapsible section "Recurring Expenses" — separate from one-off transactions, matching Rocket Money's subscription view.

### 3. Monthly Trend Bar Chart (Copilot/Monarch-inspired)
**Why:** Visual spending history helps spot trends (did spending increase since the kids started school?).  
**How:** SVG bar chart, last 6 months, labeled bars (no color-only encoding — colorblind safe).

### 4. CSV Export (universal)
**Why:** Alex may want to share budget with Danyells or import into a spreadsheet.  
**How:** `Blob` + `URL.createObjectURL` download. All transactions for the current period, with headers.

---

## Colorblind Safety Notes

Alex is **deutan colorblind** (red-green). Findings from research:

- YNAB: fails — uses red/green for over/under budget with no pattern
- Mint: was moderate — mostly text-based alerts
- Rocket Money: good — text labels on all charts
- Monarch: good — Sankey has colors but hover reveals text values
- Copilot: good — always color + icon + text
- PocketGuard: excellent — number-first, color is decorative only

**Rule for our charts:** Every chart element must have a text label. Color can reinforce but never be the only signal. Use ABOVE TARGET / ON TRACK text (already implemented in existing progress bars ✓).
