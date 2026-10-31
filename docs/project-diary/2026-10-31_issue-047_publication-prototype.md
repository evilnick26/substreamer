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

## Futwick remote-preflight unit tests green

Owner reported `Ran 13 tests in 0.014s` / `OK` after fixing the mock output fixture. The remote preflight has not yet been exercised against Obscurity; production promotion remains disabled. Next: attended read-only `--remote-preflight` for candidate 80000190.

## First real Obscurity read-only preflight — passed

Owner ran `--remote-preflight` on Futwick for candidate `80000190`, with interactive SSH password. Output reported local SHA-256 `2dd94baa9f8ac44bd228f4a6ea92689138e6c1a1a587b95ea6557b0a99224dc8`, `LIVE_VERSION: 80000189`, `APK_TARGET: absent`, and `PREFLIGHT_OK`. No file transfers, sudo or publication. This confirms the read-only preflight checks, not the privileged installation/recovery path. Production `--execute` remains disabled pending transport and failure-path validation.

## Continued guarded development — backup preflight

Following owner approval to continue development, expanded the read-only remote preflight to inspect the expected backup path for the currently live version, reject symlinks/non-files and refuse a conflicting existing backup. Added test assertions that the remote command includes these checks. These changes are committed on the development branch but not yet tested on Futwick. No server writes or publication. The privileged `--execute` promotion remains deliberately disabled; backup/recovery and privileged transport need further testing before release.

## Futwick validation — backup preflight checks

Owner ran Python compilation and the 13-test suite after the backup-preflight changes; reported `Ran 13 tests in 0.011s` and `OK`. The `LIVE_VERSION` output inside the unit tests is mocked. Next validation is a fresh attended, read-only `--remote-preflight` on Obscurity to exercise the new backup checks. No production changes.

## Live Obscurity backup preflight — passed

Owner reran attended read-only `--remote-preflight` for `80000190`. Server reported `LIVE_VERSION: 80000189`, `APK_TARGET: absent`, `BACKUP: absent`, `PREFLIGHT_OK`. Local APK SHA-256 remained `2dd94baa9f8ac44bd228f4a6ea92689138e6c1a1a587b95ea6557b0a99224dc8`. No writes, sudo, or publication occurred. Privileged promotion and recovery paths remain disabled and unvalidated.

## Execution-path safety review

Reviewed current publisher and identified that `--execute` previously asked for confirmation and staged files without automatically re-running the remote read-only preflight. Added mandatory `remote_preflight(code, checksum)` before the confirmation prompt or any transfer, so stale/conflicting live state fails closed. This is a code change only; Futwick tests pending. The execution path is still deliberately blocked before privileged remote command invocation. Outstanding: transport mocks, robust privileged promotion and recovery checks, explicit publication approval.

## Execute preflight failure-path test added

Owner confirmed Python compilation and 13/13 existing tests green after mandatory execute preflight gate. Added isolated test `test_execute_preflight_failure_prevents_confirmation_and_transfer`: creates a temporary APK/manifest, mocks remote preflight failure, asserts no confirmation prompt, SCP, or SSH transport. Test committed; Futwick execution pending. Production promotion remains disabled.

## Futwick validation — 14 tests passing

Owner confirmed `python3 -m py_compile` passed for publisher and tests, followed by `Ran 14 tests in 0.011s` / `OK`. The new `test_execute_preflight_failure_prevents_confirmation_and_transfer` passed, establishing that mocked preflight refusal stops before confirmation, SSH staging or SCP transfer. Production promotion remains disabled. Next: isolated transport failure tests and privileged promotion recovery review.

## Transport and recovery tests added (awaiting Futwick validation)

Added isolated tests for SSH scratch-creation failure, APK SCP failure, manifest SCP failure, deliberate promotion block, cleanup attempts after staging, and rejection of unsafe scratch paths. Added static assertions for privileged script's temporary-file cleanup, live-manifest comparison, atomic rename, success marker, and continued disabled promotion. These static checks do **not** simulate actual privileged failure/recovery, and cleanup SSH failure is currently ignored by the publisher. No production execution; test suite expected to increase from 14 to 17. Remaining: real sandboxed promotion fault injection, stronger cleanup reporting, privileged command transport, post-publication verification and rollback policy.

