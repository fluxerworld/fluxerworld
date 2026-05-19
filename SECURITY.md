# Security Policy

Please **do not** report security vulnerabilities via public GitHub issues.

## How to report

Email **admin@fluxer.world** with a description of the issue and (if you have one) steps to reproduce. Mark the subject with `[security]` so it routes appropriately.

If you don't get a reply within 72 hours, ping the maintainer on GitHub.

## Scope

In scope:

- The Fluxer server we run at `fluxer.world` (API, gateway, web client, media proxy).
- The Fluxerworld desktop app distributed from this repository's releases and the AUR / Flatpak / Snap / F-Droid / Copr packages we publish.
- The Fluxerworld mobile app distributed via TestFlight, Play Store, and IzzyOnDroid.

Not in scope:

- Issues on `fluxer.app` or `canary.fluxer.app` (those are run by the upstream project; please report there).
- Vulnerabilities in dependencies that we forward verbatim from upstream — file them with upstream and CC us.
- Theoretical issues without a practical exploit path.

## What we'll do

- Acknowledge within 72 hours.
- Give a timeline to patch.
- Credit the reporter in the release notes (unless asked otherwise).

## E2EE-specific notes

End-to-end encryption is live for 1:1 and group DMs (text + voice/video). The server holds opaque ciphertext only. If you can decrypt or downgrade an E2EE conversation without participant cooperation, that's a critical bug — please report it.
