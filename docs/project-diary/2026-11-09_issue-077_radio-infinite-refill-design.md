# sancti.fi Client — Project Diary

**Date:** 2026-11-09
**Issue:** #077 — Radio Infinite
**Activity:** Automatic refill validation, diagnostics, and deferred refill design

## Objective and context

Validate automatic Radio Infinite queue replenishment in the Android release APK ahead of a demonstration to Dave on 2026-11-10. Preserve the working demonstration build; do not implement additional recommendation-policy changes before the visit.

## Investigation and validation

- Stage 2B automatic refill triggered with three upcoming tracks remaining (playing the fourth-from-last track). The temporary TEST RI button was removed.
- Switching from Radio Infinite to Repeat All generated no new recommendations and allowed the queue to wrap to its first track. Both behaviours passed manual testing.
- A perceived seven-song refill prompted investigation. AMA logs showed successful `POST /api/alchemy` calls but did not expose returned-song counts; AMA's 30-candidate probabilistic sampling log is **not** proof of 30 returned songs.
- Existing client implementation requests recommendations through the bridge and filters duplicate song IDs both within the returned batch and against the **entire current queue**.
- The diagnostic patch was applied and TypeScript and `git diff --check` passed. Babel had `transform-remove-console`; the release diagnostics patch configured retention of `console.info` (for all such calls, not solely Radio Infinite), allowing count-only messages to be observed with ADB Logcat. Revisit logging scope before wider Alpha release.
- Real Android release-build Logcat confirmed three consecutive refills:

  | Time (2026-11-09 UTC) | Received | Repeated within batch | Already in queue | Appended | Queue length after |
  |---|---:|---:|---:|---:|---:|
  | 17:58:45 | 10 | 0 | 0 | 10 | 108 |
  | 17:58:55 | 10 | 0 | 2 | 8 | 116 |
  | 17:59:04 | 10 | 0 | 1 | 9 | 125 |

- These logs establish that shorter refills can be caused by intentional queue-wide ID deduplication, not necessarily an AMA failure. The earlier visual count of seven songs was not conclusively explained; the user subsequently observed ten songs after the relevant track.
- **Therapy? seed retest (18:16:34 UTC):** An earlier on-device Radio Infinite request seeded from a Therapy? single had reported no recommendations. After the user ran AMA analysis on that single and repeated the test on-device, ADB Logcat reported `received: 10`, `repeatedWithinBatch: 0`, `alreadyInQueue: 0`, `eligible: 10`, followed by `requestedAppend: 10` and `queueLength: 14`. The queue page independently confirmed the appended tracks. This before-and-after result **strongly supports** missing AMA analysis of the seed tracks as the cause of the earlier failure, but does not conclusively prove it without the original server response or diagnostic evidence. Ordinary audio playback was not dependent on AMA analysis.
- Validation is foreground Android testing. Unattended transitions, background playback, and Android Auto remain to be investigated.

## Design discussion — agreed direction, **not implemented**

1. **Oversample candidates:** Ask AMA for **20** candidates per refill, filter them, then append at most **10** eligible tracks, preserving recommendation order. Twenty is a pragmatic compromise between the current ten and a proposed thirty; support for `n=20` and any bridge-side hardcoding must be verified before implementation. The AMA log's internal sampling count is not a verified API maximum.
2. **Session-wide exclusion:** Do not re-add a song already represented in the current queue/session, including another album's copy of the same recording. Check exact Navidrome song IDs and aim for recording-aware identity. The MusicBrainz **Recording** concept is the intended semantic model: a studio recording and a live recording of the same composition are **different recordings** and may both play. Investigate whether OpenSubsonic song data exposes recording MBIDs reliably; artist/title comparison may be a fallback but must not conflate distinct recordings with identical names.
3. **Shortfall policy:** Target ten appended songs; **five or more** is the proposed minimum useful refill. With three upcoming tracks at the trigger, a refill below five leaves too little margin. Record shortfalls explicitly. Explore bounded recovery when fewer than five candidates survive; do not implement unbounded retry loops.
4. **Diagnostics:** Preserve count-only visibility for requested, received, rejected by reason, eligible, and appended songs. No credentials or song IDs in logs. Existing diagnostic counters cover received, repeated-within-batch, already-in-queue, eligible, and appended.
5. **Resource cost:** In-memory sets of song IDs and recording identities are expected to be inexpensive at realistic session sizes. A hypothetical 10,000-track continuous queue is not a practical optimisation target. Candidate exhaustion and filtering quality matter more than lookup performance.

## Decisions and scope control

- **No further Radio Infinite code changes before the 2026-11-10 demonstration to Dave.** Keep the current working private APK as the demonstration baseline.
- The 20→10 approach, recording-aware exclusion, five-song shortfall threshold, and bounded recovery are **deferred design direction**, not tested or shipped functionality.
- Do not confuse implementation already validated (10 requested; queue-wide song-ID filtering; up to 10 appended) with future behaviour.

## Outstanding work (after demonstration)

- Inspect bridge and AMA request contracts to establish support and behaviour for 20 candidates; assess latency and response volume.
- Inspect Navidrome/OpenSubsonic metadata for recording MBIDs and define safe fallback identity matching, including different recordings with the same artist/title.
- Specify and test filtering order, append cap, and handling of unresolved song IDs.
- Specify bounded recovery and triggering rules for zero-to-four accepted songs, with graceful failure and no playback disruption.
- Investigate whether the bridge/AMA can distinguish **unanalysed or unavailable seed tracks** from genuine recommendation failures; expose an appropriate non-disruptive diagnostic if supported. This is deferred, not a prerequisite for the demonstration.
- Expand diagnostics to distinguish exclusion reasons and shortfalls; review release-log retention before Alpha.
- Test unattended natural transitions, background playback, Android Auto, and switching modes during in-flight requests.
- Record implementation and validation in a subsequent diary entry; do not retroactively describe deferred work as implemented.