## Transport test failure and fixture correction

Owner reported 14/17 passing. Three `test_transport_failure_matrix_and_cleanup` subcases (`apk`, `manifest`, `blocked`) saw zero SCP calls. Root cause: mocked scratch-path SSH stdout contained a literal backslash-n rather than a newline, failing path validation before transfers. Corrected escape in the test fixture. Awaiting Futwick revalidation; publisher and production files unchanged.

## Futwick transport suite validated — 17/17

Owner reported `Ran 17 tests in 0.035s` / `OK` after fixing the mocked SSH stdout newline. The transport failure matrix, unsafe scratch path refusal, and static promotion/recovery invariants passed. This validates mocked SSH/SCP control flow and cleanup attempts only; no isolated privileged-script execution or fault-injected recovery has been performed. `--execute` remains deliberately blocked. Next: sandboxed privileged promotion/fault-injection tests and review cleanup failure reporting before any production authorization.

## Cleanup failure reporting and tests — pending Futwick validation

Added `cleanup_remote_scratch()` so a nonzero SSH cleanup exit or SSH-launch OSError emits an explicit warning identifying the scratch directory while preserving the original transport/promotion exception. The helper is called from the existing `finally` block; successful cleanup remains silent. Added two focused unit tests for cleanup exit failure and launch failure (expected suite: 19). No remote execution or publication. **Important outstanding limitation:** these tests do not exercise privileged promotion rollback or prove remote cleanup succeeded; remote promotion remains blocked. Validation on Futwick pending.

## Futwick validation — 19/19 tests passing

Owner reported `Ran 19 tests in 0.063s` / `OK` following the cleanup warning changes. This validates mocked transport and cleanup error reporting. It does not validate privileged installation or rollback; `--execute` remains disabled and Obscurity production files remain unchanged. Next engineering milestone: isolated promotion-script fault injection around backup creation and atomic manifest replacement.

## Isolated shell promotion fault-injection test — pending Futwick validation

Added one test with five subcases executing the **actual embedded Bash promotion program** against temporary local `client/`, `apks/` and `scratch/` paths: successful promotion, APK install failure, backup copy failure, staged-manifest install failure, and final atomic `mv` failure. The test removes root ownership flags only in its disposable copy and injects failures via temporary PATH wrappers; it checks old live manifest preservation on failures, backup/target state, scratch and temp-file cleanup, and success marker on success. No SSH/sudo, no Obscurity production writes, and `--execute` remains blocked. Expected suite: 20 tests (with five sandbox subcases); validation pending. This is not a proof of actual privileged permissions, concurrency safety, or post-promotion HTTPS verification. Follow-up: test unexpected concurrent live changes, assess partial-artifact cleanup/retry semantics, and privileged transport details.

## Sandbox fixture failure and correction

Owner reported 20 tests with two failures and two errors, all in the five-case sandbox promotion test. Investigation found the fixture generated JSON and wrapper shell scripts using literal backslash-n characters rather than newline escapes, causing `JSONDecodeError: Extra data` before the intended fault-injection stages. Corrected only the sandbox test fixture's newline escapes; production publisher unchanged. Awaiting Futwick rerun. No promotion or production changes.

## Futwick sandbox validation — 20/20 passing

Owner confirmed `Ran 20 tests in 0.602s` / `OK` after correcting sandbox JSON and shell-wrapper newline escapes. The five sandbox subcases now pass: normal promotion, APK install failure, backup creation failure, staged-manifest install failure and atomic rename failure. These execute the embedded Bash logic in disposable local directories with root ownership flags removed, not SSH/sudo against production. Remaining: concurrent modification testing, partial-artifact recovery/retry semantics, privileged SSH/sudo transport, HTTPS verification and explicit go/no-go review. `--execute` remains blocked; release 80000190 unpublished.

## Concurrent live-manifest change fault injection — pending validation

