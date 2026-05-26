# Fluxer World — Themeable CSS Variables (complete reference)

Every CSS variable the app reads, grouped by what it paints. Paste this into Claude with "build me a [theme description] theme using these tokens" and it'll produce a complete `:root {}` block.

Notes:
- All variables below are defined in `src/styles/generated/color-system.css`. The defaults shown are for the dark `:root` block; light/coal themes redefine many.
- For modifier tokens (`--background-modifier-*`), use `rgba(...)` or `hsla(...)` with low alpha — many sidebar/list rules already mix them at 35% opacity, so solid hex values compound to bright bars.
- The `--bg-*` family is auto-cascaded from `--background-*` in the dark theme but **`.theme-light` and `.theme-coal` break the cascade** with hardcoded values. If you want your theme to look right when a user picks the Light/Coal built-in theme on top of your custom CSS, re-state the cascade explicitly (`--bg-primary: var(--background-primary);` etc.).
- `--brand-primary-fill` and `--text-on-brand-primary` must be a CONTRAST color to `--brand-primary` (typically white on dark accents, near-black on light accents). Otherwise the "Add Friend" button and mention badges render as solid blocks with invisible text.

## Surfaces — main content

These paint the bulk of the app's chrome. Sidebar, content area, channel list, message panel, modals, headers.

- **`--background-primary`** — Main app background (sidebar inside guilds, message area in some contexts).
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 5%)`
- **`--background-secondary`** — Secondary surface — DM/channel sidebar background.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 11.18%)`
- **`--background-secondary-lighter`** — Right pane / friends content area / tabs row. Easy to miss; gallery themes have to set this.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 13.22%)`
- **`--background-secondary-alt`** — Alternative surface for nested chrome (settings sidebar, etc.).
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 15.11%)`
- **`--background-tertiary`** — Deepest surface — the very dark areas behind sidebars on some layouts.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 18.44%)`
- **`--background-channel-header`** — Channel / friends view title bar. Easy to miss.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 16.85%)`
- **`--background-textarea`** — Message composer / input field background.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 23.85%)`
- **`--background-header-primary`** — Top window header / channel header strip.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 20.75%)`
- **`--background-header-primary-hover`** — Hover state on the channel header.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 25.53%)`
- **`--background-header-secondary`** — Secondary header band.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 20.75%)`

## Modifier overlays (hover/selected tints)

Translucent overlays that tint surfaces. Use rgba/hsla with low alpha — many sidebar/list rules already 35%-mix these, so solid hex compounds incorrectly.

- **`--background-modifier-hover`** — Hover overlay on most list items.
    Default: `hsla(220, calc(13% * var(--saturation-factor)), 100%, 0.05)`
- **`--background-modifier-selected`** — Selected overlay (current channel / current DM).
    Default: `hsla(220, calc(13% * var(--saturation-factor)), 100%, 0.1)`
- **`--background-modifier-accent`** — Accent separator/stripe overlay (e.g. on dividers).
    Default: `hsla(220, calc(13% * var(--saturation-factor)), 80%, 0.15)`
- **`--background-modifier-accent-focus`** — Focused state of accent stripes.
    Default: `hsla(220, calc(13% * var(--saturation-factor)), 80%, 0.22)`

## Server sidebar

The far-left vertical bar showing your guild icons. Own token family — doesn't cascade from --background-*.

