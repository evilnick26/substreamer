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
