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
