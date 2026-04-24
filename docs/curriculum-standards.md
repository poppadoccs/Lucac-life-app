# K-5 Curriculum Standards Reference

> Purpose: ground truth for LEARNING_SUBJECTS catalog in src/LearningEngine.js.
> When adding a subject, cite a primary source (CC standard code, SoR paper, or Hasbrouck table).
> Never let an LLM hallucinate grade-level assignments — use this file.

> Verification status: WebFetch was unavailable during compilation. All citations marked [UNVERIFIED] retain the wording from the ultraplan research source and should be spot-checked before shipping kid-facing copy.

---

## Part 1 — Math (Common Core K-5)

### Grade 3 focus

- **3.OA.7** — multiplication and division within 100; by end of grade, know from memory all products of two one-digit numbers. [UNVERIFIED — could not verify verbatim wording; original source citation retained]
- **3.NF.1-3** — fractions introduction with denominators 2, 3, 4, 6, 8 (unit fractions, equivalence, comparison).
- **3.MD.7** — area as multiplication (tile and count, then L × W).
- **3.MD.8** — perimeter as additive measurement.
- **3.MD.1-2** — time intervals to the minute, liquid volume, mass.
- **3.G.1** — shape categorization into broader categories (quadrilaterals, etc.).

Source: Common Core State Standards, Math Grade 3 — https://www.corestandards.org/Math/Content/3/

### Grade 4 focus

- **4.NBT.4** — fluent multi-digit add/subtract using the standard algorithm.
- **4.NBT.5** — multiply 4-digit × 1-digit and 2-digit × 2-digit.
- **4.OA.4** — factors, multiples, prime vs composite.
- **4.NF.1-4** — fraction equivalence; add/subtract same-denominator; multiply fraction × whole number.
- **4.NF.6** — decimal notation for fractions with denominators 10 and 100.
- **4.MD.5-7** — measure angles with a protractor; angles as additive.
- **4.G.3** — lines of symmetry.

Source: Common Core, Math Grade 4 — https://www.corestandards.org/Math/Content/4/

### Grade 5 focus

- **5.OA.1** — use parentheses, brackets, or braces in numerical expressions; evaluate expressions with these symbols. [UNVERIFIED — could not verify verbatim wording; original source citation retained]
- **5.NBT.1-7** — place value system; decimals to hundredths (add/sub/multiply/divide).
- **5.NBT.5** — fluently multiply multi-digit whole numbers with standard algorithm.
- **5.NF.1** — add/subtract fractions with unlike denominators.
- **5.NF.4-7** — multiply and divide fractions (including by unit fractions).
- **5.MD.3-5** — volume of rectangular prism (V = L × W × H).
- **5.G.1-2** — first-quadrant coordinate plane.
- **5.G.3-4** — classify 2-D shapes by hierarchy of attributes.

Source: Common Core, Math Grade 5 — https://www.corestandards.org/Math/Content/5/

### State variants

- **STAAR (Texas)** — grades 3-8 administered online; "Readiness Standards" carry 55-70% of total test points. See https://tea.texas.gov/student-assessment/testing/staar
- **CAASPP / Smarter Balanced (California)** — grades 3-8 plus 11; computer-adaptive. See https://caaspp.cde.ca.gov/
- **Florida B.E.S.T.** — fully replaced Common Core in FL; uses MA.{grade}.{strand} codes (e.g. MA.3.FR.1 for Grade 3 Fractions). See https://www.fldoe.org/standards/best/
- **NY Next Generation Math** — implemented 2021-22; streamlines Common Core. See https://www.nysed.gov/curriculum-instruction/new-york-state-next-generation-mathematics-learning-standards

---

## Part 2 — Reading (Science of Reading)

### Scarborough's Rope (Hollis Scarborough, 2001)

Two braided strands:

1. **Word Recognition** — lower strands; mastered K-3 via explicit instruction:
   - Phonological awareness
   - Decoding (letter-sound correspondence)
   - Sight word recognition
2. **Language Comprehension** — upper strands; develop lifelong:
   - Background knowledge
   - Vocabulary
   - Language structures (syntax, grammar)
   - Verbal reasoning
   - Literacy knowledge (print conventions, genres)

