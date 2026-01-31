# Premium Tagline V2 - Apple/Luxury Aesthetic

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the landing page tagline into a premium, confident, Apple-ad-style statement with subtle glow and breathing presence.

**Architecture:** Remove moving shimmer animation, replace with static text-shadow glow and optional slow opacity breathing. Bold typography with generous spacing.

**Tech Stack:** CSS, Tailwind CSS

---

## Task 1: Replace Shimmer CSS with Premium Glow Effect

**File:** `app/globals.css`

**Action:** Replace the entire "PREMIUM METALLIC SHIMMER EFFECT" section (lines 458-499) with:

```css
/* ========================================
   PREMIUM TAGLINE - APPLE/LUXURY AESTHETIC
   ======================================== */

/* Premium text with subtle emerald/cyan glow */
.premium-tagline {
  color: #f1f5f9; /* slate-100 - crisp white-ish */
  text-shadow:
    0 0 20px rgba(52, 211, 153, 0.3),
    0 0 40px rgba(34, 211, 238, 0.2),
    0 0 60px rgba(52, 211, 153, 0.1);
  animation: breathe 4s ease-in-out infinite;
}

/* Subtle breathing animation - creates presence */
@keyframes breathe {
  0%, 100% {
    opacity: 0.9;
    text-shadow:
      0 0 20px rgba(52, 211, 153, 0.3),
      0 0 40px rgba(34, 211, 238, 0.2),
      0 0 60px rgba(52, 211, 153, 0.1);
  }
  50% {
    opacity: 1;
    text-shadow:
      0 0 25px rgba(52, 211, 153, 0.4),
      0 0 50px rgba(34, 211, 238, 0.25),
      0 0 80px rgba(52, 211, 153, 0.15);
  }
}
```

**Design rationale:**
- **Text color:** `#f1f5f9` (slate-100) - pure, clean, premium white
- **Glow colors:** Emerald (`#34d399`) + Cyan (`#22d3ee`) - matches brand
- **Glow layers:** 3 layers at 20/40/60px blur - soft, diffused halo
- **Breathing:** Opacity 0.9→1.0 + slight glow intensification - barely perceptible but creates "alive" presence
- **Duration:** 4 seconds - slow, luxurious, not distracting

---

## Task 2: Update Footer with Premium Styling

**File:** `app/page.tsx`

**Replace lines 697-706 with:**

```tsx
{/* Footer */}
<MotionWrapper>
  <footer className="text-center py-24">
    <p className="text-2xl md:text-3xl font-semibold tracking-wider premium-tagline">
      {tagline}
    </p>
  </footer>
</MotionWrapper>
```

**Key styling choices:**
- `py-24` - generous vertical padding (from py-16), lets tagline command attention
- `text-2xl md:text-3xl` - larger, more impactful (from text-xl md:text-2xl)
- `font-semibold` - bold, confident weight (from font-light)
- `tracking-wider` - wide letter-spacing, lets letters breathe
- `premium-tagline` - applies the glow + breathing effect
- **Removed:** divider-gradient line (looks cheap per feedback)

---

## Summary

| Element | Before | After |
|---------|--------|-------|
| Font weight | `font-light` | `font-semibold` |
| Font size | `text-xl md:text-2xl` | `text-2xl md:text-3xl` |
| Letter spacing | `tracking-wide` | `tracking-wider` |
| Text color | Gradient (slate-200) | Solid slate-100 |
| Effect | Moving shimmer animation | Static glow + subtle breathing |
| Glow | None | Emerald/cyan multi-layer text-shadow |
| Breathing | None | 0.9→1.0 opacity over 4s |
| Vertical padding | `py-16` | `py-24` |
| Divider | Gradient line | Removed |

**Visual Preview:**
```

                    Break it. Document it. Master it.
                         ⟨soft emerald/cyan halo⟩
                      ⟨barely perceptible breathing⟩


```

**The vibe:** Confident. Powerful. Exclusive. Like it belongs on a Tesla billboard or Apple keynote.
