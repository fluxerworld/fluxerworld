/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

const LOCALE_SELECTOR_SCRIPT = `(function() {
  function initLocaleSelector() {
    const modalBackdrop = document.getElementById('locale-modal-backdrop');
    const closeButton = document.getElementById('locale-close');
    if (!modalBackdrop || !closeButton) return;

    const HASH = '#locale-modal-backdrop';

    const openModal = () => {
      modalBackdrop.classList.add('show');
      if (window.location.hash !== HASH) history.pushState(null, '', HASH);
    };

    const closeModal = () => {
      modalBackdrop.classList.remove('show');
      if (window.location.hash === HASH) {
        history.pushState(null, '', window.location.pathname);
      }
    };

    document.querySelectorAll('.locale-toggle').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        openModal();
      });
    });

    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal();
    });

    modalBackdrop.addEventListener('click', (event) => {
      if (event.target === modalBackdrop) closeModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modalBackdrop.classList.contains('show')) {
        closeModal();
      }
    });

    window.addEventListener('hashchange', () => {
      if (window.location.hash === HASH) modalBackdrop.classList.add('show');
      else modalBackdrop.classList.remove('show');
    });

    if (window.location.hash === HASH) {
      modalBackdrop.classList.add('show');
      history.replaceState(null, '', window.location.pathname);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocaleSelector);
  } else {
    initLocaleSelector();
  }
})();
`;

const MAIN_PAGE_SCRIPT = `${LOCALE_SELECTOR_SCRIPT}

(function() {
  function initNavToggle() {
    const navToggle = document.getElementById('nav-toggle');
    if (!navToggle) return;

    navToggle.addEventListener('change', function() {
      document.body.style.overflow = this.checked ? 'hidden' : '';
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    initNavToggle();
  });
})();
`;

export function mainPageScript(): JSX.Element {
	return <script defer dangerouslySetInnerHTML={{__html: MAIN_PAGE_SCRIPT}} />;
}

const DOWNLOAD_SCRIPT = `
(function() {
  const DEBUG = true;
  const log = (...args) => DEBUG && console.log('[Fluxer DL]', ...args);

  async function detectArch() {
    log('Detecting architecture...');

    if (navigator.userAgentData?.getHighEntropyValues) {
      try {
        const hints = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness']);
        log('UA Client Hints:', hints);

        const archHint = (hints.architecture || '').toLowerCase();
        const bitness = (hints.bitness || '').toLowerCase();
        const platform = (navigator.userAgentData.platform || '').toLowerCase();

        if (platform === 'windows') {
          if (archHint === 'arm') {
            log('Detected arm64 via Client Hints (Windows)');
            return 'arm64';
          }
          if (archHint === 'x86' && bitness === '64') {
            log('Detected x64 via Client Hints (Windows)');
            return 'x64';
          }
        }

        if (archHint.includes('arm')) {
          log('Detected arm64 via Client Hints (generic)');
          return 'arm64';
        }
      } catch (e) {
        log('Client Hints error:', e);
      }
    }

    const platform = navigator.platform || '';
    log('Platform:', platform);

    if (/mac/i.test(platform)) {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          if (ext) {
            const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
            log('WebGL renderer:', renderer);

            if (/Apple M/i.test(renderer)) {
              log('Detected arm64 via WebGL (Apple Silicon)');
              return 'arm64';
            }
            if (/Intel/i.test(renderer)) {
              log('Detected x64 via WebGL (Intel)');
              return 'x64';
            }
          } else {
            log('WEBGL_debug_renderer_info not available');
          }
        } else {
          log('WebGL context not available');
        }
      } catch (e) {
        log('WebGL error:', e);
      }
    }

    const ua = navigator.userAgent.toLowerCase();
    log('User-Agent:', ua);

    if (/arm64|aarch64/.test(ua)) {
      log('Detected arm64 via UA string');
      return 'arm64';
    }
    if (/win64|x86_64|x64/.test(ua)) {
      log('Detected x64 via UA string');
      return 'x64';
    }

    log('Could not detect architecture');
    return null;
  }

  function updateButtonArch(container, arch) {
    const mainLink = container.querySelector('.download-link');
    if (!mainLink) {
      log('No .download-link found in', container.id);
      return;
    }

    if (mainLink.dataset.arch === arch) {
      log('Already correct arch for', container.id);
      return;
    }

    const parent = container.parentElement;
    const overlay = parent?.querySelector('.download-overlay-link[data-arch="' + arch + '"]');
    if (!overlay) {
      log('No overlay link for arch', arch, 'in', container.id);
      return;
    }

    log('Updating', container.id, 'to', arch);

    const baseUrl = overlay.dataset.baseUrl || '';
    if (!baseUrl) {
      log('Missing baseUrl for arch', arch, 'in', container.id);
      return;
    }

    mainLink.href = baseUrl;
    mainLink.dataset.baseUrl = baseUrl;
    mainLink.dataset.arch = arch;
    mainLink.dataset.format = overlay.dataset.format || '';

    const platform = mainLink.dataset.platform || '';
    const helper = mainLink.querySelector('.text-sm');

    if (helper) {
      if (platform.includes('macos')) helper.textContent = arch === 'arm64' ? 'Apple Silicon · DMG' : 'Intel · DMG';
      else if (platform.includes('windows')) helper.textContent = arch + ' · EXE';
      else if (platform.includes('linux')) helper.textContent = 'Choose distribution';
    }
  }

  function initOverlays() {
    const toggles = document.querySelectorAll('.overlay-toggle');
    log('Found', toggles.length, 'overlay toggles');

    const closeAll = () => {
      document.querySelectorAll('.download-overlay').forEach((el) => el.classList.add('hidden'));
    };

    toggles.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const targetId = btn.dataset.overlayTarget;
        if (!targetId) return;

        const overlay = document.getElementById(targetId);
        log('Toggle clicked, target:', targetId, 'found:', !!overlay);
        if (!overlay) return;

        const wasHidden = overlay.classList.contains('hidden');
        closeAll();
        if (wasHidden) overlay.classList.remove('hidden');
      });
    });

    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeAll());
  }

  function initPwaDialog() {
    const openBtn = document.getElementById('pwa-install-button');
    const modal = document.getElementById('pwa-modal-backdrop');
    const closeBtn = document.getElementById('pwa-close');
    const tabs = document.querySelectorAll('.pwa-tab');

    if (!modal) return;

    const openModal = () => modal.classList.add('show');
    const closeModal = () => modal.classList.remove('show');

    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal();
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
    });

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;
        if (!targetId) return;

        tabs.forEach((t) => {
          t.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
          t.classList.add('text-gray-600');
        });

        tab.classList.remove('text-gray-600');
        tab.classList.add('bg-white', 'text-gray-900', 'shadow-sm');

        document.querySelectorAll('.pwa-panel').forEach((p) => p.classList.add('hidden'));
        const targetPanel = document.getElementById('pwa-panel-' + targetId);
        if (targetPanel) targetPanel.classList.remove('hidden');
      });
    });
  }

  async function init() {
    log('Initialising...');
    initOverlays();
    initPwaDialog();

    const arch = await detectArch();
    if (arch) {
      const containers = document.querySelectorAll('[id$="-download-buttons"]');
      log('Found', containers.length, 'download button containers');

      containers.forEach((c) => {
        const mainLink = c.querySelector('.download-link');
        const platform = mainLink?.dataset?.platform || '';

        if (platform.includes('macos') && arch === 'arm64') {
          log('Skipping update for macOS arm64 (already default)');
          return;
        }

        updateButtonArch(c, arch);
      });
    }

    log('Init complete');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

export function downloadScript(): JSX.Element {
	return <script defer dangerouslySetInnerHTML={{__html: DOWNLOAD_SCRIPT}} />;
}

const DOCS_PAGE_SCRIPT = `
${LOCALE_SELECTOR_SCRIPT}

