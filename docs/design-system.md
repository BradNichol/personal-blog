# Personal site design system

This is the visual and content contract for Bradley Nichol’s personal site. Read it before changing any HTML, CSS, copy, imagery, or interaction under `public/`.

## Thesis

The site is a dark editorial notebook for a backend engineer: technical work is central, while mountains, trail running, camping, photography, weather, and light provide the surrounding atmosphere.

The site should feel deliberate, quiet, tactile, and useful. It is a personal digital space first, a technical work log second, and a product showcase when there is a current build worth explaining.

## Source of truth

- `public/styles.css` is the implementation source of truth for tokens, layout, typography, motion, and responsive behaviour.
- This document is the source of truth for the meaning and boundaries of those choices.
- Keep the two aligned when an intentional design decision changes. Prefer reusing an existing CSS variable over creating a one-off value.
- `public/prototype/`, when present, is a throwaway exploration area. It is not the production source of truth.

## Tokens

Use the existing custom properties in `public/styles.css` rather than hardcoding values in page markup or new selectors.

| Token | Current value | Role |
| --- | --- | --- |
| `--night` | `#131a18` | Page canvas and deep background |
| `--paper` | `#e8e9dd` | Primary text and high-contrast content |
| `--muted` | `#9eaba2` | Supporting copy and metadata |
| `--acid` | `#d9ef72` | Primary signal: active state, emphasis, links, selected text |
| `--orange` | `#e56e4b` | Secondary field mark: numbering, symbols, small directional cues |
| `--line` | `#46534b` | Structural dividers |
| `--line-soft` | `#334039` | Quiet row and list dividers |
| `--serif` | `Instrument Serif` | Editorial section headings and product model names |
| `--sans` | `DM Sans` | Hero, navigation, body copy, and functional headings |
| `--mono` | `DM Mono` | Labels, dates, status, metadata, navigation details |
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | Shared expressive transition curve |

The palette is intentionally small. Use `--acid` as the dominant accent and `--orange` sparingly. New colours require an explicit design decision because additional accents weaken the signal/noise hierarchy.

## Typography

The three typefaces have distinct jobs:

- `DM Sans` carries the engineering identity: hero headline, navigation, body copy, list titles, and functional headings.
- `Instrument Serif` adds the editorial voice: section headings, product model names, and reflective closing copy.
- `DM Mono` supplies the technical instrumentation: labels, timestamps, statuses, numbering, tags, and compact navigation text.

Keep the type hierarchy strong and sparse. Use large display scale, tight leading, and negative tracking for major headings. Supporting copy should remain short and readable rather than becoming a second headline.

The Google Fonts import in the page `<head>` must include these families and their current weights. If font loading changes, retain the CSS fallbacks and verify the layout at both desktop and mobile widths.

## Composition

- Treat the first viewport as a poster: brand, promise, and one strong visual anchor should be clear before scrolling.
- Use asymmetry, scale, whitespace, alignment, and dividers to create hierarchy.
- The shell uses generous gutters and a wide content limit; preserve the existing `1550px` maximum and responsive gutter behaviour unless the composition genuinely requires a change.
- Prefer cardless sections, columns, lists, media blocks, and rules. A bordered panel should only appear when it represents a meaningful interaction or model boundary.
- Give every section one job and one dominant idea. Remove decoration before adding another visual device.
- Use real photography for narrative context. Images should support the story, not act as generic texture or compete with the copy.

## Page architecture

The homepage has four distinct responsibilities:

1. **Hero** — establish Bradley’s backend engineering identity and connect the work to his interests in trail running, camping, mountains, and photography.
2. **Current build** — explain RotationLab as a mobile application for runners. Its core model is `Shoe / Gear`; activity evidence, attribution, and mileage history are supporting concepts. This is a stable product spotlight, not an activity feed.
3. **Recent Work** — display the latest technical work as a compact, data-driven stream. Keep it conceptually separate from RotationLab and do not turn it into a product dashboard.
4. **Afterword / contact** — close with a short personal line and a clear channel to contact Bradley.

