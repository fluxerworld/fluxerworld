# Theme authoring

Everything you need to add a Fluxer World theme that doesn't break in subtle ways.

## The mental model

Fluxer's CSS variables come in three layers:

1. **Structural tokens** — raw colours that *you*, the theme author, set:
   - `--background-*` (surfaces)
   - `--text-*` (text colours)
   - `--brand-primary` and friends (the accent hue)
   - `--border-color`

2. **Modifier tokens** — overlays that subtly tint surfaces (hover, selected, accent stripe). These have hsla() defaults in `styles/generated/color-system.css` baked at a fixed hue, so they **do not auto-follow your brand-primary**. If you leave them alone they'll clash with any non-default brand colour.

3. **Interactive tokens** — `--surface-interactive-hover-bg`, `--surface-interactive-selected-bg`, etc. Defined in `global.css` as `var(--background-modifier-hover)` and the like, so they cascade automatically. You **don't** override these — set the modifier tokens and the interactives follow.

## The required overrides

Set every one of these for a complete theme:

### Required overrides — complete list

The rule: **every token in `color-system.css` whose default contains `hsl(220, …)` must be overridden.** If you skip any, that surface leaks the cool-grey baseline through and you get a single neutral-grey patch in an otherwise themed app. Grouped by what they paint:

