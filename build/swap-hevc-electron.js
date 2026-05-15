// electron-builder afterPack hook.
//
// For linux-x64 builds, swap the stock Electron 37 binaries with BranchBit's
// HEVC-enabled prebuild (https://github.com/BranchBit/electron-chromium-ffmpeg-hevc-prebuilt)
// so that /tts and embedded HEVC video work.
//
// The earlier approach (`--config.electronDist=...`) silently merged poorly
// across electron-builder's internal copy/strip steps and the stock binary
// ended up in the final artifacts. Swapping after packaging — but before the
// per-target build step (tar.gz, deb, rpm, AppImage) — is reliable.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HEVC_DIR = process.env.HEVC_ELECTRON_DIR;

module.exports = async function afterPack(context) {
  if (!HEVC_DIR) {
    // No override requested — local dev / non-CI builds skip the swap.
    return;
  }
  if (context.electronPlatformName !== 'linux' || context.arch !== 1 /* x64 */) {
    return;
  }
  if (!fs.existsSync(HEVC_DIR)) {
    throw new Error(`HEVC_ELECTRON_DIR=${HEVC_DIR} does not exist`);
  }

  const dest = context.appOutDir;
  console.log(`[hevc-swap] replacing Electron in ${dest} with HEVC prebuild from ${HEVC_DIR}`);

  // Replace the renamed electron binary (electron-builder renames it to the
  // productName-derived executable).
  const productExe = path.join(dest, context.packager.executableName || 'fluxer-world');
  const sourceExe = path.join(HEVC_DIR, 'electron');
  if (!fs.existsSync(sourceExe)) {
    throw new Error(`Expected electron binary at ${sourceExe}`);
  }
  fs.copyFileSync(sourceExe, productExe);
  fs.chmodSync(productExe, 0o755);

  // Replace supporting Chromium files (locales, paks, snapshots, GL/Vulkan libs).
  // libffmpeg.so is intentionally NOT in this list — see comment below.
  const passthrough = [
    'chrome_100_percent.pak',
    'chrome_200_percent.pak',
    'chrome_crashpad_handler',
    'icudtl.dat',
    'libEGL.so',
    'libGLESv2.so',
    'libvk_swiftshader.so',
    'libvulkan.so.1',
    'resources.pak',
    'snapshot_blob.bin',
    'v8_context_snapshot.bin',
  ];
  for (const f of passthrough) {
    const src = path.join(HEVC_DIR, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(dest, f));
    }
  }

  // Replace locale .pak files.
  const localesSrc = path.join(HEVC_DIR, 'locales');
  const localesDest = path.join(dest, 'locales');
  if (fs.existsSync(localesSrc)) {
    fs.rmSync(localesDest, { recursive: true, force: true });
    execSync(`cp -r ${JSON.stringify(localesSrc)} ${JSON.stringify(localesDest)}`);
  }

  // Leave the stock libffmpeg.so in place. BranchBit's Electron 37 still
  // dlopens libffmpeg for non-HEVC codecs (Vorbis/Opus/etc.) — deleting it
  // produces a black-screen-on-launch even though HEVC is compiled into the
  // main binary. The HEVC support lives in the electron binary itself, not
  // in libffmpeg, so coexistence is fine.

  console.log('[hevc-swap] done');
};