- **`--guild-list-foreground`** — The strip behind the guild icons. The picker had a TYPO on this name forever (--guild_list-foreground with underscore); fixed.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 17.93%)`

## User panel (bottom-left widget)

Avatar + username + mic/sound/settings buttons. Has its own token family.

- **`--panel-control-bg`** — Background of the user panel container. Now mostly redundant since UserArea was switched to paint from --background-secondary, but still respected.
    Default: `color-mix( in srgb, var(--background-secondary-alt) 80%, …`
- **`--panel-control-border`** — Border around user panel widgets.
    Default: `hsla(220, calc(30% * var(--saturation-factor)), 65%, 0.45)`
- **`--panel-control-divider`** — Divider lines inside the panel.
    Default: `hsla(220, calc(30% * var(--saturation-factor)), 55%, 0.35)`
- **`--panel-control-highlight`** — Internal highlight strip.
    Default: `hsla(0, 0%, 100%, 0.04)`
- **`--user-area-divider-color`** — The line between user panel and the list above it.
    Default: `color-mix(in srgb, var(--background-modifier-hover) 70%, …`

## Control buttons (volume / mic / settings rows)

The icon buttons in the user panel.

- **`--control-button-normal-bg`** — Resting background (usually transparent).
    Default: `transparent`
- **`--control-button-normal-text`** — Resting icon color.
    Default: `var(--text-primary-muted)`
- **`--control-button-hover-bg`** — Hover background.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 22%)`
- **`--control-button-hover-text`** — Hover icon color.
    Default: `var(--text-primary)`
- **`--control-button-active-bg`** — Pressed/active background.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 24%)`
- **`--control-button-active-text`** — Pressed/active icon color.
    Default: `var(--text-primary)`
- **`--control-button-danger-text`** — Destructive button text (e.g. leave call red).
    Default: `hsl(1, calc(77% * var(--saturation-factor)), 60%)`
- **`--control-button-danger-hover-bg`** — Hover background on destructive buttons.
    Default: `hsl(1, calc(77% * var(--saturation-factor)), 20%)`

## Brand (your accent color)

The primary accent. Buttons, badges, the Plutonium upsell.

- **`--brand-primary`** — The accent. Used everywhere primary buttons / links / highlights land.
    Default: `hsl(242, calc(70% * var(--saturation-factor)), 55%)`
- **`--brand-secondary`** — Darker brand (pressed/active states).
    Default: `hsl(242, calc(60% * var(--saturation-factor)), 49%)`
- **`--brand-primary-light`** — Lighter brand (used on dark surfaces).
    Default: `hsl(242, calc(100% * var(--saturation-factor)), 84%)`
- **`--brand-primary-fill`** — Contrast color on brand backgrounds — must be readable on --brand-primary (typically white for dark themes, near-black for light themes).
    Default: `hsl(0, 0%, 100%)`
- **`--text-on-brand-primary`** — Same idea, text color on brand backgrounds.
    Default: `hsl(0, 0%, 98%)`

## Status (presence dots)

Online/idle/dnd/offline on user avatars. Convention is to leave these as the standard green/yellow/red/grey so people recognize them across themes.

- **`--status-online`** — Green dot.
    Default: `hsl(142, calc(76% * var(--saturation-factor)), 40%)`
- **`--status-idle`** — Yellow dot.
    Default: `hsl(45, calc(93% * var(--saturation-factor)), 50%)`
- **`--status-dnd`** — Red dot.
    Default: `hsl(0, calc(84% * var(--saturation-factor)), 60%)`
- **`--status-offline`** — Grey dot.
    Default: `hsl(218, calc(11% * var(--saturation-factor)), 65%)`
- **`--status-danger`** — Destructive accent (mention badges, danger states).
    Default: `hsl(1, calc(77% * var(--saturation-factor)), 55%)`
- **`--status-warning`** — Warning accent.
    Default: `var(--status-idle)`

## Text

Font colors. Each shade has a specific role.

- **`--text-primary`** — Main text on dark backgrounds. Usernames, message body.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 96%)`
- **`--text-secondary`** — Secondary text (timestamps, subtle UI).
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 89.1%)`
- **`--text-tertiary`** — Tertiary text (placeholders, faint hints).
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 64.71%)`
- **`--text-tertiary-muted`** — Muted tertiary (even fainter).
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 55.52%)`
- **`--text-tertiary-secondary`** — Another tertiary shade for cascading hierarchies.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 52%)`
- **`--text-primary-muted`** — Muted primary (sidebar item idle state).
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 78.18%)`
- **`--text-chat`** — Body text inside messages.
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 93.15%)`
- **`--text-chat-muted`** — Muted body text (system messages, deletes).
    Default: `hsl(220, calc(13% * var(--saturation-factor)), 78.18%)`
