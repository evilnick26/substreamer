# sancti.fi Client — Product Decisions

This document records deliberate product-scope decisions, including features we have explicitly rejected. It complements GitHub Issues (actionable work) and the Project Diary (investigations and historical context).

Decisions are not immutable, but should only be revisited when new requirements or substantive evidence justify doing so. A NO-DO is not a deferred implementation task.

## Decision classifications

- **NO-DO:** Explicitly excluded from the product's intended scope.
- **NOT PLANNED:** No present intention to implement; could be reconsidered if a compelling need arises.
- **COVERED:** Already addressed by existing functionality or a separate sancti.fi issue; do not duplicate.
- **BACKLOG:** Useful work worth tracking separately, without implying an Alpha/V1 commitment.

## Decisions — 2026-10-24 (upstream Substreamer issue review)

| Capability | Classification | Decision and rationale | References |
| --- | --- | --- | --- |
| Filesystem/folder-based library browsing | **NO-DO** | sancti.fi relies on curated, accurate audio tags and semantic navigation. Filesystem paths are not an alternative library taxonomy for this client. | [Upstream #34](https://github.com/ghenry22/substreamer/issues/34) |
| Audiobook-specific browsing and support | **NO-DO** | sancti.fi is a music client. Its small amount of spoken-word content (e.g. stand-up comedy) does not justify audiobook functionality. | [Upstream #277](https://github.com/ghenry22/substreamer/issues/277) |
| Podcast-specific management and support | **NO-DO** | Podcast handling is outside sancti.fi's music-focused scope; do not expand into a general audio application. | [Upstream #322](https://github.com/ghenry22/substreamer/issues/322) |
| Numerical song ratings / direct rating on Now Playing | **NOT PLANNED** | Product preference is strongly against numerical ratings. Existing favourites and the proposed Shelf experience are more appropriate. Revisit only if a genuinely compelling use case arises. | [Upstream #53](https://github.com/ghenry22/substreamer/issues/53), [sancti.fi #30](https://github.com/evilnick26/substreamer/issues/30) |
| Generic upstream alternative-app-store distribution request | **COVERED** | sancti.fi has its own planned APK distribution and update discovery system; no additional work should be imported merely to match the upstream request. | [Upstream #50](https://github.com/ghenry22/substreamer/issues/50), [sancti.fi #20](https://github.com/evilnick26/substreamer/issues/20) |
| Playback queue reordering | **BACKLOG** | Current sancti.fi build appears not to allow rearranging the active queue after creation. Useful independently and potentially reusable by Puff, Puff, Pass. Investigate before implementation; changes should affect the current queue, not silently rewrite saved playlists. Not automatically Alpha scope. | [Upstream #160](https://github.com/ghenry22/substreamer/issues/160), [#316](https://github.com/ghenry22/substreamer/issues/316), [sancti.fi #8](https://github.com/evilnick26/substreamer/issues/8) |

## Standing scope principles

- Prioritise meaningful musical metadata and first-class semantic collections over directory-based presentation.
- Box Sets and V/A Album Series are **not playlists**; they are distinct semantic collections.
- Focus on music; do not pursue generic everything-player feature parity.
- Preserve conventional audio-file compatibility and standard OpenSubsonic interoperability wherever practical.
- Keep per-user favourites distinct from shared editorial and curatorial knowledge.

## Maintenance

Record substantive changes as dated additions or amendments with rationale and links to related issues. Do not silently rewrite historical decisions. Investigations that result in a NO-DO may have their own issue and Project Diary entry; a rejected feature alone does not need an issue.