**Main content surfaces** (the bulk of the app's chrome):
```css
--background-primary
--background-secondary
--background-secondary-lighter   /* right pane + tabs row */
--background-secondary-alt
--background-tertiary
--background-channel-header      /* channel / friends title bar */
--background-header-primary
--background-header-primary-hover
--background-header-secondary
--background-textarea
```

**Server sidebar** (far-left vertical guild bar):
```css
--guild-list-foreground          /* its own token, doesn't cascade */
```

**User panel** (bottom-left widget with avatar + controls):
```css
--panel-control-bg           /* must override directly, see below */
--panel-control-border
--panel-control-divider
--panel-control-highlight
--user-area-divider-color
```

**Gotcha — color-mix() defaults**: `--panel-control-bg`'s default is `color-mix(in srgb, var(--background-secondary-alt) 80%, hsl(220, 13%, 2%) 20%)`. It looks like it cascades from your themed `--background-secondary-alt`, but the **other** input to the mix is a hardcoded `hsl(220, …)`. Result: the panel paints in a colour that's 80% your theme blended with 20% cool-grey-near-black — visibly off-hue from the rest of your theme. **Override `--panel-control-bg` directly with a final hex/hsl** so the color-mix never runs.

**Control buttons** (volume, settings, etc. — locked to hue 220 by default):
```css
--control-button-hover-bg
--control-button-active-bg
```

**Modifier overlays** (hover/selected/accent tint on surfaces):
```css
--background-modifier-hover
--background-modifier-selected
--background-modifier-accent
--background-modifier-accent-focus
```

**Borders**:
```css
--border-color
--border-color-hover
```

**The `--bg-*` family + secondary buttons + plutonium UI** (restore cascade from `--background-*`):
```css
--bg-primary           --bg-secondary           --bg-tertiary
--bg-hover             --bg-active              --bg-code
--bg-code-block        --bg-blockquote
--bg-table-header      --bg-table-row-odd       --bg-table-row-even
--button-secondary-fill --button-secondary-active-fill
--button-secondary-text --button-secondary-active-text
--button-outline-border --button-outline-active-border --button-outline-active-fill
--button-outline-text  --button-ghost-text
--button-inverted-fill --button-inverted-text
--control-button-normal-bg --control-button-normal-text
--control-button-hover-text --control-button-active-text
--markup-mention-border --markup-jump-link-fill
--plutonium --plutonium-hover --plutonium-text
--text-code --text-selection
--border-color-focus --invite-verified-icon-color
```

**Gotcha — `.theme-light` / `.theme-coal` break the cascade**: in the dark `:root` defaults these are written as `--bg-primary: var(--background-primary)`, etc. — so they cascade from your themed `--background-*` and you'd think you don't need to touch them. BUT `.theme-light` and `.theme-coal` redefine each with a hardcoded light/coal-specific value, *breaking* that cascade. If a user switches their built-in theme preference (Dark → Light, Coal, etc.) while your custom theme is applied, these 40+ tokens revert to the built-in theme's hardcoded values and your purple becomes a half-purple-half-light hybrid. Re-state the cascade in your custom theme (`--bg-primary: var(--background-primary)`, etc.) and your `--background-*` overrides propagate again.

**Text** (the muted/secondary shades are at hue 220 too — set them so muted text reads as faint-themed rather than faint-cool-grey):
```css
--text-primary
--text-secondary
--text-tertiary
--text-tertiary-muted
--text-tertiary-secondary
--text-primary-muted
--text-chat
--text-chat-muted
--text-link
```

**Brand + on-brand contrast**:
```css
--brand-primary
--brand-secondary
--brand-primary-light
--brand-primary-fill             /* contrast colour ON brand bg */
--text-on-brand-primary
```

**Quick way to find anything you missed**: pixel-sample the area in DevTools / a screenshot. If the colour resolves to `hsl(220, ~13%, X%)` you forgot a token. Common offenders are tokens that *look* like minor variants of ones you've already set (`-lighter`, `-secondary`, `-accent-focus`) but are separate hue-locked defaults.

### Modifier tokens — the gotchas
These look "automatic" but aren't, and they're the most common source of subtle breakage:
```css
--background-modifier-hover      /* default hsla(220, 13%, 100%, 0.04) */
--background-modifier-selected   /* default hsla(220, 13%, 100%, 0.10) */
--background-modifier-accent     /* default hsla(220, 13%, 80%, 0.15) */
```

If you only override `--background-primary` and `--brand-primary`, the hover/selected highlights still tint toward the default cool-grey hue. Looks fine for dark themes near the original palette. Falls apart for a violet or amber theme.

There are two valid patterns for modifier tokens, depending on what you want the highlight to feel like:

**Pattern A — neutral overlay** (use when your theme is intentionally low-chroma / "greyscale"):
```css
--background-modifier-hover:    rgba(255, 255, 255, 0.06);
--background-modifier-selected: rgba(255, 255, 255, 0.08);
--background-modifier-accent:   rgba(255, 255, 255, 0.05);
```
The highlight is *the surface beneath, lightened*. Works on any bg, pulls toward no hue, very subtle. This is what the built-in Dark theme does.

**Pattern B — brand-tinted overlay** (use when your theme has a strong brand hue and you want highlights to read as part of the family):
```css
/* Pick the same hue as your brand-primary, push saturation, low alpha */
--background-modifier-hover:    hsla(258, 50%, 70%, 0.08);
--background-modifier-selected: hsla(258, 60%, 70%, 0.16);
--background-modifier-accent:   hsla(258, 30%, 60%, 0.08);
```
The highlight is *the surface beneath, tinted toward brand*. Reads as a brighter step in the same colour family — not a stuck-on accent stripe. Use this when you've also tinted your surfaces (see next section).

**Do NOT use a solid hex here.** Many sidebar/list-item rules mix this token at 35% opacity *again* on top — solid hex compounded with transparency produces a visibly bright bar, not a subtle highlight.

### Surfaces should match the same logic

If you want a "cohesive purple theme" (or amber, or anything else), the *surfaces* themselves need to carry a desaturated version of your brand hue. Pure-grey surfaces with one purple highlight = the highlight reads as an island stuck on top. Surfaces at the same hue with low saturation = highlights read as a brighter step in the family.

Recipe: pick your brand hue, then build a lightness ladder. **Saturation needs to be 55-75% — not 25-30%.** At low lightness the eye doesn't register hue until saturation crosses ~40%; below that, your "purple-tinted" surface is indistinguishable from neutral grey. Discord can sit at 8-13% saturation because the *entire* interface is one cohesive low-chroma palette and there's no other hue to compare against; a branded theme with a saturated accent (e.g. `--brand-primary: #a98cf5`) needs surfaces saturated enough to feel like they belong to the same family.

```css
/* Hue stays constant. Saturation 55-75%. Lightness ladder for dark theme: */
--background-tertiary:  hsl(258, 75%,  9%);    /* deepest */
--background-primary:   hsl(258, 70%, 15%);
--background-secondary: hsl(258, 65%, 19%);
--background-textarea:  hsl(258, 55%, 24%);
--border-color:         hsl(258, 50%, 30%);    /* lightest still-not-a-control */
```

These read as visibly violet, not grey. If your theme feels "too vivid" once you've applied it whole-app, dial individual surfaces down by 10-15 points of saturation — but err on the high side. The bug pattern of users reporting "still looks grey, push the saturation higher" took five revisions of Midnight Violet to nail.

**Critical on brand contrast**: `--brand-primary-fill` and `--text-on-brand-primary` must be a contrast colour, not the same as `--brand-primary`. Otherwise:
- The "Add Friend" tab renders as a solid square with invisible label text
- Status badges (mention count, etc.) display the number in same-on-same
- Primary buttons across the app turn into blank rectangles

Use white (`#ffffff`) for dark accents, near-black for light accents.

## What cascades for free

Once the above are set, you do **not** need to touch:

- `--surface-interactive-hover-bg` (cascades from `--background-modifier-hover`)
- `--surface-interactive-selected-bg` (cascades from `--background-modifier-selected`)
- `--surface-interactive-selected-color` (cascades from `--text-primary`)
- `--form-surface-background` (cascades from `--background-tertiary` / `--background-primary`)
- Most message-bubble and emoji tokens (`--message-*`)

Overriding these directly is fine but usually unnecessary — adjust the structural token they pull from instead.

## Optional but recommended

If your theme has a strong personality you may also want:

- `--status-danger` — the red mention badge / destructive button. Default red works for almost any theme; only override if you genuinely want a different colour for danger states.
- `--status-online`, `--status-idle`, `--status-dnd`, `--status-offline` — presence dots. The defaults match Discord and most users expect them. Override at your own risk.
- `--font-sans`, `--font-mono` — typeface stack.

## Minimal complete example — Pattern B (brand-cohesive, recommended)

```css
:root {
	/* Main content surfaces — full ladder at hue 258. */
	--background-tertiary:           hsl(258, 75%,  9%);
	--background-primary:            hsl(258, 70%, 15%);
	--background-secondary:          hsl(258, 65%, 19%);
	--background-secondary-lighter:  hsl(258, 60%, 22%);
	--background-secondary-alt:      hsl(258, 70%, 17%);
	--background-channel-header:     hsl(258, 60%, 21%);
	--background-textarea:           hsl(258, 55%, 24%);
	--background-header-primary:     hsl(258, 65%, 19%);
	--background-header-primary-hover: hsl(258, 60%, 23%);
	--background-header-secondary:   hsl(258, 70%, 15%);

	/* Server sidebar, user panel, control buttons — own token families */
	--guild-list-foreground:         hsl(258, 60%, 18%);
	--panel-control-bg:              hsl(258, 60%, 14%);        /* override directly, default is a color-mix with hardcoded hsl(220, …) */
	--panel-control-border:          hsla(258, 50%, 65%, 0.45);
	--panel-control-divider:         hsla(258, 50%, 55%, 0.35);
	--panel-control-highlight:       hsla(0, 0%, 100%, 0.04);
	--user-area-divider-color:       hsla(258, 50%, 50%, 0.18);
	--control-button-hover-bg:       hsl(258, 50%, 25%);
	--control-button-active-bg:      hsl(258, 50%, 27%);

	/* Borders */
	--border-color:                  hsl(258, 50%, 30%);
	--border-color-hover:            hsla(258, 50%, 50%, 0.3);

	/* Inline code background */
	--bg-code:                       hsla(258, 65%, 15%, 0.8);

	/* Modifier overlays — brand-tinted, low alpha so they register over
	   the already-saturated surfaces. */
	--background-modifier-hover:    hsla(258, 70%, 75%, 0.12);
	--background-modifier-selected: hsla(258, 80%, 75%, 0.25);
	--background-modifier-accent:   hsla(258, 50%, 65%, 0.12);
	--background-modifier-accent-focus: hsla(258, 50%, 65%, 0.22);

	/* Brand — the actual saturated colour for primary buttons / accents. */
	--brand-primary: #a98cf5;
	--brand-secondary: #8b6ddf;
	--brand-primary-light: #c0a8ff;
	--brand-primary-fill: #ffffff;            /* contrast colour ON brand bg */
	--text-on-brand-primary: #ffffff;

	/* Text — every shade re-anchored at hue 258 with low sat */
	--text-primary: #e4e4f7;
	--text-secondary: hsl(258, 25%, 80%);
	--text-tertiary: hsl(258, 25%, 65%);
	--text-tertiary-muted: hsl(258, 25%, 56%);
	--text-tertiary-secondary: hsl(258, 25%, 52%);
	--text-primary-muted: hsl(258, 25%, 78%);
	--text-chat: hsl(258, 25%, 93%);
	--text-chat-muted: hsl(258, 25%, 78%);
	--text-link: #c0a8ff;
}
```

That's ~35 tokens. Anything less and one of these surfaces leaks through to default-grey: the right pane, the friends/channel title bar, the server sidebar bar, the user panel widgets, the volume/settings buttons, focus rings, inline code, or muted text.

## Pre-flight checklist before submitting

Test your theme by clicking through these in the app:
- [ ] Switch to the Friends tab — the "Add Friend" button label reads cleanly on the accent bg
- [ ] Open a DM — the sidebar item highlight is subtle (not a solid accent bar)
- [ ] Hover an unselected sidebar item — the hover colour matches the rest of the theme palette
- [ ] Send a message that mentions someone — the @-mention pill background reads on the message bubble
- [ ] Open Settings → any tab — section titles, body text, and inputs all read at WCAG-AA contrast
- [ ] Receive a notification — the unread badge counter on the channel/guild reads clearly
- [ ] Right-click a message — context menu text on its surface reads clearly

If you'd rather start from a working theme: open the app, Appearance → custom theme accordion, click **Load current theme into editor**, then edit values from there.

## Submitting

[fluxer.world/submit-theme](https://fluxer.world/submit-theme) — fills out the JSON entry and opens an email. We review and add to `webroot/themes.json`, then `node scripts/mint-gallery-themes.cjs` re-mints the S3 files. Deterministic IDs (sha256 of `gallery:<slug>` → first 16 hex) so updates overwrite cleanly.