- **`--text-link`** — Hyperlink color.
    Default: `hsl(210, calc(100% * var(--saturation-factor)), 70%)`
- **`--text-warning`** — Text color for warnings.
    Default: `hsl(45, calc(93% * var(--saturation-factor)), 55%)`
- **`--text-code`** — Inline code text color.
    Default: `hsl(340, calc(50% * var(--saturation-factor)), 90%)`
- **`--text-selection`** — Text selection background (highlight when you select text).
    Default: `hsla(210, calc(90% * var(--saturation-factor)), 70%, 0.35)`

## Interactive

Generic interactive color slots used by various icon buttons.

- **`--interactive-muted`** — Muted interactive (faint icon resting state).
    Default: `color-mix( in oklab, hsl(228, calc(10% * var(--saturation…`
- **`--interactive-active`** — Active interactive (lit icon).
    Default: `color-mix( in oklab, hsl(0, calc(0% * var(--saturation-fa…`

## Borders

Lines + outlines.

- **`--border-color`** — Default borders / dividers.
    Default: `hsla(220, calc(13% * var(--saturation-factor)), 50%, 0.2)`
- **`--border-color-hover`** — Borders on hover (subtly lighter).
    Default: `hsla(220, calc(13% * var(--saturation-factor)), 50%, 0.3)`
- **`--border-color-focus`** — Focus ring color (typically brand-primary).
    Default: `hsla(210, calc(90% * var(--saturation-factor)), 70%, 0.45)`

## Accent slots (used by alerts/admonitions)

Semantic colors for note/tip/important/warning/caution blocks in markdown.

- **`--accent-primary`** — Primary accent slot.
    Default: `var(--brand-primary)`
- **`--accent-success`** — Success/positive (green).
    Default: `var(--status-online)`
- **`--accent-warning`** — Warning (yellow/orange).
    Default: `var(--status-idle)`
- **`--accent-danger`** — Danger/destructive (red).
    Default: `var(--status-dnd)`
- **`--accent-info`** — Info (blue).
    Default: `var(--text-link)`
- **`--accent-purple`** — Purple accent.
    Default: `hsl(270, calc(80% * var(--saturation-factor)), 65%)`
- **`--alert-note-color`** — Markdown note block accent.
    Default: `hsl(210, calc(100% * var(--saturation-factor)), 70%)`
- **`--alert-tip-color`** — Markdown tip block accent.
    Default: `hsl(142, calc(76% * var(--saturation-factor)), 45%)`
- **`--alert-important-color`** — Markdown important block accent.
    Default: `hsl(270, calc(80% * var(--saturation-factor)), 65%)`
- **`--alert-warning-color`** — Markdown warning block accent.
    Default: `hsl(45, calc(93% * var(--saturation-factor)), 55%)`
- **`--alert-caution-color`** — Markdown caution block accent.
    Default: `hsl(359, calc(75% * var(--saturation-factor)), 60%)`

## Mention & jump-link pills

@-mention pills inside messages, plus jump-to-message links.

- **`--markup-mention-text`** — Text on a @-mention pill.
    Default: `var(--text-link)`
- **`--markup-mention-fill`** — Background of a @-mention pill.
    Default: `color-mix(in srgb, var(--text-link) 20%, transparent)`
- **`--markup-mention-border`** — Border of a @-mention pill.
    Default: `hsla(210, calc(100% * var(--saturation-factor)), 70%, 0.3)`
- **`--markup-interactive-hover-text`** — Hover text on interactive markdown elements.
    Default: `var(--text-link)`
