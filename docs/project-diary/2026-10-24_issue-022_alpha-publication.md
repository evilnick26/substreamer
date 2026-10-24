# sancti.fi Client — Project Diary
## 24 October 2026 — Issue 022: First successful live Alpha publication

### Investigation and evidence

This entry records Nick's confirmed results from the completed 24 October
deployment, not a deployment or live verification repeated in Codex. Documentation
work starts from refreshed `sanctifi` commit
`1a93334754150bf98ebd2793e631ce127409e08d`. Earlier hosting assumptions in the
[distribution URL entry](2026-10-24_issue-022_distribution-url.md) are now updated
by the specific observations below.

The existing Caddy container serves `https://updates.sancti.fi/client/` from
`/opt/updates-site/client/`, with APKs in `/opt/updates-site/client/apks/`, without
Caddy configuration changes. Directories are `root:root`, permissions `755`;
published files are `root:root`, permissions `644`.

### Completed deployment procedure

1. Transferred the APK using SCP from futwick to `/tmp/` on obscurity and verified
   its checksum there.
2. Used privileged installation into the root-owned public APK directory and
   verified the installed file's checksum.
3. Validated the Alpha manifest schema locally. Uploaded the manifest to a
   temporary location, installed it as `.alpha.json.new` in the destination
   directory, then renamed it to `alpha.json`.
4. Downloaded the APK through public HTTPS and confirmed its checksum matched
   futwick, the SCP temporary copy and the installed public file. Checked the
   manifest response and the still-unpublished channel responses.

This demonstrates the successful manual path and same-directory manifest
replacement. It does not independently establish failure-injection, concurrency
or caching guarantees.

### Published artifact and manifest results

| APK property | Confirmed result |
| --- | --- |
| Filename | `sanctifi-80000186.apk` |
| Size | 79,545,302 bytes |
| Android package | `fi.sancti.client` |
| versionCode | `80000186` |
| versionName | `8.1.8` |
| SHA-256 of APK bytes | `42f7945d52433a993765a42fb3416e65e996507bfce2f635f4958877673d222f` |
| Public URL | `https://updates.sancti.fi/client/apks/sanctifi-80000186.apk` |

The APK checksum matched at every reported checkpoint: futwick, `/tmp/` on
obscurity after SCP, the public directory after installation, and the full public
HTTPS download. The checksum above identifies APK bytes, not a signing certificate.
No rebuilding, resigning or metadata relabelling is implied by publication.

`https://updates.sancti.fi/client/alpha.json` returned HTTP/2 **200**,
`Content-Type: application/json`, size **297 bytes**. Local schema validation
passed; the manifest references the correct immutable APK, actual version
metadata and checksum.

Unpublished channels:

- `https://updates.sancti.fi/client/beta.json`: **404**.
- `https://updates.sancti.fi/client/release.json`: **404**.

HTTP observations:

- APK: HTTP/2 **200**, correct Android APK MIME type, `Accept-Ranges: bytes`,
  `ETag` and `Last-Modified`.
- Manifest: HTTP/2 **200**, JSON MIME type, `ETag` and `Last-Modified`.
- Neither response included an explicit `Cache-Control` header.

### Decisions and outstanding work

- First live Alpha publication is successful. Retain the model of one immutable
  APK archive shared by separate Alpha/Beta/Stable manifest pointers. Beta and
  Stable remain unpublished until deliberate approval/promotion.
- Subsequent manual transfers can follow SCP to `/tmp/`, checksum verification,
  then privileged installation. Guard against overwriting an existing immutable
  APK filename: reuse identical bytes without overwriting and stop on differences.
  Never blindly run an overwriting installation command against the archive.
- Explicit cache policy remains a future consideration, especially for Issue 023
  client checks. Existing validators/ETag/Last-Modified do not establish freshness
  semantics or prove that responses are uncached. No Caddy change is requested.
- Repeat artifact/manifest validation for each release. Successful publication
  does not prove future failed-upload safety or concurrent-reader behaviour.
- Broader Issue 022 work and the separately proposed human-version migration
  remain distinct; this record does not close the issue or implement Issue 023.

### Documentation-only validation

Documentation consistency, relative links, filename convention, formatting and
documentation-only diff scope passed checks. The supplied checksum, APK size,
manifest size and versions were checked for consistency across the diary and
publishing guide. No application tests or builds were run for this record.
No application, tooling, version, signing, APK, manifest or remote-infrastructure
changes are included; no deployment is repeated and no secrets are recorded.
