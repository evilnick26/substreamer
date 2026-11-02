# 2026-11-02 — Issue #067: Simplify Android versionCode allocation

## Context
Issue #065 passed 11,514 local Jest tests but its new APK/device acceptance is blocked by cumbersome allocation. The existing `80000191` reservation has an attempt marker and a staged APK from 2026-11-01, so its code must not be reused. `allocate --history ... --dry-run` rejected the 2026-11-01 history on 2026-11-02; its 24-hour freshness requirement is likely the cause, although the combined error message does not prove it is the only failing field.

## Investigation
- Read the current `sanctifi` branch `scripts/android-release.js`, particularly `allocationEvidence`, `allocate`, `synchronise`, and `preflight`.
- The existing code already maintains one private registry, durable reservations, an exclusive preparation lock, ledger consistency checks, APK signature/hash inspection, collision detection and immutable staging. No new allocator should be introduced.
- `allocationEvidence` requires a manually supplied, fresh, complete Futwick/server inventory. There is no collector command. `allocate` and `synchronise` are separate manual operations.
- Read `docs/android-release-publishing.md`, especially **Initial reconciliation versus routine evidence collection**. This already specifies a planned Phase 2 automated collector using the approved historical baseline, local archives, complete remote inventory, verified manifests, retained evidence and fail-closed behaviour. The issue should implement that existing design rather than invent a competing scheme.
- The documentation explicitly states that actual authenticated server read access, exact commands, complete archive scope and single allocation authority require investigation/owner confirmation. The current JSON `sources` strings are not authenticated proof.

## Decisions
1. Keep the existing exclusive allocator and the no-reuse rule for attempted codes.
2. Prefer automating evidence collection and refresh through the same CLI, then simplifying the operator entry point; keep publication separate.
3. Do not fake freshness by changing `checkedAt`, infer remote state from a manifest alone, or bypass release checks.
4. Treat missing remote inspection details as an implementation dependency; do not invent SSH commands or credentials.

## Implementation
Created branch `issue-067-simplify-versioncode-allocation` from remote `sanctifi`. No functional code changes, reservations, builds or remote publication during this investigation.

## Validation
Read-only GitHub inspection of the source and documentation. No local Futwick runtime or Obscurity server access was available in this session, so no end-to-end collector validation is claimed.

## Outstanding
- Confirm the actual approved read-only Obscurity inventory mechanism, scope and exclusive publisher assumption.
- Implement and test the collector against mocked/local fixtures, including stale, partial, conflicting, offline and concurrent states.
- Expose concise allocation preview/approval and synchronisation without manual history editing.
- Validate on Futwick before any live allocation; keep Issue #065 device acceptance pending.

## Server read-only access observation
Owner ran `ssh evilnick@sancti.fi` from Futwick and successfully listed `/opt/updates-site/client/apks/` and `/opt/updates-site/client/*.json` without sudo. Six APK filenames were present (`80000186`–`80000191`); `alpha.json` and four historical Alpha backup manifests were listed. File listing alone does not verify checksums, manifest contents, remote reservations, or exclusivity. Next investigation: inspect SHA-256 of server APKs and current manifest read-only, then determine whether any server-side independent allocation process exists.

## Remote SHA-256 and Alpha manifest observation
Owner ran read-only `sha256sum /opt/updates-site/client/apks/*.apk` and `cat /opt/updates-site/client/alpha.json` over SSH from Futwick. Observed SHA-256 values: `80000186` `42f7945d52433a993765a42fb3416e65e996507bfce2f635f4958877673d222f`; `80000187` `95e388228dc644a4fbca069ca205a856f376dab534b61123cf13445efa9ed3cc`; `80000188` `b94623970de73c14da3f89d5569c272b1d1a994296f431750a24b2d1236c5e7e`; `80000189` `682f11bfc2bd08f32359f23eb3581e5d8c38ec64f5e1e530a10cc46cdd5178d4`; `80000190` `2dd94baa9f8ac44bd228f4a6ea92689138e6c1a1a587b95ea6557b0a99224dc8`; `80000191` `230e15dfbfe940836bbffb1d98a8e2120c9fb748a436168a269e18640c149434`. Current `alpha.json` has schemaVersion 1, versionCode 80000191, versionName 8.1.8, canonical APK URL, and SHA-256 `230e15df...`, matching the remote file. This is owner-supplied server output, not an independently repeated check by the assistant. Signatures and server-side allocation authority remain unverified.

