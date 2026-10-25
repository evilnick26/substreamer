# Android automatic Alpha discovery: physical acceptance

Use after review of the Issue 041 PR. No physical passes are claimed here.
The canonical endpoint remains `https://updates.sancti.fi/client/alpha.json`.
Do not change live manifests, publish dummy artifacts, change package/signing
identity, uninstall the owner's app or clear its data for these tests.

## Record the test environment

Record the candidate's exact source revision, installed Android versionCode,
manifest build offered, network state, launch method, time to prompt, dismissal
and playback/browsing observations. Keep credentials and private logs out of Git.

From a configured futwick terminal:

```bash
git rev-parse HEAD
adb shell dumpsys package fi.sancti.client | rg 'versionCode=|versionName='
adb shell pidof fi.sancti.client
```

The published and owner-installed build was 80000187 at Issue 038 acceptance.
Equal build numbers should be silent; they cannot demonstrate a newer-version
prompt. A positive physical test needs either a separately approved legitimate
higher release or the isolated fixture procedure below. Version allocation,
release signing, publication and installing a reviewed test candidate are
separate owner-controlled steps, not performed by this PR.

## A genuine cold launch

Stop playback before using force-stop: it stops the process/service, but does not
uninstall the app or clear data. Capture the previous PID, then:

```bash
adb shell am force-stop fi.sancti.client
adb shell pidof fi.sancti.client
adb shell monkey -p fi.sancti.client -c android.intent.category.LAUNCHER 1
adb shell pidof fi.sancti.client
```

The PID query immediately after force-stop must show no process; otherwise stop
and investigate. A new launch creates a fresh JS runtime and automatic budget.
Do not infer a cold launch from swipe-away or a changed Activity alone. For a
warm test, press Home and reopen the app **without** force-stop, checking the PID
before/after; ongoing playback can keep the process alive. A Metro reload also
creates a new JS session and must not be counted as an ordinary warm resume.

## Reproducible isolated fixtures, without altering the live service

Use a dedicated emulator/test handset, not the owner's working installation.
Create a disposable local worktree at the reviewed PR commit and use the existing
development-build workflow. Login normally on that test device. No production
key or real credentials belong in a fixture. Do not stage, publish or distribute
these builds as a release.

In that **local-only** worktree, temporarily replace only the singleton's
`fetchManifest: (...args) => fetch(...args)` adapter in
`src/services/clientUpdateService.ts` with the function below. Add the two local
variables immediately above the singleton. This adapter uses exactly the response
fields read by the real service; it does not change validation, version comparison,
readiness, retry, dialog or lifecycle code. Keep it out of the PR/production source.

```ts
// LOCAL TEST WORKTREE ONLY. Never publish this build or its fixture manifest.
const fixtureMode: string = 'newer'; // newer, transient, offline, timeout, invalid, current, older
let fixtureAttempt = 0;

// Replace the singleton's fetchManifest property with:
fetchManifest: async () => {
  fixtureAttempt++;
  if (fixtureMode === 'offline' || (fixtureMode === 'transient' && fixtureAttempt === 1)) {
    throw new TypeError('TEST: network unavailable');
  }
  if (fixtureMode === 'timeout') return new Promise<Response>(() => {});
  const installed = Number(Application.nativeBuildVersion);
  const code = installed + (fixtureMode === 'current' ? 0 : fixtureMode === 'older' ? -1 : 1);
  const body = fixtureMode === 'invalid' ? '{' : JSON.stringify({
    schemaVersion: 1,
    versionCode: code,
    versionName: 'TEST FIXTURE',
    apkUrl: `https://updates.sancti.fi/client/apks/sanctifi-${code}.apk`,
    sha256: 'a'.repeat(64),
    releaseNotes: 'TEST ONLY: no APK is published. Cancel this dialog.',
  });
  return { ok: true, redirected: false, url: CLIENT_UPDATE_URL, text: async () => body } as Response;
},
```

`fixtureAttempt` is inspectable with a debugger breakpoint in the adapter; do not
add permanent logging or rely on production console logs (the production Babel
configuration strips them). Reload/restart after selecting each mode, then use
force-stop for the measured cold-launch case. These fixture runs validate the
real startup/controller path with simulated responses, not real network transport
or cryptographic verification. **Cancel fixture dialogs; never Download their
unpublished, synthetic APK URLs.** Repeat the normal/current case against the
unaltered real HTTPS adapter as well.

## Test matrix

| Case | Procedure and expected result |
| --- | --- |
| Connected, newer | Cold launch with `newer`, or a legitimate higher release. No dialog during splash/login/migration. After hydration/login/navigation readiness, show one branded update dialog with correct build/notes. Browsing startup and playback are not held waiting for HTTP. |
| Dismiss then warm resume | Cancel or dismiss with Back/backdrop. Background/reopen repeatedly, navigate between tabs and recreate the controller/UI if testing with a debugger. No second automatic offer and no new HTTP request after a successful automatic result in the same JS session. |
| Manual after dismissal | Tap the existing sancti.fi version line. It immediately checks again and offers the update despite automatic dismissal. The inherited five-tap Developer Options action remains separate. |
| Transient failure | Cold launch with `transient`: attempt 1 fails, no error dialog; attempt 2 succeeds after a 2-second foreground backoff and shows one dialog. A real-device airplane/offline-to-online test should restore connectivity before the remaining retry window expires; do not treat a longer outage as this bounded transient case. |
| Server unavailable / offline | `offline`, or real device with every connection disabled. At most 3 automatic attempts; foreground backoffs are 2s then 5s. Remain silent and usable after exhaustion. Restore connectivity: manual checking must work; a new cold launch must get a fresh budget. Ordinary warm resume must not reset the exhausted budget. |
| Timeout | `timeout`: each request settles after its 10-second deadline. At most 3 attempts, with the same backoffs; no crash or blocking startup. Manual real-network recovery can be checked after restoring the real adapter and restarting that isolated test build. |
| Background during retry | With `transient`, background after the first failed attempt and before its retry. No retry starts while backgrounded. Resume consumes the next remaining attempt, not a fresh cycle. |
| Background during request | With a real slow connection or debugger pause, background before response completion. A result may finish/cache, but no prompt is claimed while inactive. Resume shows the retained result once. |
| Startup dialog busy | On first login, leave the normal onboarding guide open while a newer result arrives. Close it: the update dialog should then appear. Never force a database migration to manufacture an overlay; migration/readiness branches are covered by automated tests. |
| Current / older | `current` and `older`, then the unmodified live endpoint where appropriate. No automatic offer or downgrade, one automatic request, no retry. Manual feedback remains correct. |
| Invalid manifest | `invalid`: no automatic dialog, no retry loop; a manual check reports the invalid-manifest error. |
| Manual during backoff | After transient failure, invoke Settings check before the retry. It must not wait for automatic backoff; concurrent requests share an active fetch. A manual offer suppresses duplicate automatic prompting for that same build. |

Automatic recovery is bounded, not a network watcher: if all three attempts fail,
a late reconnection alone does not start a fourth attempt in that JS session.
Foreground transitions can resume an unfinished retry cycle, but do not start a
new successful/exhausted cycle. Already-running requests may complete in the
background; only new automatic attempts and presentation are foreground-gated.

Discard the disposable worktree/test build when finished. Before any production
build, verify the source is the clean approved commit and the real HTTPS adapter
is intact. Real external-browser download/installation was established in Issue
038 and is unchanged; if retested, use only a separately verified real artifact.
Record actual passes, failures and untested cases in the Issue 041 diary.