- **`--markup-interactive-hover-fill`** — Hover fill.
    Default: `color-mix(in srgb, var(--text-link) 30%, transparent)`
- **`--markup-everyone-text`** — @-everyone pill text.
    Default: `hsl(250, calc(80% * var(--saturation-factor)), 75%)`
- **`--markup-everyone-fill`** — @-everyone pill background.
    Default: `color-mix(in srgb, hsl(250, calc(80% * var(--saturation-f…`
- **`--markup-everyone-border`** — @-everyone pill border.
    Default: `hsla(250, calc(80% * var(--saturation-factor)), 75%, 0.3)`
- **`--markup-here-text`** — @-here pill text.
    Default: `hsl(45, calc(90% * var(--saturation-factor)), 70%)`
- **`--markup-here-fill`** — @-here pill background.
    Default: `color-mix(in srgb, hsl(45, calc(90% * var(--saturation-fa…`
- **`--markup-here-border`** — @-here pill border.
    Default: `hsla(45, calc(90% * var(--saturation-factor)), 70%, 0.3)`
- **`--markup-jump-link-text`** — Jump-to-message pill text.
    Default: `var(--text-link)`
- **`--markup-jump-link-fill`** — Jump-to-message pill background.
    Default: `color-mix(in srgb, var(--text-link) 12%, transparent)`
- **`--markup-jump-link-hover-fill`** — Jump-to-message pill hover.
    Default: `color-mix(in srgb, var(--text-link) 20%, transparent)`

## Buttons

Button surfaces by variant. Primary = brand, Secondary = neutral, Outline = bordered, Inverted = high-contrast, Danger = destructive, Ghost = transparent.

- **`--button-primary-fill`** — Primary button background (usually brand).
    Default: `hsl(139, calc(55% * var(--saturation-factor)), 44%)`
- **`--button-primary-active-fill`** — Primary button pressed.
    Default: `hsl(136, calc(60% * var(--saturation-factor)), 38%)`
- **`--button-primary-text`** — Primary button text.
    Default: `hsl(0, 0%, 100%)`
- **`--button-secondary-fill`** — Secondary button background.
    Default: `hsla(0, 0%, 100%, 0.1)`
- **`--button-secondary-active-fill`** — Secondary button pressed.
    Default: `hsla(0, 0%, 100%, 0.15)`
- **`--button-secondary-text`** — Secondary button text.
    Default: `hsl(0, 0%, 100%)`
- **`--button-secondary-active-text`** — Secondary button pressed text.
    Default: `var(--button-secondary-text)`
- **`--button-danger-fill`** — Danger button background.
    Default: `hsl(359, calc(70% * var(--saturation-factor)), 54%)`
- **`--button-danger-active-fill`** — Danger button pressed.
    Default: `hsl(359, calc(65% * var(--saturation-factor)), 45%)`
- **`--button-danger-text`** — Danger button text.
    Default: `hsl(0, 0%, 100%)`
- **`--button-danger-outline-border`** — Danger outline border.
    Default: `1px solid hsl(359, calc(70% * var(--saturation-factor)), …`
- **`--button-danger-outline-text`** — Danger outline text.
    Default: `hsl(0, 0%, 100%)`
- **`--button-danger-outline-active-fill`** — Danger outline pressed background.
    Default: `hsl(359, calc(65% * var(--saturation-factor)), 48%)`
- **`--button-danger-outline-active-border`** — Danger outline pressed border.
    Default: `transparent`
- **`--button-ghost-text`** — Ghost button text (no background).
    Default: `hsl(0, 0%, 100%)`
- **`--button-inverted-fill`** — Inverted button background (high contrast).
    Default: `hsl(0, 0%, 100%)`
- **`--button-inverted-text`** — Inverted button text.
    Default: `hsl(0, 0%, 0%)`
- **`--button-outline-border`** — Outline button border.
    Default: `1px solid hsla(0, 0%, 100%, 0.3)`
