# Rotating Footer Taglines Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the static footer text with randomly selected taglines that change on each page load, with subtle visual styling.

**Architecture:** Add a taglines array constant, use `useState` with a random initial value (computed once on mount), and apply a classy gradient text effect with subtle decorative elements.

**Tech Stack:** React, Tailwind CSS, existing gradient utilities from globals.css

---

## Task 1: Add Rotating Taglines to Landing Page Footer

**Files:**
- Modify: `app/page.tsx` (lines 685-690)

**Step 1: Add taglines array constant**

Add after line 231 (after `exampleTests` array):

```tsx
// Footer taglines - randomly selected on each page load
const footerTaglines = [
  "Built for the curious. Designed for the relentless.",
  "For those who love AI — and love breaking it.",
  "Where AI meets its toughest critics.",
  "Break it. Document it. Master it.",
];
```

**Step 2: Add tagline state in LandingPage component**

Add inside `LandingPage` function (after line 511, before the return):

```tsx
// Randomly select a tagline on mount
const [tagline] = useState(() =>
  footerTaglines[Math.floor(Math.random() * footerTaglines.length)]
);
```

**Step 3: Update the footer section**

Replace lines 685-690 with:

```tsx
{/* Footer */}
<MotionWrapper>
  <footer className="text-center py-8">
    <p className="text-lg italic">
      <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
        "{tagline}"
      </span>
    </p>
    <div className="flex items-center justify-center gap-2 mt-3">
      <div className="h-px w-12 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
      <Sparkles className="h-3 w-3 text-purple-400/60" />
      <div className="h-px w-12 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
    </div>
  </footer>
</MotionWrapper>
```

**Design choices:**
- **Gradient text:** Uses purple-pink gradient matching the site's color scheme
- **Italic styling:** Adds elegance and distinguishes from body text
- **Quotation marks:** Frames the tagline as a motto/statement
- **Decorative element:** Subtle sparkle icon with gradient lines below, keeps it classy not flashy
- **Padding:** `py-8` gives breathing room

**Step 4: Verify the Sparkles icon is already imported**

Check line 16 - `Sparkles` is already imported from lucide-react. No additional imports needed.

**Step 5: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add rotating taglines to landing page footer

- Add 4 curated taglines that randomly display on page load
- Apply gradient text effect with italic styling
- Add subtle decorative element with sparkle icon

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Change | Description |
|--------|-------------|
| Taglines array | 4 curated taglines stored as constant |
| Random selection | `useState` with initializer function for one-time random pick |
| Visual styling | Gradient text (purple-pink), italic, quotation marks |
| Decorative element | Sparkle icon with gradient divider lines |
| Performance | No re-renders, selection happens once on mount |

**Visual Preview:**

```
                    "Break it. Document it. Master it."

              ──────────── ✨ ────────────
```
