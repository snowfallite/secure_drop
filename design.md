
## **Liquid Glass UI — iOS 26 (Dark Mode‑Focused, Muted Palette)**

### **CORE LIQUID GLASS PROPERTIES**

* Frosted glass surfaces with 20–40% transparency and strong backdrop blur (`backdrop‑filter: blur(40px)`).
* Subtle gradient overlays at 5–10% opacity to enhance layered depth.
* Smooth, flowing border curves with 16–24 px radius.
* Multi‑layered glass panels with soft, diffused shadows to create depth.
* Light refraction through surfaces produces delicate tonal shifts.
* Ultra‑smooth animations (300–600 ms) with custom cubic‑bezier easing for fluid transitions.

### **VISUAL HIERARCHY**

* **Background:** deep dark surface (#000000 / #0A0A0A) providing maximum contrast.
* Glass cards float above the background with semi‑transparent blur.
* Floating elements feel suspended in a subtle 3D space.
* Micro‑interactions emphasize liquid‑like motion and responsive feedback.

### **COLOR SYSTEM**

* **Primary accents:** cool deep blue (#0A3A6B) for interactive highlights.
* **Secondary accents:** muted soft purple (#7A5FA2) for secondary emphasis.
* Use color sparingly — allow transparency and blur to dominate.
* **Data indicators:** gentle teal‑green (#4EB88B) for positive trends; warm subdued red (#D44A4A) for negative.
* **Text:** high contrast — near‑white on dark glass at ~90% opacity.

### **TYPOGRAPHY**

* **Headlines:** SF Pro Display, weight 600–700.
* **Body text:** SF Pro Text, weight 400–500.
* Font sizes: 11–14 px (body), 20–34 px (headlines).
* Slight negative letter spacing on large text; line height 1.4–1.6 for readability over blur.

### **LAYOUT PRINCIPLES**

* 16–24 px internal padding in glass panels.
* 12–16 px spacing between cards.
* Modular grid — cards snap to columns with intentional, elegant asymmetry.
* Content “floats” rather than fills space, preserving breathable structure.

### **INTERACTIVE ELEMENTS**

* **Buttons:** semi‑transparent glass with 8 px padding; hover/focus increases opacity by ~10%.
* **Cards:** lift and deepen shadow on hover (2 px upward translation).
* **Inputs:** transparent with bottom border; focus adds subtle glow border.
* **Switches/Toggles:** fluid morphing animations upon toggle.

### **SPECIAL EFFECTS**

* Low‑opacity noise texture (2–3%) for material realism.
* Inner shadows give depth perception within panels.
* Soft, nearly invisible gradient backgrounds (3–5% opacity) add atmospheric depth.
* Implied light source from top‑left casting gentle highlights.

### **DATA VISUALIZATION**

* Charts integrate seamlessly into glass surfaces.
* Gradient fills at ~40% opacity under curves.
* Glass‑separated treemap cells with subtle boundaries.
* Real‑time data transitions animate gradually (no abrupt jumps).

### **COMPONENT EXAMPLES**

* **Calendar widget:** glass card with current date highlighted in accent color.
* **Status cards:** centered icon + text for states like “No Data.”
* **Mini charts:** line graphs with subtle gradient fills.
* **Metric cards:** large figures with percentage changes in muted color pills.

### **DARK MODE GUIDELINES**

* **Background:** pure or near‑pure black (#000000 / #0A0A0A).
* Glass opacities lower (15–25% white overlay with heavy blur) to enhance contrast.
* Glow effects around bright elements are soft and controlled.
* Accent colors appear deeper and more cohesive against dark surfaces.

### **AVOID**

* Heavy, harsh shadows — use soft, diffused shadows only.
* Solid opaque card backgrounds; preserve translucency.
* Sharp corners (minimum 12 px radius).
* Cluttered layouts or overly saturated colors.
