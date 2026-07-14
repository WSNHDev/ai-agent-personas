# AI Agent Personas — Design System

This document is the implementation contract extracted from the approved concept screens in `design/concepts/`.

## Visual direction

- Editorial fantasy-tech: a quiet dark reading room crossed with a precise developer tool.
- True ink-black background, warm-white typography, hairline antique-gold structure and one electric-violet action color.
- Open rails, bands and ruled workspaces instead of generic card grids or nested rounded panels.
- Persona identity is expressed through original heraldic line sigils and one restrained color per archetype.
- Motion is limited to line reveals, focus transitions and subtle selection changes. Reduced-motion users receive no decorative motion.

## Tokens

| Role | Value |
| --- | --- |
| Background | `#08090B` |
| Raised surface | `#0E1115` |
| Warm text | `#F1EDE3` |
| Muted text | `#A8A49D` |
| Gold | `#C59A52` |
| Gold dim | `#8A6B3A` |
| Violet | `#7C3AED` |
| Violet bright | `#9B6BFF` |
| Teacher | `#8DAA45` |
| Catgirl | `#D67BA6` |
| Yandere | `#C5443C` |
| Wizard | `#8E5AC7` |
| Detective | `#D3A34F` |
| Butler | `#75B89F` |
| Knight | `#79A8DD` |

Typography uses Cormorant Garamond for display and editorial titles, Inter for UI and prose, and JetBrains Mono for prompt and CLI output. Display headings stay high-contrast with tight line-height; controls use deliberate 14–16 px sizing rather than browser defaults.

## Component families

- `SiteHeader`: brand shield, essential navigation, language switch.
- `Hero`: copy column plus one functional prompt-preview workspace.
- `PersonaSigil`: shared shield geometry with persona-specific central symbol and color.
- `PersonaRail`: open, ruled horizontal list; selected state adds a single outline.
- `PromptWorkbench`: language/intensity controls, compiled prompt, copy/download actions.
- `IntensityBand`: three comparable columns; `balanced` is selected by default.
- `PrincipleList`: numbered open rows with small line icons.
- `CommandBand`: mono command with copy action.

## Layout and responsive rules

- Desktop content width: 1480 px maximum with 32–56 px gutters.
- First viewport: quiet header, two-column hero and visible start of the seven-persona rail.
- Catalogue section varies rhythm: wide rail followed by one ruled intensity band.
- Persona detail uses identity header followed by a 30/70 principle/workbench split.
- Below 900 px, all workspaces become one column; persona rails scroll horizontally with visible overflow cue.
- Below 640 px, gutters become 20 px, display headings scale down, and primary actions remain full-width and visible.

## Above-the-fold copy lock

- `AI Agent Personas`
- `Personas`
- `How it works`
- `CLI`
- `GitHub`
- `EN / RU`
- `Open-source persona library for AI agents`
- `Give your agent a voice worth remembering.`
- `Seven original, safety-aware personas. Bilingual by design. Ready for any LLM.`
- `Explore the personas`
- `Install the CLI`
- `npx ai-agent-personas list`
- `Detective`
- `Balanced`
- `English`
- `Copy prompt`

The approved eyebrow is plain editorial text, not a badge. No additional kicker, badge, metric, testimonial, model logo, decorative pill, gradient or glow may be added above the fold.

## Icon inventory

- Brand: shield with a serif `A` and one small star.
- Teacher: open book.
- Catgirl: cat ears and bow.
- Yandere: heart crossed by a blade, presented non-graphically.
- Wizard: pointed hat over an open book.
- Detective: hat and magnifying glass.
- Butler: bow tie and lapels.
- Knight: upright sword and shield.
- Utility: copy, download, globe, balance scale and chevron; all use consistent 1.5–2 px rounded strokes.

## Hero media treatment

There is no photography or color overlay. The interactive prompt workspace and sigils are the hero media. Surface color remains near-black and is separated only by gold rules, subtle texture and controlled elevation.