- **`--button-outline-text`** — Outline button text.
    Default: `hsl(0, 0%, 100%)`
- **`--button-outline-active-fill`** — Outline button pressed background.
    Default: `hsla(0, 0%, 100%, 0.15)`
- **`--button-outline-active-border`** — Outline button pressed border.
    Default: `1px solid hsla(0, 0%, 100%, 0.4)`

## Markdown surfaces (--bg-* family)

Used by code blocks, blockquotes, tables, inline code. .theme-light/.theme-coal break the cascade for these — gallery themes restore it with var() chains.

- **`--bg-primary`** — Default markdown surface — cascades from --background-primary.
    Default: `var(--background-primary)`
- **`--bg-secondary`** — Secondary markdown surface — cascades from --background-secondary.
    Default: `var(--background-secondary)`
- **`--bg-tertiary`** — Tertiary markdown surface — cascades from --background-tertiary.
    Default: `var(--background-tertiary)`
- **`--bg-hover`** — Hover surface inside markdown.
    Default: `var(--background-modifier-hover)`
- **`--bg-active`** — Active surface inside markdown.
    Default: `var(--background-modifier-selected)`
- **`--bg-code`** — Inline code background — has the most complex default; usually override directly.
    Default: `hsla(220, calc(13% * var(--saturation-factor)), 15%, 0.8)`
- **`--bg-code-block`** — Fenced code block background.
    Default: `var(--background-secondary-alt)`
- **`--bg-blockquote`** — Blockquote background.
    Default: `var(--background-secondary-alt)`
- **`--bg-table-header`** — Table header row.
    Default: `var(--background-tertiary)`
- **`--bg-table-row-odd`** — Odd table row.
    Default: `var(--background-primary)`
- **`--bg-table-row-even`** — Even table row.
    Default: `var(--background-secondary)`

## Scrollbars

Browser scrollbar thumb + track.

- **`--scrollbar-thumb-bg`** — Scrollbar thumb at rest.
    Default: `rgba(121, 122, 124, 0.4)`
- **`--scrollbar-thumb-bg-hover`** — Scrollbar thumb on hover.
    Default: `rgba(121, 122, 124, 0.7)`
- **`--scrollbar-track-bg`** — Scrollbar track.
    Default: `transparent`

## Spoilers

The black/grey overlay before you click a spoiler.

- **`--spoiler-overlay-color`** — Resting spoiler overlay.
    Default: `rgba(0, 0, 0, 0.2)`
- **`--spoiler-overlay-hover-color`** — Hovered spoiler overlay.
    Default: `rgba(0, 0, 0, 0.3)`

## Plutonium (premium UI)

The Plutonium upsell pages + premium-only highlights.

- **`--plutonium`** — Primary Plutonium accent (usually brand).
    Default: `var(--brand-primary)`
- **`--plutonium-hover`** — Plutonium hover color.
    Default: `var(--brand-secondary)`
- **`--plutonium-text`** — Text color on Plutonium surfaces.
    Default: `var(--text-on-brand-primary)`
- **`--plutonium-icon`** — Plutonium icon color.
    Default: `hsl(38, calc(92% * var(--saturation-factor)), 50%)`
- **`--invite-verified-icon-color`** — Verified server badge icon color.
    Default: `var(--text-on-brand-primary)`

## Fonts

Typeface stack overrides. Use full font-family declarations.

- **`--font-sans`** — Sans-serif stack (e.g. 'Inter', sans-serif).
    Default: `(varies by theme)`
- **`--font-mono`** — Monospace stack (e.g. 'JetBrains Mono', monospace).
    Default: `(varies by theme)`

## Submitting

Once you have a complete CSS block, head to [`fluxer.world/submit-theme`](https://fluxer.world/submit-theme), paste the CSS, fill in name/author/description/swatches, and hit Publish. Goes live in the gallery immediately.

Total themeable variables: **125**.
