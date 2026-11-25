# Project Diary — PMLT recommendation filtering

**Date:** 2026-11-25
**Issue:** #091
**Related:** #077, #086, #087, #088, #094

## Objective

Improve Play More Like This (PMLT) recommendation quality
by eliminating duplicate song identities and preventing
adjacent same-artist and same-album recommendations.

## Investigation

Existing PMLT filtering deduplicated by song ID only.
Different physical recordings or releases could therefore
introduce duplicate Artist + Title combinations.

Radio Infinite already implemented conservative song
identity normalisation and artist/album adjacency rules.

PMLT creates a fresh playback queue rather than appending
recommendations to the original seed.

## Decisions

- Share song identity and adjacency helpers with Radio Infinite.
- Normalise case and whitespace only.
- Preserve meaningful title qualifiers, including Live,
  Remix and Radio Version.
- Deduplicate against the original seed by ID and identity.
- Do not apply seed adjacency to the first recommendation.
- Compare adjacency against the last accepted recommendation.
- Maintain filtering context across all fallback sources.
- Allow previously rejected adjacency candidates to be
  reconsidered if encountered again in an eligible context.
- Request twice the configured list-length target.
- Preserve existing source priority and candidate order.
- Return fewer tracks rather than relax quality filters.
- Do not introduce a shortfall toast.
- Do not inherit Radio Infinite's duration restriction
  or fixed ten-track batch limit.

## Implementation

Created:
- src/services/recommendationFilters.ts

Modified:
- src/services/radioInfiniteFilter.ts
- src/services/moreOptionsService.ts
- src/services/__tests__/moreOptionsService.test.ts
- src/i18n/locales/en.json

The existing Radio Infinite regression tests were retained
unchanged.

The English Settings description now explains that list
length is a target and fewer items may be returned to
maintain recommendation quality.

No database, server, audio metadata, native dependency
or playback pipeline changes were required.

## Automated validation

- Radio Infinite: 38/38 tests passed.
- More Options Service: 166/166 tests passed.
- Combined: 204/204 tests across Android and iOS projects.
- Twelve new PMLT regression scenarios.
- TypeScript: passed with zero errors.
- git diff --check: clean.

An initially omitted Child type import in the new tests
was corrected before final validation.

## Android build

BUILD SUCCESSFUL in 7m 56s
1684 actionable tasks:
88 executed, 1596 up-to-date.

## Android acceptance

| Scenario | Result |
| --- | --- |
| Foo Fighters seed | 20/20 |
| Nirvana seed | 20/20 |
| Humousexual seed | 20/20, sensible |
| The Young Property Developers seed | 20/20, sensible |
| R.E.M. - What's the Frequency, Kenneth? | PASS: radio version preserved |
| The Housemartins - Caravan of Love, Now 9 | PASS |
| List length set to 30 | PASS |
| Settings description | PASS |
| Radio Infinite | PASS |
| #094 instrumental gaps and outros | PASS |

All reported Android acceptance scenarios passed.

The #094 diagnostic-free implementation was also accepted,
completing the outstanding validation recorded in its
finalisation diary.

## Conclusions

Retain the initial 2x oversampling multiplier.
The tested popular and obscure artist seeds all filled
their requested queues.

No evidence currently justifies increasing the multiplier
or introducing adaptive oversampling.

## Outstanding work and limitations

- Non-English Settings descriptions retain their previous
  wording; translation updates are deferred.
- Server-side maximum recommendation request sizes have
  not been independently established.
- Acceptance testing is representative, not exhaustive.
- iOS validation is automated only; no physical iOS
  device acceptance was performed.

No outstanding functional defects identified for #091.

## Status

Implementation and Android acceptance complete.
