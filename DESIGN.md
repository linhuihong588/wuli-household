---
name: "屋里"
description: "A calm, modern household-maintenance rhythm for families."
colors:
  pearl-background: "#eef1ec"
  pearl-surface: "#f8faf7"
  raised-white: "#ffffff"
  forest-ink: "#18352b"
  forest-accent: "#214d3d"
  forest-soft: "#dce9df"
  muted-sage: "#68736e"
  quiet-line: "#dfe5df"
  due-amber: "#ae7d3f"
  overdue-clay: "#9b4f42"
typography:
  display:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 600
    lineHeight: 1.28
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 520
    lineHeight: 1.28
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  field: "12px"
  nav-cell: "14px"
  surface: "16px"
  toast: "14px"
  sheet: "24px"
  frame: "28px"
  rhythm: "36px"
  circle: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  control: "15px"
  row: "17px"
  section-x: "20px"
  section-y: "27px"
components:
  button-primary:
    backgroundColor: "{colors.forest-accent}"
    textColor: "{colors.raised-white}"
    rounded: "{rounded.field}"
    padding: "15px"
    width: "100%"
  button-complete:
    backgroundColor: "transparent"
    textColor: "{colors.forest-accent}"
    rounded: "{rounded.circle}"
    size: "39px"
  button-icon:
    backgroundColor: "#e9efea"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.circle}"
    size: "42px"
  card-chore-list:
    backgroundColor: "{colors.raised-white}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.surface}"
  input-default:
    backgroundColor: "{colors.raised-white}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.field}"
    padding: "13px 14px"
  nav-bottom:
    backgroundColor: "rgba(253, 254, 252, 0.95)"
    textColor: "{colors.muted-sage}"
    height: "82px"
---

# Design System: 屋里

## Overview

**Creative North Star: "The Quiet Household Rhythm"**

屋里 turns recurring maintenance into a calm, perceptible family rhythm. The visual system feels like a contemporary Eastern home in soft daylight: cool pearl-gray rooms, restrained forest green, natural materials, crisp Chinese sans-serif typography, fine-line icons, and just enough curvature to feel humane.

This is an operating interface, not a productivity scoreboard. Information is prioritized by what deserves attention now; urgency remains legible without becoming accusatory. Warmth comes from domestic photography, family presence, and gentle completion feedback—not nostalgia, decoration, mascots, or gamification.

**Key Characteristics:**

- Mobile-first, single-column household workspace with persistent top and bottom navigation.
- Forest green is the sole interface accent; status colors appear only where meaning requires them.
- Low-saturation domestic photography supplies atmosphere while pearl surfaces preserve clarity.
- Rounded white containers, soft ambient shadows, and fine dividers create quiet hierarchy.
- Completion is tactile but restrained: circular controls, short transitions, and reversible confirmation.

## Colors

The palette combines cool pearl neutrals with one disciplined forest-green voice; amber and clay are semantic exceptions for due-state legibility.

### Primary

- **Household Forest:** The single brand and action accent for active navigation, primary actions, completion controls, progress surfaces, and positive state.
- **Soft Forest Mist:** A low-contrast support tint for selected halos, tags, previews, and gentle hover feedback.

### Secondary

- **Due Amber:** Reserved for chores approaching their due point; never used decoratively.
- **Overdue Clay:** Reserved for overdue copy; its muted warmth communicates attention without alarm.

### Neutral

- **Pearl Background:** The cool-gray outer canvas and page ground.
- **Pearl Surface:** The primary app-frame and chrome surface.
- **Raised White:** Cards, fields, and elevated content containers.
- **Forest Ink:** Primary text, preserving brand character without pure black.
- **Muted Sage:** Supporting copy, durations, inactive navigation, and metadata.
- **Quiet Line:** Hairline row separators, field borders, and timeline structure.

**The One Green Voice Rule.** Forest green owns brand, selection, and completion; do not introduce a competing decorative accent.

**The Humane Urgency Rule.** Amber and clay communicate state only. Keep them to small text or indicators rather than filling large surfaces.

## Typography

**Display Font:** Noto Sans SC Variable (with Noto Sans SC and system Chinese sans-serif fallbacks)  
**Body Font:** Noto Sans SC (with PingFang SC, Microsoft YaHei, and system sans-serif fallbacks)

**Character:** Contemporary Chinese sans-serif type keeps the product crisp and residential rather than corporate. Slightly tightened headline spacing adds quiet premium character; body text remains open and practical.

### Hierarchy

- **Display:** The large numeric time remaining inside the photographic hero. Use tabular numerals so changing values do not jitter.
- **Headline:** Screen and section titles, plus the hero sentence around its display numeral; keep lines compact and decisive.
- **Title:** Chore names and row-level primary labels.
- **Body:** Introductory and supporting copy, generally short and no wider than the mobile content column.
- **Label:** Metadata, status, navigation captions, and compact supporting values.

**The Number Carries the Moment Rule.** In the hero and progress summaries, make the changing number the strongest typographic event; surrounding copy stays quieter.

**The Calm Chinese Type Rule.** Use weight and spacing for hierarchy. Avoid ornamental display faces, all-caps styling, or novelty typography.

## Layout

The core is a mobile-first, single-column app frame. On phones it fills the viewport; persistent chrome uses a 72px top bar and 82px bottom navigation, with content padded clear of both. Sections use 20px horizontal gutters and approximately 27px vertical spacing. The home screen moves from atmospheric context to weekly rhythm to the actionable list, keeping the highest-value decision within the first scroll.

At 760px and wider, the mobile product is presented as a centered 500px-wide frame with a maximum working height near 920px, 28px outer rounding, and its own scrolling region. This framed desktop treatment is a preview of the mobile product, not a separate dense dashboard.

