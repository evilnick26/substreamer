# sancti.fi Client — Project Diary
## 20 October 2026 — Issue #011: Artwork-derived global accent

**Outcome:** Completed, validated and committed. Commit `f87922ad` on branch `sanctifi`: `feat(theme): add artwork-derived global accent colour (#011)`. Working tree clean after commit.

### Investigation and decisions
- Confirmed the existing Now Playing Screen (NPS) gradient consumes `palette[theme].primary` and that native palette extraction provides distinct Light/Dark variants with contrast constraints.
- Identified the risk of showing a previous album's cached artwork URI after a track change. Chose identity-safe resolution before introducing the global accent.
- Chose a shared URI-keyed palette extraction service with caching and concurrent-request deduplication, reused by the NPS gradient and the global accent. Kept the existing NPS gradient independent and unchanged in presentation.
- Chose to retain the previous **valid** accent while the next cover is resolving, without falsifying its artwork provenance. Once the next palette is available, switch immediately: no Blue flash, artificial delay or crossfade.
- Kept default Blue as the initial and genuine fallback. Existing static accent settings remain available.

### Implementation and validation chronology
1. **Stage 1 — artwork URI identity:** Added identity-safe artwork URI resolution and three regression scenarios. Initial targeted validation: 44 passing tests across Android and iOS.
2. **Stage 2 — shared palette service:** Implemented URI-keyed completed-result caching and in-flight deduplication. Tests initially exposed cache isolation and URI-transition expectation problems (42/52 passing); corrected the tests to match shared-cache isolation and the new URI policy. Final Stage 2 result: 52/52 passing, TypeScript and whitespace checks clean.
3. **Stage 3 — on-device acceptance:** Confirmed global accent updates across the app and fixed earlier off-by-one artwork behaviour. Found brief Blue flashes during transitions.
4. **Stage 3A — transition refinement:** Implemented last-good accent retention and seven policy regression tests. Targeted validation: 66/66 passing across Android and iOS; TypeScript and whitespace checks clean.
5. **Stage 3B — visual acceptance:** Built and tested Android client in Light and Dark themes with contrasting artwork. Confirmed immediate colour changes and preserved NPS gradient.
6. **Streaming stress test:** Rapid skipping among Navidrome-backed tracks passed without visible colour-transition failures; downloaded-track tests had already passed.
7. **Final regression and commit:** Full test run: 616 suites passed, 2 skipped; 10,854 tests passed, 8 skipped; zero failures. Reviewed and committed 15 files (+467/−16) as `f87922ad`. Clean working tree.

### Follow-up identified — separate issue, not part of #011
Essentially monochromatic album artwork (observed with Porridge Radio, *Clouds in the Sky They Will Always Be There for Me*) falls back to the default Blue accent. Prefer **contrast-safe neutral accents** for genuinely monochromatic covers, with one suitable result per Light/Dark theme. Preserve meaningful subtle chromatic information (sepia, olive, warm grey); do not treat every low-saturation image as monochromatic. Investigate how native extraction distinguishes no usable chromatic palette from missing artwork or decoding/extraction failure. Do not alter the existing NPS gradient as a side effect.

**Status of follow-up:** Proposed; issue number not assigned. Do not reopen or amend #011 solely for this refinement.

### Carry-forward state
- #011 complete and committed: `f87922ad`.
- No pending code changes for #011.
- Next action: log/triage the monochromatic-artwork fallback as a separate issue when ready.

*Source: contemporaneous raw entries in `ProjectDiary-20-October.txt`, consolidated without discarding the original chronological record.*
