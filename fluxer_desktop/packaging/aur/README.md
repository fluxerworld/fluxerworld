# Fluxer AUR package

PKGBUILD for the `fluxer-bin` AUR binary package. This installs pre-built binaries rather than building from source, since Electron apps are impractical to compile within the AUR build system.

## Placeholders

The `pkgver` and `sha256sums` fields are set to placeholder values. Update them before publishing:

- Run `updpkgsums` to fetch and fill checksums automatically.
- Alternatively, query the latest version from the API and update manually.

## Testing locally

```bash
makepkg -si
```

## Fetching the latest version

```bash
curl -s https://api.fluxer.app/dl/desktop/stable/linux/x64/latest | jq
```

This returns a JSON object containing `version`, `pub_date`, and `files` with download URLs and SHA256 checksums for each format.
