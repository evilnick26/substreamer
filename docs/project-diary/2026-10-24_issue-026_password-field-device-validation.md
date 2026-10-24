# 2026-10-24 — Issue #026: Android password field physical-device validation

## Background
- The login password input previously caused the Android keyboard to auto-capitalise the first character, undesirable for case-sensitive passwords.
- Merged PR #28 added `autoCapitalize="none"` to the login password field and focused regression coverage. The implementation and automated tests were recorded with that PR.

## Physical-device validation
- After installing the permanently signed `80000186` APK in the #022 in-place upgrade test, the owner logged out on the Poco F8 Ultra.
- Focusing the login password field **no longer automatically capitalised** the initial character.
- Logging back in succeeded, confirming the expected authentication path remained usable.

## Decision and outcome
- **PASS:** Password field fix verified on a physical Android device.
- Issue #026 closed as completed on 2026-10-24.
- No new implementation changes were required by this validation.

## Separate observation
- During logout/login, the Library navigation ordering reverted to its original default (Songs first), while **Show Album Version = ON** and **Accent Colour = Album Artwork** persisted.
- This is not a password-field failure. It is non-blocking and can be investigated separately if worthwhile; no fix is included in #026.

## Outstanding work
- None for #026. The broader update discovery and publishing work continues under #022 and #023.
