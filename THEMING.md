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

Recipe: pick your brand hue, then build a lightness ladder at low saturation:

```css
/* Hue stays constant. Saturation 22-30%. Lightness ladder for dark theme: */
--background-tertiary:  hsl(258, 35%,  7%);   /* deepest */
--background-primary:   hsl(258, 30%, 11%);
--background-secondary: hsl(258, 28%, 15%);
--background-textarea:  hsl(258, 28%, 19%);
--border-color:         hsl(258, 25%, 22%);   /* lightest still-not-a-control */
```

The surfaces look "almost grey" but with a perceivable hue cast — exactly how Discord's blue-grey or Slack's purple-grey work.

(See commit-history for the gallery themes after this advice landed — the Midnight Violet bug where the Friends row read as a stuck-on highlight was because the surfaces were too low-saturation to register as violet, so the highlight looked like an island.)

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

## Minimal complete example — Pattern B (brand-cohesive, recommended)

```css
:root {
	/* Surfaces — same hue (258 / violet) across the lightness ladder.
	   Saturation low enough to read as desaturated brand, not as solid colour. */
	--background-tertiary:        hsl(258, 35%,  7%);
	--background-primary:         hsl(258, 30%, 11%);
	--background-secondary:       hsl(258, 28%, 15%);
	--background-secondary-alt:   hsl(258, 30%, 13%);
	--background-textarea:        hsl(258, 28%, 19%);
	--background-header-primary:  hsl(258, 28%, 15%);
	--background-header-secondary: hsl(258, 30%, 11%);

	/* Modifier overlays — same hue, low alpha, push saturation a bit
	   so the tint registers when 35%-mixed by sidebar/list rules. */
	--background-modifier-hover:    hsla(258, 50%, 70%, 0.08);
	--background-modifier-selected: hsla(258, 60%, 70%, 0.16);
	--background-modifier-accent:   hsla(258, 30%, 60%, 0.08);

	/* Brand — the actual saturated colour for primary buttons / accents. */
	--brand-primary: #a98cf5;
	--brand-secondary: #8b6ddf;
	--brand-primary-light: #c0a8ff;
	--brand-primary-fill: #ffffff;            /* contrast colour ON brand bg */
	--text-on-brand-primary: #ffffff;

	/* Text */
	--text-primary: #e4e4f7;
	--text-secondary: #b8b3d4;
	--text-tertiary: #8b86a8;
	--text-primary-muted: #b8b3d4;
	--text-link: #c0a8ff;

	/* Border — same hue, lifted lightness. */
	--border-color: hsl(258, 25%, 22%);
}
```

Anything less and you'll hit at least one of: invisible label text, mismatched hover hues, highlights that look stuck-on, or unreadable buttons.

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
