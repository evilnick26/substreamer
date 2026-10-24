# sancti.fi Client — Project Diary
## 24 October 2026 — Issue 022: Permanent distribution URL

### Hosting discovery and decision

Refreshed `sanctifi` at `16931cb8416905e0d45a76be144a3dc7563edcb6`.
Nick reported that the existing Caddy container serves
`https://updates.sancti.fi/` from `/opt/updates-site` and that the website responds
successfully over HTTPS. The approved permanent client distribution base is now
`https://updates.sancti.fi/client/`, mapped to `/opt/updates-site/client/`.
This replaces the earlier `https://sancti.fi/updates/` proposal.

Channel pointers remain `alpha.json`, `beta.json` and `release.json`. All reference
the shared immutable `apks/sanctifi-<versionCode>.apk` archive under the new base.
The existing `sanctifi-80000186.apk` remains unchanged, with actual versionName
`8.1.8`; no artifact is rebuilt, resigned or restaged by this work.

### Implementation

- Updated the manifest validator's single exact canonical HTTPS APK URL. It still
  requires the filename versionCode to match the manifest; no configurable or
  multiple-host allowance is introduced.
- Updated positive and negative URL fixtures to the new host/path and added
  explicit rejection of the old address and mixed old/new host/path combinations.
- Updated publishing guidance with confirmed hosting findings and the root-owned
  directory's pending publishing-permission requirements. Existing `index.html`,
  `assets/`, `files/` and `quickstart/` must remain untouched.
- Schema version/fields, signing certificate verification, local staging,
  numbering, shared artifacts, safe manifest replacement and full public-download
  checksum checks are unchanged. No application/runtime or version changes.

### Validation and remaining live acceptance

- All 52 manifest/staging tests passed, none skipped, including acceptance of the
  new address, explicit old-address rejection, code/filename matching, and the
  existing staging/signature-verification simulations.
- Existing Node signing checks: 12 passed; two native runtime groups explicitly
  skipped. TypeScript and Intl, translation, ProGuard and module-inventory
  validators passed. Existing missing-translation warnings remain.
- Protected version/signing files remain byte-for-byte unchanged against the
  baseline. Documentation links and whitespace checks passed. Remaining old-URL
  references are deliberate rejection fixtures or explicitly historical notes.
- Full app Jest was not rerun for this tooling/documentation-only change.

No Caddy or remote filesystem changes, uploads, manifests, signing operations or
builds are performed. No live checks were independently repeated in Codex.

Live acceptance still needs suitable publishing permissions restricted to the
client subtree, directory mapping, actual cache headers, atomic replacement and
complete public APK download/checksum verification. Successful HTTPS website
access is not evidence that these release operations work. Issue 022 remains open
for that acceptance; Issue 023 owns client-side update behaviour.
