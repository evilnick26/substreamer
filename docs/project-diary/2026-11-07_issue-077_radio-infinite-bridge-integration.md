# sancti.fi Client — Project Diary

**Date:** 2026-11-07
**Issue:** [#77 — Radio Infinite](https://github.com/evilnick26/substreamer/issues/77)
**Activity:** Stage 2 — server-side recommendation bridge, authentication, and end-to-end verification
**Status:** Bridge proof of concept working on `obscurity`; public routing, hardening, and client queue integration outstanding.

## Objective

Enable an individual Navidrome listener to obtain multi-seed AudioMuse-AI (AMA) Song Alchemy recommendations without exposing AMA's privileged machine-to-machine API token to the sancti.fi Client. Keep the bridge narrowly scoped, stateless, independent of the Requests subsystem, and compatible with standard Navidrome/OpenSubsonic playback.

## Investigation and findings

- Reused Issue #72's AMA 3.7.1 API investigation: `POST /api/alchemy` supports `items` with `op: ADD` or `SUBTRACT`, `type: song`, provider song IDs, `n`, and server selection. Three ADD seeds and `n=10` were previously proven to work.
- Inspected deployed `/app/app_alchemy.py` handler (lines 148–310). AMA canonicalizes incoming provider song IDs and translates results back to the selected server's provider IDs. Its response includes much more than the bridge needs; the bridge extracts `results[*].item_id`.
- Inspected `/app/app_auth.py` (lines 665–735): AMA accepts `Authorization: Bearer <API_TOKEN>`; a valid token is admin-equivalent. Unauthenticated `/api/` requests receive JSON unauthorized responses.
- AMA's token was not visible in Docker's configured environment, but importing `/app/config.py` with `/usr/bin/python3` confirmed a configured value. The existing actual token was already recorded in the Book of Knowledge. **No token was printed or changed.**
- The bridge is hosted at `/home/evilnick/docker/sanctifi-radio` on `obscurity`, with container `sanctifi-radio` attached to external Docker network `sanctifi`. Its port 8000 is exposed only to the Docker network, not published on the host. Caddy routing has **not** been configured.
- `obscurity` is a deployment host **without Git**; `.gitignore` is useful for future source transfer but does not currently protect secrets there.

## Decisions

- Preserve the existing Docker Compose filename `docker-compose.yml`, existing internal `NAVIDROME_URL` and `AMA_URL`, and current network/port arrangement.
- Store AMA credentials locally in `.env` (mode 600), with `.env.example` documenting `AMA_API_TOKEN` and `.dockerignore` excluding `.env` and `.env.*` from build context. Compose uses `${AMA_API_TOKEN:?AMA_API_TOKEN must be configured}`. Do not print resolved `docker compose config` output because it contains secrets; use `docker compose config --quiet`.
- Keep the privileged AMA token server-side only. Do not proxy arbitrary AMA operations.
- Initial bridge request contract: exactly three positive song seeds, request ten results, return only Navidrome song IDs. Fixed AMA server ID `7e6cdd4686474e8fadeb9cf7d45dd462` for this sancti.fi-specific implementation.
- Use OpenSubsonic salted-token listener authentication for the initial bridge implementation; Substreamer SDK's actual legacy `u/p=enc:` credential compatibility must be addressed before client integration.
- **Deferred:** optional session-local skipped-track feedback as `SUBTRACT` items. This is ephemeral to a Radio Infinite session, not a persistent preference, rating, or editorial fact. Skips are not automatically equivalent to dislike. No V1 implementation.

## Implementation on `obscurity`

- `app/main.py`: retained `GET /radio/health`; added `POST /radio/recommendations` with Pydantic request model (`username`, `token`, `salt`, exactly three `seed_ids`), listener authentication before recommendation generation, and generic HTTP error responses (401 for rejected credentials, 503 for authentication-service unavailability, 422 for invalid seeds, 502 for AMA failure).
- `app/auth.py`: existing asynchronous `authenticate_listener()` calls Navidrome `POST /rest/getUser.view` and verifies the returned username; unchanged during this phase.
- `app/alchemy.py`: new asynchronous `get_recommendations(seed_ids)` calling AMA `/api/alchemy` with three `ADD` song items, `n=10`, the selected server ID, and Bearer token; returns `results[*].item_id` as strings. Rejects missing token and malformed upstream results.
- `docker-compose.yml`: added `AMA_API_TOKEN` environment interpolation; retained internal-only networking.
- `.env.example`, `.env`, `.gitignore`: created; `.env` populated locally from the BoK and restricted to mode 600. Existing `.dockerignore` already excluded secrets.
- Temporary local verification scripts: `/tmp/radio-e2e-test.py` and `/tmp/radio-verify-ids.py` on host, copied to `/tmp/` inside bridge container. These are test utilities, not application code.

## Validation and observed results

1. Earlier bridge tests: correct `nonadmin` Navidrome credentials accepted; incorrect password rejected; simulated Navidrome outage rejected. These were helper-level tests, not yet endpoint-level failure tests.
2. `app/alchemy.py` and `app/main.py` passed `ast.parse()` syntax checks. This is syntax validation, not comprehensive test coverage.
3. `docker compose config --quiet`: **VALID**; no secret printed.
4. `docker compose build sanctifi-radio`: **successful**, image `sanctifi-radio-sanctifi-radio:latest`. Compose warned that the buildx plugin was absent and successfully used the classic builder.
5. `docker compose up -d --no-deps --no-build --force-recreate sanctifi-radio`: bridge container recreated; Navidrome, AMA and Caddy not recreated.
6. Inside-container health check: HTTP **200**, `{"status":"ok","service":"sanctifi-radio"}`.
7. Inside-container presence check: `AMA token available: True` (value not printed).
8. Authenticated end-to-end `POST /radio/recommendations` as `nonadmin`, with the three Issue #72 seed IDs: HTTP **200**, **10 recommendations** returned.
9. Independently queried Navidrome `/rest/getSong.view` for all ten recommended IDs as the same non-admin listener: **10/10 PASS**, no failures. Resolved tracks:

   1. The Lucksmiths — Fear of Rollercoasters
   2. The Dead Shores — My Band's Better Than Your Band!
   3. Belle and Sebastian — The Boy With the Arab Strap
   4. Guided by Voices — My Impression Now
   5. Cursive — A Disruption in Our Lines of Influence
   6. Harvey Danger — Terminal Annex
   7. Butcher Boy — Profit in Your Poetry
   8. Los Campesinos! — Hung Empty
   9. MO*HO*BISH*O*PI — Fista Blista
   10. The Hitchers — Strachan

The musical neighbourhood was consistent with familiar recommendations from the same seeds, a useful qualitative sanity check rather than a formal relevance test. `getSong` resolution demonstrates accessible song metadata, **not yet successful audio streaming**.

## Remaining work — prioritised

### Required before public/client use

1. **Endpoint failure-path tests:** invalid/missing listener credentials, unavailable Navidrome, missing AMA token, AMA 401/timeout/error, malformed seed IDs and malformed AMA responses. Verify that no upstream request occurs for unauthenticated callers and that no secrets leak into responses or logs.
2. **Credential compatibility:** inspect actual Substreamer/OpenSubsonic SDK authentication parameters; implement and test the required supported form(s), including legacy `u/p=enc:` if used, without weakening identity verification.
3. **Bridge hardening:** validate individual seed strings and sensible request sizes; assess duplicate seeds, response deduplication, limits/timeouts, failure handling, and avoid exposing internal diagnostics. Confirm that `server_id` is accepted as intended. Consider basic rate limiting before Internet exposure because AMA Bearer credentials have admin-equivalent privileges.
4. **Caddy HTTPS routing:** expose only intended `/radio/*` endpoints; verify TLS, routing, error handling, and no secret leakage. Keep the bridge otherwise internal.
5. **Client integration:** use the existing Radio Infinite mode, choose three appropriate recent queue-tail seeds, request ten results, append via Substreamer queue APIs, deduplicate across generations, trigger at a low-watermark of three remaining, serialize refills, and guard against stale responses, mode changes, replaced/empty queues, and accidental playback initiation.
6. **On-device acceptance:** verify natural track completion and queue continuity, network outages/graceful degradation, app backgrounding/Android lifecycle and Android Auto; test actual stream playback. Do not assume the JS context stays alive when native playback advances.
7. **Documentation and source management:** transfer reviewed bridge source and a **sanitized** deployment example into version-controlled project storage, without `.env` or credentials; update GitHub Issue #77 and commit relevant diary entries. The current bridge source exists only on `obscurity` unless separately copied.

### Deferred, not part of current implementation

- Session-local `SUBTRACT` seeds from selected skips; distinguish skipping a song from disliking it, and discard feedback when the Radio Infinite session ends.
- Additional recommendation tuning, richer client-side explanation, and other UX enhancements unless testing shows they are essential.

## Next-session starting point

Start with **endpoint-level negative authentication testing** against the running internal bridge, one safe test at a time. Then investigate Substreamer's actual credential format. Avoid modifying Caddy until authentication and error paths are verified. Do not repeat AMA source discovery or regenerate its existing token.

## References and session cautions

- [GitHub Issue #77](https://github.com/evilnick26/substreamer/issues/77)
- `2026-11-07_issue-077_radio-infinite-stage-1.md` — earlier same-day client repeat-mode foundation; Stage 1 accepted on Android, with unrelated `app.json` modification excluded from that work.
- `2026-11-07_issue-072_radio-infinite-api-testing.md` — separate Issue #72 investigation and original multi-seed API test.
- No new Git commit or GitHub issue update is claimed in this diary entry. Deployment and end-to-end tests were performed on `obscurity`; further source-control actions remain outstanding.