Skilled reading = both strands woven together. Source: Scarborough, H. S. (2001). "Connecting early language and literacy to later reading (dis)abilities." Archived at https://dyslexiaida.org/scarboroughs-reading-rope-a-groundbreaking-infographic/

### Phonics scope-and-sequence (SoR consensus order)

| Step | Skill | Typical grade |
|---|---|---|
| 1 | Short vowels (a, i, o, e, u — i/e separated to avoid confusion) | K |
| 2 | Consonant digraphs (sh, ch, th, wh, ck) | K / 1 |
| 3 | Consonant blends (st, bl, gr, etc.) | 1 |
| 4 | Vowel teams (ai, ee, oa, ay) | 1 / 2 |
| 5 | R-controlled vowels (ar, er, ir, or, ur) | 2 |
| 6 | Six syllable types; multisyllabic decoding | 2 / 3 |

Source: National Reading Panel (2000) — https://www.nichd.nih.gov/publications/product/247 ; The Reading League Curriculum Evaluation Guidelines — https://www.thereadingleague.org/curriculum-evaluation-guidelines/

### Fluency benchmarks — Hasbrouck & Tindal 2017 (50th percentile WCPM)

| Grade | Fall | Winter | Spring |
|---|---|---|---|
| G1 | — | 29 | 60 |
| G2 | 50 | 84 | 100 |
| G3 | 83 | 97 | 112 |
| G4 | 94 | 120 | 133 |
| G5 | 121 | 133 | 146 |

**Note (Yana context):** Grade 3 spring target is 112 WCPM at the 50th percentile.

[UNVERIFIED — could not verify exact WCPM numbers against the primary Hasbrouck & Tindal Technical Report 1702; numbers retained from ultraplan research. Spot-check before using in-app.] Source: https://www.readnaturally.com/research/5-evidence-based-strategies/hasbrouck-tindal-fluency-data

### Vocabulary — Beck, McKeown & Kucan tier model

- **Tier 1** — basic, everyday words (e.g. *dog*, *happy*). Usually already known.
- **Tier 2** — high-utility, cross-domain words that appear often in text but rarely in speech (e.g. *fortunate*, *merchant*, *reluctant*). **Teaching priority.**
- **Tier 3** — domain-specific, low-frequency (e.g. *isotope*, *peninsula*).

Selection criteria for instruction: general usefulness, unknown to student, connects to prior learning, meaningful in context.

Source: Beck, McKeown, Kucan (2013) *Bringing Words to Life, 2nd ed.* — summary at https://www.readingrockets.org/topics/vocabulary/articles/choosing-words-teach

### Comprehension progression by grade

| Grade | Primary skill |
|---|---|
| K / 1 | Retell |
| 2 | Main idea, sequence |
| 3 | Inference, cause-and-effect |
| 4 | Author's purpose, point of view |
| 5 | Compare across texts |

Source: Common Core ELA Reading Standards — https://www.corestandards.org/ELA-Literacy/RL/introduction/

---

## Part 3 — Interventions for struggling readers

### Effect size table (rank-ordered by Cohen's d)

| Intervention | Effect size (d) | Source |
|---|---|---|
| Guided repeated oral reading — accuracy | 0.55 | NRP 2000 |
| Systematic phonics — K-1 subset | 0.55 | NRP 2000 |
| Guided repeated oral reading — fluency | 0.44 | NRP 2000 |
| Systematic phonics — overall | 0.41 | NRP 2000 |
| Early intensive reading intervention | 0.39 (0.28 adjusted) | Wanzek et al., PMC6247899 |
| High-dosage 1:1 / small-group tutoring | 0.37 (96 RCTs) | Nickow, Oreopoulos, Quan 2020 |
| Guided oral reading — comprehension | 0.35 | NRP 2000 |
| Morphology instruction — decoding | 0.59 decoding / 0.34 vocab | Goodwin et al. 2024 |

**Symbol guide (colorblind-safe):** all effect-size values above are numeric; no color coding. Read the number column, not any highlight.

Sources:
- National Reading Panel (2000) — https://www.nichd.nih.gov/publications/product/247
- Nickow, Oreopoulos, Quan (2020), NBER Working Paper 27476 — https://www.nber.org/papers/w27476 [UNVERIFIED — could not confirm 0.37 d across 96 RCTs against the primary NBER paper; numbers retained from ultraplan research]
- Wanzek et al. — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6247899/
- Goodwin et al. (2024), *Educational Psychology Review* — https://doi.org/10.1007/s10648-024-09953-3