Layouts should remain portable to a future mini-program: prefer simple grid/flex composition, fixed navigation zones, native-feeling sheets, and a single vertical reading order. Safe-area padding is required for bottom chrome and sheets.

**The One-Hand Rhythm Rule.** Primary completion and creation controls must remain comfortably reachable and at least 39–42px in their shortest dimension.

**The Mobile Truth Rule.** Larger screens may frame the mobile workspace; they must not dilute it into multi-column productivity software without a new product decision.

## Elevation & Depth

Depth is a restrained hybrid of tonal layering, photographic overlap, and diffuse ambient shadow. White cards lift gently from pearl surfaces; persistent navigation uses translucent backgrounds with blur; the hero and weekly rhythm overlap to create the signature spatial transition. Shadows never become hard outlines or glossy floating panels.

### Shadow Vocabulary

- **Card Ambient:** A broad, low-opacity forest-tinted shadow for primary lists and settings containers.
- **Rhythm Lift:** A lighter downward shadow under the weekly rhythm panel.
- **Frame Ambient:** A broad shadow around the centered desktop app frame only.
- **Sheet Lift:** An upward shadow that separates a bottom sheet from its backdrop.
- **Toast Lift:** A compact, stronger shadow for transient confirmation above navigation.

**The Ambient-Only Rule.** Shadows suggest soft daylight and separation; never use sharp black shadows or elevation as ornament.

## Shapes

Geometry is restrained and softly residential. Standard cards use gently curved 16px corners, fields and primary buttons use 12px corners, and modal sheets use 24px top corners. Circular silhouettes are reserved for people, icon actions, completion controls, and rhythm markers. The signature hero uses a shallow curved lower edge that flows into the weekly rhythm panel; do not repeat this expressive curve on ordinary cards.

Borders are quiet and structural: thin separators organize dense rows, while most containers rely on tonal contrast and shadow. Fine-line icons should remain visually lighter than adjacent text.

**The Reserved Curve Rule.** Use standard radii for utility surfaces; reserve the large hero arc and full circles for signature or inherently circular elements.

## Components

### Buttons

- **Primary:** Full-width forest action with white, bold text, 12px corners, and 15px vertical padding. Disabled state lowers opacity and removes the active cursor.
- **Complete:** A 39px circular transparent control with a 1.5px forest stroke and bold check. Hover introduces only the soft forest tint; active state compresses to 97% scale.
- **Icon:** A 42px circular pearl-green utility button for creation and dismissal.
- **Focus:** All interactive controls receive a clearly visible 3px translucent forest outline with 2px offset.

### Chips

- **Style:** Compact status pills use soft forest fill, forest text, a full pill radius, and tight 6px by 9px padding.
- **State:** Use for household workload summaries and small positive classifications, not as decorative taxonomy.

### Cards / Containers

- **Corner Style:** Standard surfaces use 16px corners; sheets use larger top corners.
- **Background:** Raised white against pearl surface.
- **Shadow Strategy:** Broad and low-opacity, following Card Ambient.
- **Border:** Internal rows use a single quiet hairline separator; avoid boxing each row.
- **Internal Padding:** Rows typically use 14–18px, with 12px gaps between avatar, content, metadata, and action.

### Inputs / Fields

- **Style:** White fill, quiet 1px border, 12px corners, and 13px by 14px padding.
- **Focus:** Use the global forest focus ring; do not rely on color shift alone.
- **Error / Disabled:** Preserve layout and contrast; use semantic color only for actual errors and opacity only when the control is truly unavailable.

### Navigation

Top and bottom navigation are translucent pearl surfaces with subtle blur and hairline separation. Bottom navigation uses four equal destinations, 24px fine-line icons, and 10px labels. Active state changes to forest green, fills the icon where supported, and adds a short 2px underline; inactive destinations remain muted sage.

### Weekly Rhythm

Seven equal day cells sit across a fine horizontal line. Completed days become filled forest circles with checks, today grows slightly with a soft halo, and future days remain open quiet-line circles. The component communicates continuity, never streaks or competition.

### Bottom Sheet

Forms rise from a translucent forest backdrop and remain capped at 520px. The sheet uses large top corners, clear field grouping, safe-area-aware bottom padding, and a spring-like entrance. It closes through the explicit circular dismiss button or backdrop selection.

### Toast

Completion confirmation appears above bottom navigation as a compact deep-forest bar with white copy and a pale-green undo action. It is temporary, reversible, and does not interrupt the task flow.

## Do's and Don'ts

### Do:

- **Do** begin important household views with a plain-language state or recommended next action.
- **Do** use natural, low-saturation home photography to establish warmth while maintaining strong text contrast.
- **Do** keep forest green rare enough to preserve its meaning as the product's single visual voice.
- **Do** make completion fast, reversible, and visibly reflected in the shared rhythm.
- **Do** preserve visible focus, reduced-motion behavior, tabular changing numerals, and safe-area spacing.
- **Do** keep layouts and interactions straightforward enough to translate to mini-program primitives.

### Don't:

- **Don't** turn the product into a generic task dashboard, calendar grid, or metric-heavy control panel.
- **Don't** use guilt, alarm-red fills, streaks, badges, confetti, or competitive gamification.
- **Don't** introduce vintage paper, stamps, childish mascots, or ornamental Chinese styling to manufacture warmth.
- **Don't** add competing brand colors, gradients as decoration, or high-saturation imagery.
- **Don't** over-round every surface or repeat the hero's signature arc on utility components.
- **Don't** use hard black shadows, excessive borders, or dense nested cards.
