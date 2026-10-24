# sancti.fi Client — Project Diary
## 24 October 2026 — Issue 026: Login password auto-capitalisation

### Investigation and scope

Started from refreshed remote `sanctifi` commit
`ae9b7775d7ba593d3ccefc27fd1f096c74073e72` on a dedicated working branch.
The login route renders `LoginScreen` in `src/screens/login.tsx`; the password
field uses React Native `TextInput` directly, without a shared input wrapper.
It enabled `secureTextEntry` but omitted `autoCapitalize`. The installed React
Native Android implementation defaults that prop to `sentences`; the username
field already specifies `none`.

The approved change adds only `autoCapitalize="none"` to the password input.
Secure entry, submit handling and authentication are unchanged. Password state
and login/session arguments retain the exact entered text. Autocorrection and
autofill settings are unchanged to keep this focused on the reported behaviour.
Android versionCode, signing, release packaging and update behaviour are untouched;
release numbering and the first signed in-place APK upgrade test belong to Issue 022.

### Regression checks

Added `src/screens/__tests__/login.password.test.tsx`, rendering the real screen
with authentication, native certificate helpers and unrelated child UI mocked.
The tests check the password input's `autoCapitalize="none"` and secure-entry
props, then submit a dummy mixed-case password with leading/trailing whitespace
and confirm exact text reaches both login and session storage.

Before the fix, the auto-capitalisation assertion failed on Android and iOS;
the casing/whitespace assertions passed. After the one-line change, both platform
targets passed: two suites, four tests. TypeScript and the Intl, translation,
ProGuard and module-inventory validators passed. Translation validation retains
the existing missing-key warnings awaiting Crowdin sync.

Full Jest validation passed: 618 suites passed, two skipped; 10,858 tests passed,
eight skipped, no failures. The circular-import check using the project tsconfig
reported no cycles, with three unresolved external vector-icon static imports.
Whitespace checks passed. No dependency declarations or lockfiles changed.

### Outstanding device acceptance

Jest validates the requested input configuration, not an Android keyboard's visual
state. On a physical Android device, focus the login password field and check
that the keyboard no longer initially selects or proposes an uppercase character;
confirm mixed-case password login still works. No APK build, installation or
device keyboard check was performed in Codex. No real credentials were used.
