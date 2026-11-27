# Issue #87 — Rotating Primary Seed: device acceptance

**Date:** 2026-11-27

**Issue:** https://github.com/evilnick26/substreamer/issues/87

**Status:** Accepted by the project owner.

## Build and acceptance approach

Release APK built successfully (4m 27s; 1,684 actionable tasks, 88 executed). Initial device smoke tests passed: launch, library/account, queue restoration, ordinary album playback, Radio Infinite enablement and refill, and no observed crash. Detailed acceptance used the optional on-device diagnostic logger implemented under #96, avoiding bridge changes and ADB dependence.

## Observed results

The project owner confirmed that enabling Radio Infinite partway through an album captured the current track as Primary Seed, that successful refills reduced lifespan, and that rotation promoted the first appended recommendation.

The first substantial diagnostic export recorded 15 successful refills (2–16), each appending ten tracks, growing the queue from 10 to 160. Four rotations occurred:

| Refill | New Primary Seed | New lifespan |
|---|---|---|
| 5 | My Life With the Thrill Kill Kult — Sexy Sucker | 4 |
| 9 | Fat Dog — All the Same | 3 |
| 12 | The Hellp — New Wave America | 4 |
| 16 | Dub Pistols feat. Seanie T. — Boom (Skgs Dub Alliance Instrumental Remix) | 4 |

Each rotation promoted the first actually appended track. Refills 17 and 18 failed during metadata resolution for the same obsolete Navidrome ID; neither appended tracks nor consumed lifespan. This exposed a pre-existing refill robustness problem, not a Primary Seed accounting defect. See #96 for investigation and #97/#98 for follow-up.

A later export showed explicit playback selection establishing The Delgados — Booker T. Jones with lifespan 5, a successful refill reducing it to 4, and three restoration events retaining the same seed and lifespan 4. Subsequent successful refills reduced it to 3 and 2. Explicit selection of 100 gecs — 757 established a new seed; disabling Radio Infinite cleared it; re-enabling captured 100 gecs — Hollywood Baby.

Queue restoration survived the reboot tests. Ordinary queue navigation is covered by implementation tests; the supplied logs do not independently prove every navigation variant. Destructive logout and same-library failover were not separately tested on device.

## Acceptance and next steps

The project owner explicitly accepted #87 as working on 2026-11-27. Missing recommendation tracks are assigned to #98, not reopened under #87. #88 remains the separate progressive fallback and exploration workstream.

Relevant implementation commits: `81fd9eff`, `7e28251f`, `4ca4fa6a`, `e4ffa280`, `c711ffc0`, `5a40fd5b`.

The issue is functionally accepted; remote issue closure and push remain administrative work. See `2026-11-26_issue-087_primary-seed-implementation.md` and `2026-11-27_issue-096_radio-infinite-diagnostics.md`.
