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

## Futwick test feedback and correction

Owner ran `python3 -m unittest discover -s scripts/__tests__ -p 'test_publish_alpha.py' -v` on the branch. Nine tests passed; the manifest-save test failed with `JSONDecodeError: Extra data`. Investigation identified double-escaped Python newline literals in the generated JSON suffix, preview and multiline notes join. Corrected these to actual newline escape sequences in commit `4ee46532`. **Retest pending**; no production manifest or publication was performed.

## Futwick validation — manifest generator

Owner reported successful rerun after regression assertion fixes: `Ran 10 tests in 0.006s` / `OK`. This validates the local Python unit test suite, not the remote publication workflow. Next step is attended creation and review of candidate manifest for release `80000190`; `--execute` remains disabled and must not be used.

## Real candidate prepared on Futwick

Owner ran `--prepare-manifest` for release `80000190`, reviewed and approved the preview, and saved `/tmp/sanctifi-alpha-80000190.json`. The reported SHA-256 was `2dd94baa9f8ac44bd228f4a6ea92689138e6c1a1a587b95ea6557b0a99224dc8`, matching the staged APK. Notes: “sancti.fi Client 0.1.2 — Release Type grouping. Albums can now be explored by release type, making it easier to navigate the library.” UX feedback: waiting for multiline input looked stalled; changed instructions ordering and added `> ` prompt (commit `a632c5d2`). Remote publication remains untested and disabled.

## Local dry-run verified; remote transport investigation

Owner successfully ran local dry-run for `80000190`: candidate checksum matched staged APK (`2dd94baa9f8ac44bd228f4a6ea92689138e6c1a1a587b95ea6557b0a99224dc8`); no SSH, sudo or publication occurred. Investigated avoiding execution of user-writable remote shell scripts as root. Added an explicit typed `PUBLISH` gate and constructed a shell-quoted privileged command intended for SSH TTY transport, but **left remote promotion explicitly disabled** until mocked transport, remote preflight and failure/recovery tests are completed. No production deployment was attempted.

## Read-only remote preflight (implementation awaiting Futwick validation)

Added `--remote-preflight` to inspect Obscurity over SSH without sudo or writes. It verifies directory/manifest presence, refuses symlinked live manifest or target APK, checks that live versionCode is lower than the candidate, and detects conflicting existing APK bytes. It requires an explicit `PREFLIGHT_OK` marker. Added three mocked tests for command shape, missing marker and SSH failure. `--dry-run` remains fully local. This preflight does not yet validate backup state, filesystem writability under sudo, or recovery. The production `--execute` path **remains disabled** pending further safety work. Neither remote preflight nor tests have been run on Futwick yet; no live changes made.

## Futwick import failure and correction

Owner attempted the expanded suite, but Python failed at import with `SyntaxError` on line 209: escaped `\\n` text had been accidentally inserted into executable source during the prior commit. No tests ran and no remote operations occurred. Replaced malformed literal escapes with actual source line breaks (commit `b20f7ee2`). Retest pending. Add a Python compilation check before future test instructions.

## Futwick 13-test suite feedback

Python compilation succeeded; 12 tests passed and one remote-preflight mock test failed because its simulated SSH output used literal escaped `\\n` text rather than newline characters. Corrected the fixture (commit `f59b375b`). Retest pending. No remote preflight was executed and no production changes were made.