Extended the isolated Bash promotion test with a sixth subcase. A disposable `install` wrapper stages the candidate manifest and then simulates another actor modifying the live `alpha.json` before the publisher's final `cmp` guard. The expected result is refusal to promote, preservation of the externally changed live manifest (not an automatic rollback), retention of the original backup, and cleanup of scratch/temp files. This tests detection of a change at this specific point, not full concurrency safety or a change between the final check and rename. Expected total remains 20 unittest methods, with six sandbox subcases. No production execution; `--execute` remains blocked. Futwick validation pending.

## Futwick validation — concurrent-change scenario passed

Owner confirmed `Ran 20 tests in 0.469s` / `OK` after adding the sixth sandbox promotion scenario. This verifies that a change injected after manifest staging and before the final comparison causes promotion refusal and preserves the externally modified manifest under the tested conditions. The check-to-rename race remains unaddressed; partial-artifact retry semantics and privileged transport still need review. No production changes; `--execute` remains blocked.

## Partial-artifact retry and conflict tests — pending Futwick validation

Extended the sandboxed promotion test with four additional subcases: retry with a matching preexisting APK; retry with both matching APK and current-manifest backup; reject a preexisting conflicting APK; reject a conflicting backup without replacing the live manifest. These are direct execution of the embedded shell program in disposable directories, not mocked SSH. Expected 20 test methods, ten sandbox subcases. No change to production publisher, and `--execute` remains blocked. Caveat: test coverage does not yet establish safe behavior for truncated files, symlinks, permissions, or the final check/rename race; no automatic rollback is implemented. Awaiting owner validation.

## Conflicting-backup test expectation corrected

Owner reported `Ran 20 tests in 0.949s` with one error in the `conflicting-backup` sandbox subcase. The test expected an APK target to exist, but the production Bash script checks backup collisions before any APK installation. The absence of the APK is the intended fail-closed behaviour. Corrected the test to assert that no target APK is created and the conflicting backup remains untouched. Publisher unchanged; Futwick revalidation pending; no production execution.

## Futwick validation — partial-artifact retries and conflicts passing

Owner confirmed `Ran 20 tests in 0.828s` / `OK` after correcting the conflicting-backup expectation. All ten sandbox subcases now pass, including retries with matching existing APK and backup, and fail-closed refusal for conflicting APK/backup. In particular, a conflicting backup is detected before any new APK is installed. This remains local disposable-directory testing, not privileged SSH/sudo or live production. `--execute` remains deliberately disabled; 80000190 remains unpublished. Next: privileged transport and final check/rename race review.

## Symlink collision tests — awaiting validation

Added two sandbox subcases to assert the privileged promotion script refuses symlink APK and backup destinations (including dangling symlinks), preserves the live manifest, and cleans scratch without installing new files. Expected: 20 unittest methods, 12 sandbox subcases. No publisher changes, SSH/sudo or production execution. Remaining high-priority review: the current disabled `--execute` path constructs `sudo bash -c` without invoking SSH with a forced remote TTY; interactive sudo may fail in real use. Also the final compare-to-rename race remains. Do not enable promotion without resolving and testing transport.

## Symlink tests revealed actual fail-open bug — fix pending validation

Owner reported 20 test methods with two failing sandbox subcases: dangling symlink APK target unexpectedly allowed publication; dangling symlink backup target allowed APK creation. Root cause in production embedded Bash: `test ! -L "$target" && test ! -L "$backup" && test ! -L "$root/alpha.json"` is an AND list; with Bash `set -e`, a failing nonfinal command in an AND list does not necessarily abort the script, and the final successful check permits continuation. Replaced with explicit `if test -L ... || ...; then echo error; exit 1; fi`. This is a genuine publisher safety correction, not a test expectation change. Owner revalidation pending. `--execute` remains blocked; no production writes.

## Transport command construction — awaiting validation

Owner previously confirmed 20/20 tests in 1.154s after fixing symlink guards; all twelve sandbox scenarios passed. Added a pure `privileged_ssh_argv(script)` helper returning `ssh -tt evilnick@obscurity` with a shell-quoted `sudo bash -c` argument, plus a unit test for forced TTY and exact argument preservation. The `--execute` branch only constructs the command and still raises before executing it. This is a structural unit test, NOT a live SSH/sudo authentication test. Expected 21 tests. Need review whether sudo's TTY requirements and prompt work on Obscurity, plus the final compare/rename race. Release 80000190 remains unpublished.