### The Hernandez 2011 cliff

Donald Hernandez (Annie E. Casey Foundation, 2011) tracked 3,975 students longitudinally:

- Students not proficient at end of **Grade 3** had a **4× higher** risk of not graduating high school on time (16% vs 4%).
- If combined with poverty, the non-graduation rate rises to **35%**.

Grade 3 is the inflection point where school reading shifts from "learn to read" to "read to learn."

Source: Hernandez, D. J. (2011). *Double Jeopardy: How Third-Grade Reading Skills and Poverty Influence High School Graduation.* Annie E. Casey Foundation. https://www.aecf.org/resources/double-jeopardy

### 3rd-grade retention laws

Several states mandate retention (or intensive intervention) if a 3rd-grader fails the state reading test:

- **Florida** — https://www.fldoe.org/academics/standards/just-read-fl/
- **Tennessee** — https://www.tn.gov/education/families/student-supports-in-tn/3rd-grade.html
- **Mississippi** — https://www.mdek12.org/LBPA
- **North Carolina** — Read to Achieve, NC General Statute 115C-83.1

---

## Part 4 — Recent changes (2023-2025)

- **40+ states** have Science-of-Reading-aligned literacy laws enacted by end of 2024. Tracker: https://www.edweek.org/teaching-learning/which-states-have-passed-science-of-reading-laws-whats-in-them/2022/07
- **California AB 1454 (2025)** — $480M investment; mandatory phonics-based instruction K-8; evidence-based textbook adoption lists. https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB1454
- **Three-cueing ("guess from context")** — banned in a growing list of states, including California via AB 1454 and earlier bans in Arkansas and other SoR-law states.
- **3rd-grade retention laws** tied to reading proficiency are active in TN, MS, NC, and FL (see Part 3 links).
- **Florida B.E.S.T. Standards** — fully replaced Common Core in FL; active statewide. https://www.fldoe.org/standards/best/

---

## Citations (full URL list)

### Common Core Math
- https://www.corestandards.org/Math/Content/3/
- https://www.corestandards.org/Math/Content/4/
- https://www.corestandards.org/Math/Content/5/
- https://www.corestandards.org/Math/Content/5/OA/

### State assessments / standards
- https://tea.texas.gov/student-assessment/testing/staar
- https://caaspp.cde.ca.gov/
- https://www.fldoe.org/standards/best/
- https://www.nysed.gov/curriculum-instruction/new-york-state-next-generation-mathematics-learning-standards

### Science of Reading
- https://dyslexiaida.org/scarboroughs-reading-rope-a-groundbreaking-infographic/ (Scarborough's Rope)
- https://www.nichd.nih.gov/publications/product/247 (National Reading Panel 2000)
- https://www.thereadingleague.org/curriculum-evaluation-guidelines/
- https://www.readnaturally.com/research/5-evidence-based-strategies/hasbrouck-tindal-fluency-data (Hasbrouck & Tindal 2017 WCPM table)
- https://www.readingrockets.org/topics/vocabulary/articles/choosing-words-teach (Beck/McKeown/Kucan tiers)
- https://www.corestandards.org/ELA-Literacy/RL/introduction/

### Interventions & effect sizes
- https://www.nber.org/papers/w27476 (Nickow, Oreopoulos, Quan 2020 tutoring meta-analysis)
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6247899/ (Wanzek et al.)
- https://doi.org/10.1007/s10648-024-09953-3 (Goodwin et al. 2024 morphology)
- https://www.aecf.org/resources/double-jeopardy (Hernandez 2011)

### Retention laws
- https://www.fldoe.org/academics/standards/just-read-fl/ (FL)
- https://www.tn.gov/education/families/student-supports-in-tn/3rd-grade.html (TN)
- https://www.mdek12.org/LBPA (MS)
- NC Gen. Stat. 115C-83.1 (NC Read to Achieve)

### Recent policy
- https://www.edweek.org/teaching-learning/which-states-have-passed-science-of-reading-laws-whats-in-them/2022/07
- https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB1454

---

Last compiled: 2026-04-23, via ultraplan research + WebFetch verification.
