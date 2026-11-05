# Issue #63 — sancti.fi Updates link and website styling

**Date:** 2026-11-05
**Issue:** https://github.com/evilnick26/substreamer/issues/63
**Status:** Implemented, tested and approved; Git housekeeping pending

## Objective

Provide a prominent link from the sancti.fi Client to the existing
https://updates.sancti.fi website, without introducing a dependency
on that website for normal client operation.

## Investigation and decisions

The original proposal placed the Updates link under Settings > About.

During implementation, the preferred location changed to the temporary
Home screen, between the sancti.fi / Radio Infinite logo and the
Recently Uploaded heading.

Decisions:

- Use a simple Pressable link rather than a new navigation screen.
- Open the website in the external browser using Linking.openURL.
- Handle browser-launch failures with a native Alert.
- Keep the link visible independently of library loading state.
- Centre the link and match the Recently Uploaded heading's font
  size (22) and weight (600).
- Use #909090, matching the dark-theme monochrome artwork accent
  defined in ArtworkAccentController.tsx.
- Do not dynamically change the link colour with playing artwork.
- Do not introduce a WebView, API endpoint or new runtime dependency.

## Client implementation

Modified:

- src/screens/sanctifi-home.tsx
- src/screens/__tests__/sanctifi-home.test.tsx

Added a centred "sancti.fi Updates ↗" link below the Home logo.

The link opens https://updates.sancti.fi externally and displays
an error alert if browser launching fails.

Added three regression tests covering successful browser opening,
browser-launch failure and offline visibility.

## Website styling

The Updates website is currently hosted on futwick, independently
of the client Git repository.

Inspection of index.html confirmed that it already references
style.css, allowing the styling change without modifying HTML.

A minimal stylesheet was added:

- Black (#000000) background.
- White (#ffffff) body text.
- Grey (#909090) Last updated text.
- Readable link colours.
- System font and modest spacing.

No JavaScript, framework or additional website dependency was added.

The website CSS is not part of the client repository commit.

## Validation

Client:

- Focused Jest tests: 2 projects, 36/36 tests passed.
- TypeScript check: passed.
- git diff --check: passed.
- Final Android release build: successful in 2m 50s.
- On-device visual inspection: passed.
- External browser launch: passed.
- Return navigation from browser to client: passed.

Website:

- Desktop visual inspection: passed.
- Mobile browser visual inspection: passed.
- Dark styling, text wrapping and readability accepted.

## Acceptance

The product owner explicitly approved the final implementation
on 2026-11-05.

Both the client link and companion website styling are accepted.

## Outstanding work

- Commit the client implementation, tests and this diary entry.
- Verify the repository state after committing.
- Close GitHub Issue #63.

The existing app.json version-code modification is unrelated to
Issue #63 and must not be staged, reverted or modified during
this housekeeping.

## Scope

Issue #63 is a small V1 usability improvement.

No additional Updates feed, notification system, embedded browser
or website integration is required.
