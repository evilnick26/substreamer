# Issue #054: Controlled GitHub delivery audit

Date: 2026-10-30

## Purpose and scope

Verify the authorised Codex-to-GitHub handover for the sancti.fi Client through one documentation file, one feature branch and a draft pull request. The owner confirmed `evilnick26/substreamer` as the intended repository and `sanctifi` as the integration branch. This is workflow verification only; it makes no application change.

## Environment and baseline

- Managed Codex cloud workspace, Bash, Git and GitHub CLI.
- Origin: `https://github.com/evilnick26/substreamer.git`.
- Initial checkout: `work`, with a clean working tree.
- Enforced HTTP network policy permits `github.com` and `api.github.com`.
- GitHub operations require execution-tool network access explicitly enabled.
- Verified fetched baseline: `401026607cccf68b1ea25b003ccfc1d046c62da6`.
- Feature branch: `issue-054-delivery-audit`, created from `refs/remotes/origin/sanctifi` after confirming the name was absent locally and remotely.

## Investigation and verified results

The initial restricted-execution `gh auth status` reported an invalid token. Repeating the checks with execution-tool network access enabled succeeded using the existing credential, without replacing or displaying it. The earlier credential-repair conclusion was incorrect; the observed failure depended on execution networking.

Successful read-only checks with network access enabled:

- `gh auth status`: authenticated as `evilnick26`, HTTPS Git protocol.
- `git ls-remote origin HEAD`: returned `2ee497cdc442de45589c2f685367c0d6afbe645b`.
- `gh api user`: returned login `evilnick26`.
- Repository API: `evilnick26/substreamer`, public, not archived, default branch `master`, with push permission. Description: "Substreamer - Subsonic Music Streamer".
- Branch API: `sanctifi` exists at the baseline SHA above.

`git fetch origin sanctifi` succeeded but populated only `FETCH_HEAD`; verification found no local `origin/sanctifi` reference. The owner authorised the explicit correction:

```sh
git fetch origin +refs/heads/sanctifi:refs/remotes/origin/sanctifi
git rev-parse --verify 'refs/remotes/origin/sanctifi^{commit}'
git ls-remote --heads origin refs/heads/issue-054-delivery-audit
git switch -c issue-054-delivery-audit refs/remotes/origin/sanctifi
```

The corrected fetch and commit-reference verification succeeded. The remote branch check returned no matching branch. Local branch creation succeeded. The fetch refspec updates a local remote-tracking reference; it does not force-push any remote branch.

## Delivery operations pending at document commit time

The remaining authorised operations are to stage only this file, check the staged diff, commit with an Issue #054 reference, push only `HEAD:refs/heads/issue-054-delivery-audit`, and create a draft PR with base `sanctifi`. Commit, push and PR creation have not yet been tested at the time this document is written. Their actual outcomes and identifiers must be verified and reported in the PR description and delivery report rather than claimed in advance here.

## Limitations and outstanding verification

- This audit does not validate application behaviour, builds, signing, installation, releases or CI success. Application tests and APK builds are not part of this documentation-only test.
- No application code, configuration, dependencies or release files are changed. No merge, reset, rebase or force-push is authorised.
- No credentials or sensitive environment details are recorded.
- Symdex indexing is unavailable in the exposed tools; no symbol-index verification was performed.
- Futwick was not accessed or modified. The owner must separately verify that Futwick can fetch the delivered branch, resolve the reported new commit, and inspect the single-file diff and draft PR. That workstation handover remains untested by Codex.
- The draft PR must remain unmerged pending owner review.

## Completion addendum — 2026-10-30 (after PR #57 merge and Futwick integration)

This addendum records later verified events. The earlier sections intentionally preserve what was known **at the time of the original audit commit**; their then-pending statements are superseded by the outcomes below.

### Codex → GitHub delivery

- Codex created and pushed `issue-054-delivery-audit` from the then-current `sanctifi` baseline `401026607cccf68b1ea25b003ccfc1d046c62da6`.
- Delivery commit: `c88403c3593ff4fca7d44fdd8271eaf70644cc92`; the sole changed file was this diary, originally 53 added lines.
- Draft PR [#57](https://github.com/evilnick26/substreamer/pull/57) targeted `sanctifi`. GitHub connector verification confirmed one commit, one changed file, and no application changes.
- GitHub initially rejected a merge attempt while PR #57 was still a draft (HTTP 405). Following the owner's explicit merge approval, the PR was marked ready for review and merged using a merge commit, with expected head SHA checked.
- Verified merge commit: `2b34e4744c69fa364a7444c3149f41a211cbb564`. PR #57 is merged, not merely closed.

### Futwick reconciliation before merge

- Futwick checkout: `/media/data/Complete/Sanctifi/Development/Android/substreamer-build`, branch `sanctifi`.
- After refreshing `origin/sanctifi`, Futwick was five commits ahead and zero behind: four Issue #006 inline-lyrics implementation/polish/acceptance commits (`b37f264b`, `0e8540b9`, `a203afe5`, `b37ae30a`) and one Issue #024 artist-release-grouping commit (`869d9e49`).
- Owner authorised a normal (non-force) push from Futwick, advancing GitHub `sanctifi` from `40102660` to `869d9e49`. Subsequent fetch and comparison showed `0 0` divergence.
- Futwick's uncommitted `app.json` modification was a deliberate Android `versionCode` increment from `80000188` to `80000189`; it was not included in the push.

### Futwick integration after merge

- Futwick fetched the updated `origin/sanctifi` and verified exactly two incoming commits: `c88403c3` and merge commit `2b34e474`.
- The incoming file list contained only `docs/project-diary/2026-10-30_issue-054_delivery-audit.md`; no incoming `app.json` changes.
- `git merge --ff-only origin/sanctifi` succeeded, advancing local `sanctifi` from `869d9e49` to `2b34e474` and creating the 53-line diary file.
- Final Futwick verification: `git rev-list --left-right --count HEAD...origin/sanctifi` returned `0 0`; `git status --short` returned only ` M app.json`; `git diff -- app.json` still showed `80000188 → 80000189`; diary-file existence check succeeded.
- No APK was built or tested as part of this documentation-only integration exercise.

### Workflow decision and outstanding documentation

The complete **Codex cloud → GitHub feature branch → draft PR → explicit owner-approved merge → Futwick fetch → fast-forward** route is now empirically verified. Use explicit execution-tool network access for Codex GitHub operations, check the remote-tracking ref after fetching, inspect local changes and branch divergence before integration, and preserve uncommitted local build configuration. Do not infer that a successful fetch automatically creates `origin/sanctifi` in every Codex checkout.

Future feature changes still require their own code review, relevant tests, owner acceptance and (where applicable) an APK build/device test. This audit validates the transfer and integration mechanism, not arbitrary future merges. A concise reusable workflow guide and any issue-closing decision remain separate follow-up work.
