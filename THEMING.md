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

### Surfaces
```css
--background-primary
--background-secondary
--background-secondary-alt
--background-tertiary
--background-header-primary
--background-header-secondary
--background-textarea
```

### Modifier tokens — the gotchas
These look "automatic" but aren't, and they're the most common source of subtle breakage:
```css
--background-modifier-hover      /* default hsla(220, 13%, 100%, 0.04) */
--background-modifier-selected   /* default hsla(220, 13%, 100%, 0.10) */
--background-modifier-accent     /* default hsla(220, 13%, 80%, 0.15) */
```

If you only override `--background-primary` and `--brand-primary`, the hover/selected highlights still tint toward the default cool-grey hue. Looks fine for dark themes near the original palette. Falls apart for a violet or amber theme.

**Use transparent white (or black) as overlay, not solid hex.** The default Dark theme sets these to `hsla(..., 100%, 0.1)` — semi-transparent white at low opacity. That way the highlight is *the surface beneath, lightened* — it works on any underlying bg, doesn't pull toward any hue, and produces the "barely-there" effect users expect.

Recommended values for a dark theme:
```css
--background-modifier-hover:    rgba(255, 255, 255, 0.06);
--background-modifier-selected: rgba(255, 255, 255, 0.08);
--background-modifier-accent:   rgba(255, 255, 255, 0.05);
```

For a light theme, invert (use `0, 0, 0` instead).

**Do NOT use a solid hex here**, even if it visually "looks right" in isolation. Many sidebar/list-item rules mix this token at 35% opacity again on top — solid hex compounded with transparency produces a visibly tinted bar, not a subtle highlight. (See [the Friends sidebar bug](https://github.com/fluxerworld/fluxerworld/commit/0722c559) for what this looks like in practice.)

### Brand / accent
```css
--brand-primary
--brand-secondary
--brand-primary-light
--brand-primary-fill           /* text colour ON brand-primary backgrounds */
--text-on-brand-primary        /* same idea, used by status badges / primary buttons */
```

**Critical**: `--brand-primary-fill` and `--text-on-brand-primary` must be a contrast colour, not the same as `--brand-primary`. Otherwise:
- The "Add Friend" tab renders as a solid square with invisible label text
- Status badges (mention count, etc.) display the number in same-on-same
- Primary buttons across the app turn into blank rectangles

Use white for dark accents, near-black for light accents.

### Text
```css
--text-primary
--text-secondary
--text-tertiary
--text-primary-muted          /* alias used by sidebar items */
--text-link
```

### Border
```css
--border-color
```

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

## Minimal complete example

```css
:root {
	/* Surfaces */
	--background-primary: #1a1424;
	--background-secondary: #241830;
	--background-secondary-alt: #1f1428;
	--background-tertiary: #11091a;
	--background-textarea: #2e1f3c;
	--background-header-primary: #241830;
	--background-header-secondary: #1a1424;

	/* Modifier tokens — these are the gotchas. USE TRANSPARENT WHITE,
	   NOT SOLID HEX. Many list-item rules already mix these at 35%
	   opacity on top of the underlying surface; a solid hex compounds
	   with that transparency and produces a tinted bar instead of the
	   subtle highlight users expect. */
	--background-modifier-hover: rgba(255, 255, 255, 0.06);
	--background-modifier-selected: rgba(255, 255, 255, 0.08);
	--background-modifier-accent: rgba(255, 255, 255, 0.05);

	/* Brand */
	--brand-primary: #a98cf5;
	--brand-secondary: #8b6ddf;
	--brand-primary-light: #c0a8ff;
	--brand-primary-fill: #ffffff;
	--text-on-brand-primary: #ffffff;

	/* Text */
	--text-primary: #e4e4f7;
	--text-secondary: #b8b3d4;
	--text-tertiary: #8b86a8;
	--text-primary-muted: #b8b3d4;
	--text-link: #c0a8ff;

	/* Border */
	--border-color: #3a2a55;
}
```

23 tokens. Anything less and you'll hit at least one of: invisible label text, mismatched hover hues, the selected-state purple-bar look, or unreadable buttons.

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