## Allocation authority confirmed by owner
Owner explicitly confirmed on 2026-11-02 that **Futwick is the only machine where new Android versionCodes are allocated**. Therefore retain Futwick's private registry as the single authority; Obscurity is a read-only source for published APK/manifest reconciliation, not a second allocator. No distributed allocation service is required. This does not itself verify the complete server inventory or establish that all prior local attempts are accounted for; retain the existing fail-closed evidence and collision checks.

## Initial implementation (subsequent session)
Created `scripts/android-remote-inventory.js` (commit `9092b3c8`) and `scripts/__tests__/android-remote-inventory.test.js` (commit `237a071b`). Probe uses batch-mode SSH to `evilnick@sancti.fi`, lists APKs, hashes them, reads Alpha manifest, rejects inconsistent/partial observations and emits a JSON report explicitly labelled `observed-not-authoritative`. Tests cover normal parsing, manifest mismatch, missing/duplicate checksums and truncation. No local test execution yet; no Futwick/Obscurity commands run by assistant. Probe is intentionally NOT wired to trusted allocation: still need validated history merge, local registry/attempt reconciliation, source provenance, remote completeness assumptions, and dry-run testing before enabling automatic allocation.

## Baseline comparison implementation
Changed remote probe to pass the script through SSH stdin using `sh -s` (commit `bdb91ecb`), avoiding ambiguous remote shell quoting. Added read-only `scripts/android-remote-reconcile.js` (commit `5cda1052`) and five Jest tests (commit `f132cd06`). The comparison accepts only remote APKs already explicitly recorded as occupied with matching hashes in an approved baseline, rejecting unknown/mismatched published identities, duplicate codes and Alpha inconsistencies. **Important limitation:** this comparison is not sufficient to issue a fresh history attestation: the historical baseline may not include newly published APKs, even if a valid local reservation and ledger entry exists. Next implementation must merge validated local reservations, ledger, attempts, local APK signatures and remote observations, and only then produce an atomic fresh evidence file. No Jest tests or live SSH checks were executed by the assistant.

## Subsequent reconciliation refinements
Fixed delimiter offsets and duplicate filename detection in remote inventory parsing (`b5f8d938`). Updated `reconcileRemote` to allow newer server APKs only if their versionCode and SHA-256 exactly match a caller-supplied record marked verified, or if already approved in baseline (`a517e2ae`). Added three tests for matching verified newer artifacts, unverified claims and hash conflicts (`dbfe98cd`). The `verified` marker is an API contract, **not** cryptographic proof: caller-side `inspectApk`, reservation/ledger and archive checks must be implemented before using this result to refresh history. No automatic history file was created, no live execution or Jest run performed.

## Local APK verification wiring
Added `scripts/android-local-reconcile.js` (`a6720484`) using the existing `inspectApk()` signer/package/version/hash verification to supply verified local APK identities to `reconcileRemote`. Checks private registry identity and refuses mismatching local/remote bytes; allows older baseline-attested server APKs without a current local copy. Added four Jest fixture tests (`3ecfaaed`) for matching signed inspection results (mocked), conflicts, missing local evidence and registry identity mismatch. This is an exported library function, not yet a complete CLI collector; tests are committed but not executed in Futwick. Important: a mocked inspector tests control flow, not real signature verification. History generation, archive completeness, reservation/attempt/ledger reconciliation, and live end-to-end testing remain outstanding.

## Ledger, reservations and attempts incorporation
Added `scripts/android-local-state-audit.js` (`9eeb2c47`) to validate the existing registry identity, reservation metadata, unique ledger rows, reservation-to-ledger references and attempted build markers; added five fixture tests (`7ea1a808`). Integrated the audit into `reconcileLocalPublished` and reject published-ledger SHA conflicts with remote inventory (`84b90c4e`); adjusted existing fixtures (`3cc3689b`). This remains a read-only component and **not** a fresh allocation attestation. Remaining: validate reservation metadata using the allocator's full canonical validator, scan all configured archives and build output, verify remote inventory completeness and publication race conditions, generate durable atomic history only after full checks, and execute Jest on Futwick. No allocations/builds/publication performed.

## Canonical validator integration
Exported `readReservation` and `ledgerRows` from existing `scripts/android-release.js` (`10cd1512`); `scripts/android-local-state-audit.js` now calls these instead of duplicating weaker parsing (`caeb489c`). Updated reservation test fixture to include canonical metadata digest snapshots (`55d0f656`). **Not yet run on Futwick.** Remaining archive traversal must account for all configured paths and rejected historical APK identities; remote inventory snapshot must be checked for completeness and stability. No automatic history creation, allocation or publication yet.

