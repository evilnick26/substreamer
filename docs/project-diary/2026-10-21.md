# sancti.fi Client — Project Diary
## 21 October 2026 — #011 follow-up observations and scope decision

**Outcome:** No code changes. Issue #011 remains completed in commit `f87922ad`. New observations documented and further work deferred in favour of higher-value client functionality.

### Artwork extraction observations
Further on-device testing explored black-and-white and nearly monochromatic album artwork. Some covers fell back to default Blue; others produced muted colours reflecting subtle tints in the source image. Examples included:

| Artwork | Observed behaviour |
| --- | --- |
| The Delgados — *Singles, B-Sides & Rarities* | Blue fallback |
| Travis — *12 Memories* | Blue fallback |
| Mammoth Penguins — *Here* | Blue fallback |
| Wolf Girl — *Every Now and Then* | Muted blue-violet accent |
| Hugo Tek — *No More Hi-Fi* | Muted reddish-brown accent |
| ME REX — *Pterodactyl EP* | Very dark navy accent; possible visibility concern |
| Cinerama — *Seven Wonders of the World* | Blue fallback |
| The Magic Numbers — *Outsiders* | Muted purple accent |
| Billie Eilish — *When We All Fall Asleep, Where Do We Go?* | Muted reddish-brown accent |
| Mount Eerie — *Worried Noodles* | Blue fallback |

These are visual observations, not proof of the extractor's internal classification. Preserve meaningful chromatic information, even when faint; only genuinely achromatic artwork should receive a contrast-safe neutral accent. Keep Light and Dark theme variants distinct. Distinguish successful achromatic analysis from unavailable artwork and extraction failure before implementing a new fallback. Retain screenshots as future regression references.

### Uncached Navidrome artwork transition
A limitation was reproduced when rapidly skipping to Navidrome-only tracks whose artwork had not previously been cached. The new album artwork was already visible while the global accent briefly flashed default Blue; the correct accent subsequently appeared. Earlier stress testing likely reused cached artwork and did not expose this path. The precise state transition/root cause remains unverified. The committed implementation and test results are not retroactively changed by this observation.

**Desired eventual behaviour:** Retain the previous valid accent until the destination artwork palette is available, without a temporary Blue flash. Test with genuinely uncached remote artwork and distinguish this from monochromatic fallback.

### Possible palette prefetching
Substreamer's Sound & Playback settings show an option to cache upcoming tracks (three tracks in the observed configuration). This appears to concern playback audio; it does **not** establish that artwork or palettes are prefetched. Future investigation could determine whether queue lookahead can prepare artwork palettes through the existing shared URI-keyed service. This is an optimisation, not a prerequisite for correct fallback behaviour, and must not be coupled to the audio-cache setting without justification.

### Scope and priority decision
The Merciless Despot prioritises **value delivered relative to development cost**. #011 already supplies useful working functionality; further polish offers less value at this stage than adding semantic library capabilities such as **Box Sets**, which also establish foundations for V/A Series navigation and later dynamic playlist filtering.

**Decision:** Leave #011 closed and committed. Record the following as deferred follow-ups, not current implementation tasks:

1. Contrast-safe neutral accents for genuinely monochromatic artwork, preserving subtle real colour.
2. Brief default-Blue flash when rapidly skipping to previously uncached Navidrome artwork.
3. Potential queue-based artwork-palette prefetching, subject to source investigation and demonstrated value.

The Blue flash is a known minor UX defect; the neutral fallback is a design refinement; prefetching is an optional optimisation. Reassess if a limitation becomes release-blocking. Do not silently expand V1 scope.

### Carry-forward
- #011 remains complete: `f87922ad`; full suite at commit: 616 suites and 10,854 tests passed, zero failures.
- No changes to code or Git history made during today's discussion.
- Next development priority: higher-value semantic library functionality, particularly Box Sets.
- Project Diary storage convention: consolidated daily Markdown under `docs/project-diary/`, versioned in Git; raw notes preserved separately.
