# sancti.fi Client — Project Diary

**Date:** 2026-11-07  
**Issue:** [#72 — Investigate Radio Infinite: continuous playback using AudioMuse-AI multi-seed recommendations](https://github.com/evilnick26/substreamer/issues/72)  
**Activity:** Live Song Alchemy API testing, continuity experiments, Navidrome plugin v12 upgrade, authenticated interface investigation, Substreamer queue inspection, and RNQP Android lifecycle investigation  
**Status:** Investigation findings consolidated; recommendation feasibility and queue-append foundations demonstrated, background lifecycle limitations identified; continuous playback not implemented or device-validated

## Objective

Establish whether AudioMuse-AI (AMA) can provide fast, musically useful multi-seed recommendations suitable for an evolving Radio Infinite session; investigate whether Navidrome's existing plugin can provide a secure integration path. No client implementation was undertaken.

## Environment

- Host: **obscurity** (Docker).
- Navidrome: **0.64.2** (`navidrome`).
- AudioMuse-AI: **3.7.1** (`audiomuse-ai-flask-app`, `audiomuse-ai-worker-instance`).
- PostgreSQL: `audiomuse-postgres`; database `audiomusedb`, role `audiomuse`.
- AMA HTTP service: container port 8000, published on host port 8001.
- Navidrome AudioMuse-AI plugin: **v10 at start of session; upgraded to v12**.
- Earlier source investigation primarily concerned AMA 3.7.0 and plugin v11; live tests here establish behaviour on the deployed versions.

## Investigation and findings

### Authentication and database identity

- Unauthenticated `POST /api/alchemy` returned **401 Unauthorized**.
- Shell environment did not expose `API_TOKEN`, but AMA Python `config` reported `AUTH_ENABLED=True` and a configured `API_TOKEN`.
- Authenticated request with `items: []` returned **400 Invalid request**, confirming authentication and route access, not recommendation success.
- Initial PostgreSQL connection using role `postgres` failed (`role "postgres" does not exist`). Container configuration identified the correct role/database.
- `score` contains song title/artist/album metadata; `embedding` references `score.item_id`; `track_server_map` maps internal `item_id` to `(server_id, provider_track_id)`.
- All three chosen seeds were found with embeddings and mappings to the same Navidrome server (`7e6cdd4686474e8fadeb9cf7d45dd462`):

| Seed | Navidrome song ID | Embedding |
|---|---|---|
| PUP — Dark Days | `0fUTSykWR6C4GbxrIAOprA` | Present |
| AM/FM — Those Long Arms | `0AzHFR7xsOh63X49q69s2A` | Present |
| The Rugburns — War | `1pN92OgRpDLs50MdaQ0Aju` | Present |

### Direct multi-seed Song Alchemy

- Authenticated `POST /api/alchemy` with three `ADD` song items, Navidrome server ID, and `n=10` returned **HTTP 200**, **10 recommendations**, in **0.73 seconds**.
- Response `add_points` identified all three supplied seeds. Other response fields included `results`, centroid/vector and projection data, exclusions, and filtered counts.
- First batch included Los Campesinos!, Harvey Danger, The Weakerthans, Belle and Sebastian, Babyshambles, Urusei Yatsura, Half Man Half Biscuit and Badly Drawn Boy. Artist/title lists are qualitative indications, not listening validation.
- A separate `n=1` response returned **MO*HO*BISH*O*PI — Fista Blista** with `item_id=32WNWWUvFcicAil4HAxEqj`. Database lookup showed its internal AMA `score.item_id` was `fp_4284fc76fb68cd7ba87f229b5891ec2597b5ae6115135725f3f`, whereas `track_server_map.provider_track_id` matched the returned `item_id` exactly. **For this tested result, AMA had already translated to the Navidrome ID.** General correctness still requires integration testing.

### Three-generation rolling-seed experiment

Procedure: request ten recommendations; choose the **last three** as the next generation's seeds; repeat for three generations. Maintain a `seen` set for observation only, without filtering recommendations.

| Generation | Latency | Recommendations | Repeats from earlier generations/seeds |
|---|---:|---:|---:|
| 1 | 0.68 s | 10 | 0 |
| 2 | 0.38 s | 10 | 1 |
| 3 | 0.30 s | 10 | 0 |
| **Total** | **1.36 s** | **30** | **1** |

- **29 distinct recommendations** plus the **three original seeds** = **32 unique IDs encountered**.
- The repeated recommendation was **The Hitchers — Strachan**, present in generations 1 and 2.
- Artist/track progression appeared plausibly coherent: broad indie/alternative in generation 1; more guitar-driven alternative rock in generation 2; The Wedding Present, Blur, The Bluetones and The Hold Steady in generation 3. **No listening-based coherence test was performed.**
- Rolling seeds are an **experimental strategy**, not a final product decision. Anchored or hybrid approaches remain possible.
- Alchemy did not automatically prevent a cross-generation repeat in this experiment. Future queue logic should track queued/played song IDs and filter or replenish recommendations as needed.

### Navidrome plugin v12 assessment

- Existing plugin was **v10**. Official upstream **v12**, published 2026-11-06, adds **DCLAP**, **Song Alchemy** as an Instant Mix source, and **Alchemy Temperature** (0–10; default 1). It retains Similar Song, Lyrics by Song and Hyperbolic Similarity.
- Source comparison and v12 `main.go` inspection established that Song Alchemy uses `POST /api/alchemy` with **one ADD seed** from `GetSimilarSongsByTrack`, not arbitrary multi-seed input. Its plugin-held API credentials provide a useful server-side security boundary for the existing single-seed flow.
- `Eliminate Duplicates` and `Use Radius Similarity` are not applicable to the plugin's Song Alchemy mode; these settings do **not** establish cross-generation deduplication.
- The direct API tests did not explicitly set `temperature`; do not assume equivalence to the plugin's explicit default of 1 without checking AMA defaults.

### Navidrome 0.64.2 authenticated dispatch and plugin interfaces (source inspection)

Examined **Navidrome v0.64.2**, matching the deployed server version, rather than relying on the development branch:

- `server/subsonic/api.go` registers `getSimilarSongs`, `getSimilarSongs2`, `getSonicSimilarTracks` and `findSonicPath` as distinct authenticated Subsonic handlers.
- `server/subsonic/browsing.go`: `GetSimilarSongs` reads a single `id` and `count`, calls `api.provider.SimilarSongs(ctx, id, count)`; `GetSimilarSongs2` delegates to it. Neither handler reads an array of seed IDs.
- `server/subsonic/sonic_similarity.go`: `GetSonicSimilarTracks` reads one `id`; `FindSonicPath` reads `startSongId` and `endSongId`. The latter expresses a path between two endpoints, **not** a multi-seed radio recommendation.
- `plugins/capabilities/metadata_agent.yaml` defines `GetSimilarSongsByTrack` as a specific-track request; `plugins/capabilities/sonic_similarity.yaml` defines one-song similarity and two-endpoint path requests. `plugins/sonic_similarity_adapter.go` builds the corresponding fixed request structures.
- `core/external/provider_similarsongs.go` **does** implement `seedMix()` for an album, artist, genre or playlist, sampling up to five tracks. However, it calls `GetSimilarSongsByTrack` **independently for each seed**, merges, deduplicates and shuffles results. This is **not** one joint multi-seed Alchemy request. The existing fallback may be useful, but it is not semantically equivalent.

**Finding:** The inspected OpenSubsonic similarity routes cannot cleanly deliver an arbitrary seed array to the v12 plugin. Extending the plugin's internal Alchemy request alone would not change the Navidrome-facing request contracts. This does **not** establish that no other extension mechanism could exist; it closes the investigated existing similarity-route approach.

**Architectural options retained for comparison, not selected:** (a) a narrow authenticated server-side Radio Infinite bridge that forwards authorised multi-seed requests to AMA and returns Navidrome song IDs; (b) a formal Navidrome/plugin multi-seed capability, with greater interoperability but higher upstream cost. Do **not** overload `FindSonicPath` or encode several IDs into a single `id` merely to reuse a route.

### Substreamer `sanctifi` branch: active queue inspection

Inspected the current `sanctifi` branch in `evilnick26/substreamer`:

- `src/services/playerService.ts` uses **react-native-queue-player (RNQP)** for native playback and Zustand `playerStore` for application-visible queue state. The dependency in `package.json` is `react-native-queue-player` **2.0.4-rc.4**.
- `playTrack(track, queue, sourcePlaylistId?)` builds playable tracks, calls `tp.setQueue(rnTracks, startIndex)` then `tp.play()`, and persists the queue. **This replaces the active queue**, so it is inappropriate for each Radio Infinite refill.
- Crucially, **`addToQueue(tracks, sourcePlaylistId?)` already exists** (approximately lines 809–846). When a queue is present, it waits for hydration and track maps, builds playable tracks, calls **`tp.addToQueue(rnTracks)`**, updates queue formats and `currentChildQueue`, updates the Zustand queue and calls `persistQueue()`. It does **not** call `setQueue()` or `play()` in the nonempty-queue branch.
- **Empty-queue caveat:** `addToQueue()` delegates to `playTrack()` if the current queue is empty, **starting playback**. A delayed Radio Infinite response after session cancellation/queue clearing must not be passed to it without a session validity guard.
- `playSongNext(song)` separately uses `tp.addToQueue(rnTracks, insertBefore)` to insert after the current track; Radio Infinite normally needs append, not insert-next.
- `queuePersistenceService.ts` records queue changes with a 1.5-second debounce and exposes an explicit flush for backgrounding. Queue hydration restores the native queue via `setQueue()` at startup; existing code also avoids overwriting an already-live car/Siri queue during restoration.
- `initPlayer()` subscribes to native `onTrackChange`, `onProgress` and `onQueueEnd` events. These are potential inputs for refill scheduling; **no Radio Infinite replenishment loop was found or implemented**.
- Existing unit tests in `src/services/__tests__/playerService.test.ts` assert that `addToQueue()` appends tracks when the queue is nonempty and starts playback when empty. **No physical-device interruption-free append test was performed in this investigation.**

**Finding:** The necessary append primitive and queue persistence already exist; likely incremental client work concerns scheduling, session validity, deduplication and lifecycle/failure handling rather than replacing the player engine.

**Provisional design direction (not yet a decision):** Replenish before the queue reaches its end, based on remaining upcoming tracks. Protect against duplicate concurrent fetches and stale responses when the user clears/replaces the queue, switches server, disables Radio Infinite or changes session. Validate that background/Android Auto operation and native queue append behave as expected on devices. Graceful degradation should leave already-queued playable tracks intact if AMA is unavailable.

### Substreamer bootstrap and headless playback (source inspection)

- `index.js` loads `src/services/playerBootstrap` before `expo-router/entry`, so player setup is not dependent on opening a particular UI screen.
- `playerBootstrap.ts` calls RNQP `getTrackPlayer().configure()` and installs the headless media service. Configured progress intervals are **500 ms foreground** and **10,000 ms background**; these intervals are not guarantees that JavaScript will remain active.
- `headlessMediaService.ts` registers RNQP playback callbacks. Its headless initialization can rehydrate persistent stores and initialize the player/scrobble listeners without mounting the UI.
- `playerService.ts` already subscribes to `tp.onTrackChange`, `tp.onProgress` and `tp.onQueueEnd`. The queue-end handler currently performs end-of-queue housekeeping, **not** Radio Infinite replenishment.
- The application attempts to preserve an already-live headless/car session during queue restoration rather than blindly replacing it.

**Inference:** Event-driven replenishment in the existing JavaScript playback service is plausible; it remains untested during prolonged screen-off playback, Android Auto use and JavaScript/process lifecycle changes.

### Installed RNQP 2.0.4-rc.4 Android implementation (read-only inspection on futwick)

Inspected the actual installed `node_modules/react-native-queue-player/android/src/main/java/com/margelo/nitro/queueplayer/` Kotlin sources. **No package or client source files were modified.**

- `TrackPlayer.kt` registers `onTrackChange` callbacks through `ListenerRegistry` and dispatches them in `handleMediaItemTransition()`, called for Media3 media-item transitions. The native player distinguishes `AUTO_ADVANCE`, `SEEK`, `QUEUE_REPLACED` and user skip reasons. Media3 repeat-one transitions are also translated to `AUTO_ADVANCE`.
- Crossfade transitions have special handling to avoid a duplicate JS-facing track-change event after the native player swap. Remote/cast track-change dispatch has separate paths; a future controller must not assume every change follows the standard local-player path.
- Native detection and callback dispatch are confirmed in source. **Delivery to a JavaScript listener when its React context is suspended or absent is not established.**
- `HeadlessJsMediaService.kt` extends `MediaLibraryService` and can create a React context and launch a headless JS task on receipt of an eligible intent. It tracks active tasks and has a bounded **10-second** partial wake lock for cold-start handoff; that wake lock is **not** a general playback or JavaScript keep-alive.
- `PlaybackService.kt` overrides `getTaskConfig()`. Its `HEADLESS_WAKE_ACTIONS` set contains exactly **`ACTION_HEADLESS_WAKE`** (controller-connection self-wake) and **`Intent.ACTION_MEDIA_BUTTON`** (OS-routed media-button intent). A headless controller connection calls `selfWakeForHeadlessClient()`; the code also handles a cold-start race while Android Auto waits for JS callbacks.
- `getTaskConfig()` avoids launching another headless task when a React context already exists. Controller self-wake is rate-limited (30 seconds), and service-start failures caused by Android background-start restrictions or security exceptions are logged.
- **Ordinary automatic track advancement is not among the two recognised headless wake intents.** This does not prove that no other lifecycle path can restore JavaScript, but the inspected mechanism does not promise a JS wake-up for every song transition.
- The user's phone already has Substreamer's battery-optimisation exemption configured. This is favourable for later testing but **does not guarantee** indefinite JS execution or immunity from OS process termination.

**Architectural assessment (provisional):** Prefer a JavaScript-side refill controller using the existing track-change events and `addToQueue()`, maintaining sufficient upcoming playable tracks to tolerate temporary JS/network unavailability. Reconcile session/queue state whenever the JS service initializes or resumes. Avoid altering RNQP's native service unless real device tests demonstrate a requirement. A native queue can continue through already-enqueued tracks, but source inspection alone cannot guarantee uninterrupted infinite replenishment after the JS runtime disappears.

**Validation limits:** This was code inspection, not a test of live screen-off or Android Auto refill. No Radio Infinite implementation, native patch, APK build or physical-device endurance test was performed.

## Implementation / operational changes

**No sancti.fi Client source changes.** On obscurity, upgraded the existing Navidrome AudioMuse-AI plugin from v10 to v12:

1. Backed up `/data/plugins/audiomuseai.ndp` as `/data/plugins/audiomuseai.ndp.bak-pre-v12-20261107`.
2. `cp -p` reported an inability to preserve root ownership, but the backup was created; a separate `cmp` confirmed it was **byte-for-byte identical**.
3. Downloaded official v12 `audiomuseai.ndp` to `/tmp/audiomuseai-v12.ndp` inside the Navidrome container.
4. Verified downloaded SHA-256 against the GitHub release asset digest:
   `da8512c4f3b2d3a58fea611e3ab36c7ad53e7ddc7c9d9b16231101ae98809ed8`.
5. Replaced `/data/plugins/audiomuseai.ndp` and verified the installed file with `cmp`.
6. Restarted Navidrome; user subsequently confirmed the v12 plugin was enabled and its new options were visible.

The backup covers the **plugin binary**, not an independent export of Navidrome's stored plugin settings. No AMA reanalysis, database modification or audio-file modification was performed.

## End-to-end validation via Navidrome

- User selected **Song Alchemy** in the v12 plugin settings (Temperature displayed as **1**) and tested **PUP — Dark Days** using Navidrome Instant Mix.
- Exported M3U contained **101 entries**: the seed plus **100 recommendations**, including Honeyrider, The Charlatans, The Spook School, The Cribs, Guided by Voices, Martha, Jeff Rosenstock, Urusei Yatsura and others.
- Paths included FLAC files across ordinary albums, compilations and splits, plus at least one MP3 from the remaining lossy library.
- This establishes that the native single-seed plugin-to-Navidrome recommendation path produced a populated playlist of library tracks. **It does not prove uninterrupted streaming playback, background replenishment, or multi-seed support through the plugin.**

## Decisions and architectural implications

- Continue to prefer standard OpenSubsonic/Navidrome interfaces when they express the needed capability; the v12 plugin is promising for **single-seed** Song Alchemy.
- **Do not embed AMA's privileged API token in the client.** Investigate a Navidrome/plugin-mediated multi-seed interface first, but do not assume the existing `GetSimilarSongsByTrack` contract can accept multiple seeds.
- Treat Radio Infinite as a **client-managed playback session**, not a persistent playlist. Box Sets and V/A Series remain separate semantic collections; no change to those decisions.
- Preserve playable queued tracks and ordinary playback if AMA becomes unavailable; recommendation enrichment must degrade gracefully.
- Keep recommendation strategy (rolling versus anchored/hybrid), queue policy and integration mechanism **provisional**. No implementation scope has been approved merely because feasibility was demonstrated.

## Outstanding work / next session

1. **Device validation (future implementation/prototype):** test track-change callback delivery, queue append and refill during prolonged screen-off playback and Android Auto; include JS-context loss/recreation and OS background restrictions where reproducible. Source inspection of bootstrap/headless/native paths is complete for this investigation.
2. Validate noninterrupting `addToQueue()` behaviour on a physical device while music is playing; include queue replacement/cancellation races and empty-queue handling.
3. Verify AMA-returned Navidrome IDs through ordinary `getSong`/client hydration, including missing or inaccessible tracks.
4. Define the minimal Radio Infinite session contract: seed selection/history, deduplication, low-watermark and batch size, request serialization, stale-response rejection, retries and stop semantics.
5. Compare an authenticated server-side bridge with a formal Navidrome/plugin multi-seed interface, using maintainability, security, deployment and interoperability as criteria. **No interface has been selected or implemented.**
6. Consider rolling versus anchored/hybrid seeds and listening-based quality tests if warranted. Avoid silently adding variants to V1.
7. Allocate separate issue numbers for distinct implementation tasks once scoped; **#72 remains investigation-only**.
8. Add this revised diary to `docs/project-diary/2026-11-07_issue-072_radio-infinite-api-testing.md`, **re-stage** it (previous staging does not include later edits), and review the staged diff. Commit/push only with explicit user approval. Issue closure remains a separate decision.

## References

- [sancti.fi Client issue #72](https://github.com/evilnick26/substreamer/issues/72)
- [Prior source-investigation comment on #72](https://github.com/evilnick26/substreamer/issues/72#issuecomment-6611396232)
- [AudioMuse-AI Navidrome plugin v12 release](https://github.com/NeptuneHub/AudioMuse-AI-NV-plugin/releases/tag/v12)
- [Upstream v10–v12 comparison](https://github.com/NeptuneHub/AudioMuse-AI-NV-plugin/compare/v10...v12)
- [Navidrome v0.64.2 Subsonic browsing handlers](https://github.com/navidrome/navidrome/blob/v0.64.2/server/subsonic/browsing.go)
- [Navidrome v0.64.2 sonic similarity handlers](https://github.com/navidrome/navidrome/blob/v0.64.2/server/subsonic/sonic_similarity.go)
- [Navidrome v0.64.2 similarity provider](https://github.com/navidrome/navidrome/blob/v0.64.2/core/external/provider_similarsongs.go)
- [Navidrome v0.64.2 plugin sonic similarity adapter](https://github.com/navidrome/navidrome/blob/v0.64.2/plugins/sonic_similarity_adapter.go)
- [sancti.fi `sanctifi` branch player service](https://github.com/evilnick26/substreamer/blob/sanctifi/src/services/playerService.ts)
- [sancti.fi queue persistence service](https://github.com/evilnick26/substreamer/blob/sanctifi/src/services/queuePersistenceService.ts)
- [sancti.fi player service tests](https://github.com/evilnick26/substreamer/blob/sanctifi/src/services/__tests__/playerService.test.ts)
- [sancti.fi player bootstrap](https://github.com/evilnick26/substreamer/blob/sanctifi/src/services/playerBootstrap.ts)
- [sancti.fi headless media service](https://github.com/evilnick26/substreamer/blob/sanctifi/src/services/headlessMediaService.ts)
- Installed RNQP `TrackPlayer.kt`, `PlaybackService.kt`, `HeadlessJsMediaService.kt` and related native sources (2.0.4-rc.4), inspected read-only on futwick.
- Live terminal outputs, M3U export and screenshots supplied during the 2026-11-07 session.