(function() {
  function initNavToggle() {
    const toggle = document.getElementById('nav-toggle');
    if (!toggle) return;

    toggle.addEventListener('change', function() {
      document.body.style.overflow = this.checked ? 'hidden' : '';
    });
  }

  function initTocObserver() {
    const links = Array.from(document.querySelectorAll('[data-toc-link]'));
    if (links.length === 0) return;

    const linkById = new Map();
    links.forEach((link) => {
      const id = link.getAttribute('data-toc-link');
      if (id) linkById.set(id, link);
    });

    const headings = Array.from(linkById.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (headings.length === 0) return;

    const navbar = document.getElementById('navbar');
    const getOffset = () => {
      const navbarHeight = navbar ? navbar.offsetHeight : 100;
      return navbarHeight;
    };

    let activeId = '';

    const setActive = (id) => {
      if (!id || id === activeId) return;

      activeId = id;

      links.forEach((link) => {
        link.style.color = '';
        link.classList.add('text-muted-foreground');
      });

      const active = linkById.get(id);
      if (active) {
        active.style.color = '#4641D9';
        active.classList.remove('text-muted-foreground');
      }
    };

    const updateActiveHeading = () => {
      const offset = getOffset();
      const viewportHeight = window.innerHeight;
      const maxTop = Math.max(viewportHeight * 0.6, offset + 80);

      let nextActive = '';

      for (const heading of headings) {
        if (!heading) continue;
        const rect = heading.getBoundingClientRect();
        if (rect.top >= offset && rect.top <= maxTop) {
          nextActive = heading.id;
          break;
        }
      }

      if (!nextActive) {
        for (let i = headings.length - 1; i >= 0; i -= 1) {
          const heading = headings[i];
          if (!heading) continue;
          const rect = heading.getBoundingClientRect();
          if (rect.top < offset) {
            nextActive = heading.id;
            break;
          }
        }
      }

      if (!nextActive && headings[0]) nextActive = headings[0].id;
      if (nextActive) setActive(nextActive);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateActiveHeading();
      });
    };

    updateActiveHeading();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  function initHeadingAnchorLinks() {
    const anchorButtons = document.querySelectorAll('[data-anchor-link]');
    if (anchorButtons.length === 0) return;

    anchorButtons.forEach((btn) => {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();

        const slug = this.dataset.anchorLink;
        if (!slug) return;

        const url = window.location.origin + window.location.pathname + '#' + slug;

        try {
          await navigator.clipboard.writeText(url);
          this.classList.add('copied');

          const self = this;
          setTimeout(function() {
            self.classList.remove('copied');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy link:', err);
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    initNavToggle();
    initTocObserver();
    initHeadingAnchorLinks();
  });
})();
`;

export function docsPageScript(): JSX.Element {
	return <script defer dangerouslySetInnerHTML={{__html: DOCS_PAGE_SCRIPT}} />;
}
