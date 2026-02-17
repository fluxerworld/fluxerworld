# Fluxer Flatpak packaging

These files are for submitting Fluxer to [Flathub](https://flathub.org), the centralised Flatpak application repository.

## Files

- **`app.fluxer.json`** -- Flatpak manifest defining the build, runtime, permissions, and sources.
- **`app.fluxer.metainfo.xml`** -- AppStream metadata for the app store listing (description, categories, content rating, etc.).
- **`app.fluxer.desktop`** -- XDG desktop entry so the app appears in desktop launchers.
- **`icon-256.png`** -- Application icon (256x256). This file must be extracted from the build resources or provided separately; it is not checked in.

## Placeholder SHA256 hashes

The `sha256` values in `app.fluxer.json` are set to `PLACEHOLDER_SHA256_X64` and `PLACEHOLDER_SHA256_ARM64`. These are updated automatically by [flatpak-external-data-checker](https://github.com/nickvdp/flatpak-external-data-checker) via the `x-checker-data` configuration on each source. When preparing a manual build, replace them with the actual SHA256 checksums of the downloaded tar.gz archives.

## Icon

The `icon-256.png` file needs to be provided before building. You can extract it from the Electron build resources:

```sh
cp ../../build_resources/icons/256x256.png icon-256.png
```

Or generate it from the source SVG/PNG in the build resources directory.

## Testing locally

Install the required runtime and base app if you haven't already:

```sh
flatpak install flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 org.electronjs.Electron2.BaseApp//24.08
```

Then build and install:

```sh
flatpak-builder --user --install build-dir app.fluxer.json
```

Run the app:

```sh
flatpak run app.fluxer
```

## Flathub submission

To submit to Flathub, fork the [flathub/flathub](https://github.com/flathub/flathub) repository and open a pull request adding `app.fluxer.json` along with the supporting files. Refer to the [Flathub submission guide](https://docs.flathub.org/docs/for-app-authors/submission/) for current requirements.
