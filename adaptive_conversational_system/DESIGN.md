---
name: Adaptive Conversational System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434656'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#747688'
  outline-variant: '#c4c5d9'
  surface-tint: '#124af0'
  primary: '#0040e0'
  on-primary: '#ffffff'
  primary-container: '#2e5bff'
  on-primary-container: '#efefff'
  inverse-primary: '#b8c3ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#993100'
  on-tertiary: '#ffffff'
  tertiary-container: '#c24100'
  on-tertiary-container: '#ffece6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c3ff'
  on-primary-fixed: '#001356'
  on-primary-fixed-variant: '#0035be'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59b'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#812800'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  gutter: 1rem
  margin-mobile: 1.25rem
---

## Brand & Style
The design system is centered on the concept of "Efficient Empathy." It balances the precision of a high-performance tool with the warmth of a helpful assistant. The aesthetic follows a **Modern Corporate** style with **Minimalist** influences, prioritizing clarity and reducing cognitive load through generous whitespace and a restricted color palette. 

The interface should feel airy and responsive, using subtle transitions rather than heavy ornaments to guide the user. The goal is to evoke a sense of reliability and intelligence while remaining entirely approachable for daily tasks.

## Colors
The palette is anchored by **Electric Blue**, a vibrant and energetic primary color used for key actions, brand moments, and user-initiated chat states. 

- **Primary (Electric Blue):** Used for primary buttons, active states, and user message bubbles to signify agency.
- **Secondary (Soft Slate):** Used for secondary text and icons to provide hierarchy without visual noise.
- **Neutrals:** A range of cool, soft grays (Slate 50 to 200) defines the interface structure, system message bubbles, and input areas.
- **Whitespace:** Pure white is used for the main background to maximize contrast and maintain a "clean" feel.

## Typography
This design system utilizes **Plus Jakarta Sans** for all levels to ensure a modern, geometric, yet friendly appearance. The typeface's open counters and clean terminals make it highly legible on mobile screens.

- **Headlines:** Use Bold and Semi-Bold weights with slight negative letter-spacing for a compact, professional look.
- **Body:** Use the 15px/16px size for chat bubbles to balance readability with information density.
- **Labels:** Use Medium and Semi-Bold for metadata like timestamps, names, and button text to provide clear distinction from conversational text.

## Layout & Spacing
The layout follows a **fluid-to-fixed** model optimized for mobile-first interaction. 

- **Grid:** On mobile, a standard 4-column layout is used with a 20px (1.25rem) side margin.
- **Chat Flow:** Messages are aligned to the edges (User on right, AI on left). The spacing between messages in a cluster is 4px, while spacing between different speakers is 16px.
- **Input Area:** The message composer is pinned to the bottom, using a fixed height or expanding vertically up to 4 lines before scrolling internally.
- **Safe Areas:** Strict adherence to mobile safe areas (notch and home indicator) is required, with the bottom input container providing a background bleed.

## Elevation & Depth
Depth is created through **Tonal Layering** and **Soft Ambient Shadows** to maintain a clean, modern look without the heaviness of traditional skeuomorphism.

- **Base Layer:** The main chat background is flat white (#FFFFFF).
- **Surface Layer:** The bottom input bar and header use a subtle 1px border (#F1F5F9) and a very soft shadow (0px 4px 12px rgba(0,0,0,0.03)) to appear slightly above the scrollable content.
- **Floating Elements:** Action buttons or "Scroll to bottom" indicators use a more pronounced shadow (0px 8px 24px rgba(46, 91, 255, 0.15)) to denote high interactivity.
- **Interactions:** Avoid heavy inner shadows; use 10% opacity overlays (Primary Color on White) for pressed states.

## Shapes
The shape language is **Rounded**, conveying friendliness and approachability. 

- **Chat Bubbles:** AI bubbles use a standard 1rem (16px) radius on all corners, except the bottom-left which is 4px. User bubbles use a 1rem radius, with a 4px radius on the bottom-right.
- **Input Fields:** The text entry area uses a fully pill-shaped design (2rem radius) to invite interaction.
- **Cards/Modules:** Rich media cards (images, links) within the chat should use a consistent 1rem radius to match the bubble language.

## Components
### Buttons
- **Primary:** Electric Blue background with White text. Pill-shaped.
- **Ghost:** No background, Blue text. Used for "Cancel" or secondary actions.

### Chat Bubbles
- **User:** Electric Blue background, White text. Aligned Right.
- **AI/System:** Soft Gray (#F1F5F9) background, Dark Slate text. Aligned Left.
- **Typing Indicator:** Three animated dots inside a standard AI bubble.

### Input Field
- A pill-shaped container with a "Plus" icon for attachments on the left and a "Send" arrow (Electric Blue) on the right. Placeholder text should be in Soft Slate (#94A3B8).

### Chips/Quick Replies
- Horizontal scrolling list of buttons above the input field. Light gray border, 14px text, and pill-shaped. These vanish once one is tapped or a message is sent.

### Lists
- For data responses, use clean rows with 1px dividers. Use a chevron icon on the right if the item is tappable.