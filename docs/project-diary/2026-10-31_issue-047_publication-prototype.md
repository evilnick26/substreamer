# Issue #047 — Attended Alpha publication prototype

Date: 2026-10-31. Branch: `issue-047-publication-automation`.

## Investigation
Owner recovered the original Obscurity publication procedure from Obscurity's Bash history. The local immutable archive is `/media/data/Complete/Sanctifi/Releases`; SCP previously sent the APK to `evilnick@obscurity:/tmp/`. Published files are under `/opt/updates-site/client/apks/`, and `/opt/updates-site/client/alpha.json` is the live schemaVersion 1 manifest. Existing publication used `sudo install -o root -g root -m 0644`, `sha256sum`, `cp -p` for backups and same-directory `mv` for atomic manifest promotion. Owner confirmed `evilnick` has interactive password-protected sudo; passwords must remain interactive, never stored. Current live manifest is versionCode 80000189; target staged release is 80000190 (SHA-256 `2dd94baa9f8ac44bd228f4a6ea92689138e6c1a1a587b95ea6557b0a99224dc8`).

## Implementation
Added `scripts/publish-alpha.py` as an initial prototype, with local `--dry-run` and attended `--execute` modes. The script validates a reviewed candidate manifest and local APK checksum, transfers to a uniquely named remote scratch directory, invokes sudo interactively, checks remote APK bytes and manifest, refuses conflicting published APKs/backups, preserves the previous live manifest, atomically promotes the new manifest and verifies public HTTPS manifest/APK bytes. No credentials are stored. The script does not create the candidate manifest or alter app version metadata.

## Validation and limitations
**Not yet executed or tested on Futwick or Obscurity. No production publication authorised by this prototype commit.** The first dry-run is strictly local and does not inspect remote state. The implementation requires review, tests with temporary directories/fault injection, and a safer privileged remote execution boundary before production use. Interactive password prompts may occur multiple times. An HTTPS verification failure after promotion needs an explicit recovery runbook. Release notes require owner review.

## Outstanding
- Add deterministic tests for manifest validation, remote promotion, collision, retries and failure recovery.
- Remove risk of executing an untrusted user-writable remote script with sudo.
- Add meaningful remote read-only preflight and clear reporting.
- Validate against staged release and compare existing live manifest; review exact release notes.
- Obtain separate owner approval before executing live publication.

## Continued implementation — interactive manifest authoring

Owner confirmed that release notes are the only routinely human-authored manifest field. Added `--prepare-manifest` mode to `scripts/publish-alpha.py`: read a multiline changelog terminated by a single-dot line, derive canonical schema/versionCode/versionName/URL/SHA-256 from the staged APK, show the JSON for review, require explicit `YES`, and create the local candidate with exclusive file creation. It does not contact Obscurity. Added tests for successful creation, cancellation, existing-file protection and empty notes. Existing unsafe privileged remote execution path remains disabled.

**Validation pending:** tests have been committed but not executed on Futwick. Do not use `--execute`. Test candidate generation and dry-run only after fetching this branch. Further remote safety design and failure testing remain required.
