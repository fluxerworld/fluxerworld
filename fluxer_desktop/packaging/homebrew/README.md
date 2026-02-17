# Fluxer Homebrew cask

Homebrew cask definition for installing Fluxer on macOS.

## Placeholders

The `version` and `sha256` fields are set to placeholder values. Update them before publishing or submitting to a tap.

## Livecheck

The cask includes a `livecheck` block that queries the Fluxer download API for the latest stable version. Homebrew's automated tooling uses this to detect new releases.

## Testing locally

```bash
brew install --cask ./fluxer.rb
```

## Fetching the latest version

```bash
curl -s https://api.fluxer.app/dl/desktop/stable/darwin/arm64/latest | jq
```

This returns a JSON object containing `version`, `pub_date`, and `files` with download URLs and SHA256 checksums for each format.
