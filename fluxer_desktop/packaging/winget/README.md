# Fluxer Winget manifest

Windows Package Manager (winget) manifest for installing Fluxer on Windows.

## Placeholders

The `PackageVersion` and `InstallerSha256` fields are set to placeholder values across all three manifest files. Update them before submitting to the winget-pkgs repository.

## Manifest files

- `Fluxer.Fluxer.yaml` -- version manifest (required)
- `Fluxer.Fluxer.installer.yaml` -- installer details for x64 and arm64
- `Fluxer.Fluxer.locale.en-US.yaml` -- default locale metadata

## Validating

```bash
winget validate --manifest .
```

## Testing locally

```bash
winget install --manifest .
```

## Fetching the latest version

```bash
curl -s https://api.fluxer.app/dl/desktop/stable/win32/x64/latest | jq
```

This returns a JSON object containing `version`, `pub_date`, and `files` with download URLs and SHA256 checksums for each format.