The contact page inherits the same site shell, tokens, typography, links, and tone.

## Content boundaries

- Write in plain, specific product language. Let the headline carry the meaning and keep supporting copy to one short paragraph where possible.
- Keep technical work visible and primary; personal interests should add context, not become competing navigation or a separate portfolio section.
- RotationLab is about shoe and gear analytics for runners. Describe it as the analytical layer for shoe rotation and informed decisions, not as an activity-feed product.
- `Recent Work` may eventually include learning or research notes, but it remains a chronological story of work rather than the product itself.
- Do not add a photography page, gallery, or outdoor-content section unless explicitly requested.

## Copy and tone of voice

Write in a straightforward, conversational, understated voice.

The site should sound like a real software engineer talking about what he builds and thinks about — not a consultancy, agency, startup landing page, or LinkedIn personal brand.

### Prefer

- Plain language over polished marketing language.
- “Building” over “coding” where it better describes the work.
- Curiosity over certainty.
- Concrete descriptions of work over self-applied labels.
- Short, natural sentences.
- Mildly dry or understated phrasing where it fits.
- Honest language about work in progress, learning, experimentation, and changing ideas.
- Letting the work demonstrate qualities like pragmatism and technical depth rather than explicitly claiming them.
- AI as a tool or way of working, not as an identity or branding pillar.

Good examples:

- “I build software and care how it’s put together.”
- “Backend engineering, design, side projects, and things I’m learning as I build.”
- “What I’ve been working on lately.”
- “The things I’m building and figuring out as I go.”
- “I’m building a better way to keep track of running shoes.”

### Avoid

- Corporate, consultancy, or agency language.
- Personal-brand slogans.
- Thought-leadership language.
- Overstating expertise or presenting opinions as grand engineering principles.
- Unnecessary jargon when ordinary language works.
- Turning simple concepts into abstract product or architecture language.
- AI hype or phrases that imply AI is the product when it is simply part of the development process.

Avoid phrases in the style of:

- “Pragmatic builder”
- “Clean code advocate”
- “Engineering excellence”
- “Thoughtful conversations”
- “Grounded in evidence”
- “Survives contact with production”
- “Open a channel”
- “Latest signal”
- “Developer intelligence”
- “AI-powered” unless the fact that AI powers the feature is genuinely important to the user

### Editorial language

A small amount of distinctive editorial language is fine where it suits the design, particularly around photography, running, or personal material.

Labels such as `FIELD NOTE 004` can stay. Do not extend those motifs across the whole site: a visual detail should remain a detail rather than becoming a vocabulary system of signals, channels, or field intelligence.

### Voice check

Before adding or changing copy, ask:

> Would Bradley naturally say something close to this when explaining it to another developer?

If it sounds impressive but not natural, simplify it.

The goal is not casualness for its own sake. Copy should still feel considered and technically credible, without sounding written by a marketing team.

## Interaction and accessibility

Motion should create presence and hierarchy, not fill space. Preserve the existing restrained marquee, image hover, list-row hover, and entrance reveal patterns. New motion should be short, purposeful, and consistent with `--ease`.

Every interactive element must retain a visible `:focus-visible` treatment using `--acid`. Keep semantic headings, meaningful image alt text, readable contrast, and the existing `prefers-reduced-motion` override intact.

## Change checklist

Before considering a public-site change complete:

1. Read this contract and inspect the existing component/selector before adding a new pattern.
2. Reuse the existing tokens, type roles, spacing rhythm, and section structure.
3. Check both the desktop and mobile composition in a browser; visual changes are not covered by unit tests alone.
4. Run `node --test` and `git diff --check`.
5. If the design language itself changes, update this document and the CSS tokens in the same change, and explain the decision in the PR.