## Archive inventory implementation and integration
Following Futwick's reported 22/22 passing focused Jest tests (four suites, 4.042s), added `scripts/android-local-archives.js` (`63a64022`) and five fixture tests (`d90f1e97`). It scans the declared archive directories and optional output APK using the existing signed APK inspector, verifies sidecar identity, rejects orphan sidecars and symlinks, detects conflicting occupied APK identities and retains baseline-approved rejected states. Integrated the resulting inspected identities into local/remote reconciliation (`206fc0a5`) and updated test fixtures (`37314e5a`). New tests and modified integration tests **not yet executed**. This still requires a trustworthy declaration of complete archive paths, remote snapshot consistency, and safe generation of refreshed history before allocator automation. No versionCode allocated or release published.

## Double-read Obscurity observation
After user confirmed all five focused suites passed on Futwick (27/27 tests, 2.071 seconds), changed the remote SSH probe to read APK filenames, SHA-256 hashes and active Alpha manifest twice and fail if the two observations differ (`123af9c9`). Updated parser tests for double-read output and added mutation test (`d5b493f2`, `5b00af9b`). This mitigates but cannot eliminate races; it is not an atomic snapshot and does not yet validate backup manifests or public HTTPS publication. New tests not yet run on Futwick. Still no history generator or allocator integration; no allocations or publication performed.

## Futwick snapshot test failure and correction
User ran remote inventory Jest suite on Futwick: five tests passed, one failed. The failing mutation fixture only prepended whitespace to the second Alpha manifest; parser trims manifest text, so no actual difference remained. Corrected fixture to change the second manifest versionCode (`fc53cae9`). This is a test fixture defect, not yet evidence of a production parser failure. Corrected test awaits Futwick rerun.

## Live Obscurity evidence and reconciliation entry point
User configured existing Futwick SSH public key for Obscurity and successfully ran `node scripts/android-remote-inventory.js` at 2026-11-02T18:39:44.887Z. Remote observed APKs 80000186–80000191; active Alpha 80000191 SHA-256 `230e15dfbfe940836bbffb1d98a8e2120c9fb748a436168a269e18640c149434`. Both reads agreed. This is not historical attestation and does not justify allocating 80000192 by itself.

Added read-only `scripts/android-release-reconcile.js` CLI (`5a78a61f`) requiring approved baseline, explicit archive declarations, build-tools and ledger. It invokes the live probe and local reconciler and reports counts/high-water observations without writing history or allocating. Added CLI tests (`08749e15`). New CLI tests have **not yet run on Futwick**. Next: validate against real local paths, verify scope of archives and historical baseline, then implement guarded history generation. No allocation or publication.

## Retrospective ledger reconciliation (2 November, later session)
Owner supplied private allocation registry and APK sidecar values for 80000190 (reservation bd22ba90-f700-465c-be9b-bf231f04492b, source 30bf2deb1fe2ae93288490bfc3f43d513df97a91, APK SHA-256 2dd94baa9f8ac44bd228f4a6ea92689138e6c1a1a587b95ea6557b0a99224dc8) and 80000191 (reservation 935ca7d4-38b8-499b-a2a2-cd701313bb16, source c6a9ef1300d7f098580195d242a6200350b81dd1, APK SHA-256 230e15dfbfe940836bbffb1d98a8e2120c9fb748a436168a269e18640c149434). Owner found local APKs, sidecars and attempt markers for both. The Issue 047 publication diary documents 80000190 public HTTPS verification; Obscurity read-only observation shows 80000191 active Alpha on 2 November.

Updated docs/android-release-ledger.md to reflect both codes as Published Alpha, preserving their reservation IDs/times and source/checksum evidence. Initially appended duplicate retrospective rows, then corrected immediately to **one canonical row per versionCode**, because the existing `ledgerRows()` parser rejects duplicate versionCodes. Final ledger commit: `7b61d7ae`. No tests have yet run on Futwick after these edits, and no allocation, build or publication was performed. Important outstanding: the ledger parser's `Published` status and reservation-ID presence should be regression-tested; the current local-state audit expects each reservation ID in its row. Further automation must not invent complete attestation from a historical baseline or a remote snapshot.
