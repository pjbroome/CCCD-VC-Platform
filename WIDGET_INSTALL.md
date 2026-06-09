# Virtual Consultation Widget — Install Guide (for Goldman Marketing Group)

Replaces the current **Smile Virtual** "Get a Virtual Consultation" widget on
destinationsmile.com with Charlotte Center for Cosmetic Dentistry's own portal.

**Portal URL (current):** `https://v0-kleon-samples.vercel.app`
*(A branded custom domain — e.g. `consult.destinationsmile.com` — will be provided before go‑live;
just swap the URL below when we send it. Everything else stays the same.)*

---

## Option A — Repoint the existing button (simplest, 1 line)
Change the current "GET A VIRTUAL CONSULTATION" header button's link to:

```
https://v0-kleon-samples.vercel.app/embed
```

Set it to open in the same tab or a new tab — your call. Done. The patient sees the
intake form; submissions flow straight into the practice dashboard.

## Option B — Floating widget (button + popup, recommended)
Paste this once, just before `</body>` on every page (or in the site‑wide footer):

```html
<script src="https://v0-kleon-samples.vercel.app/widget.js" async
        data-label="Virtual Consultation"
        data-color="#c4a052"
        data-position="bottom-right"></script>
```

This adds a floating **Virtual Consultation** button that opens the intake in a
centered popup on desktop and full‑screen on mobile. Options:
- `data-label` — button text (default "Virtual Consultation")
- `data-color` — brand color (default gold `#c4a052`)
- `data-position` — `bottom-right` (default) or `bottom-left`

### Make your existing header button open the popup (instead of a floating button)
With Option B's script installed, point any existing button/link at the modal:
```html
<a href="#virtual-consult">Get a Virtual Consultation</a>
```
…or add `data-cccd-vc` to any element. You can also auto‑open the popup on a landing
page by linking to `yourpage/?vc=open`.

---

## Notes
- **Mobile + desktop friendly**, no dependencies, no jQuery, ~4 KB.
- Loads `async` — does not block page rendering.
- The portal is HTTPS, the form is embedded in a sandboxed iframe; no patient data
  touches the WordPress site (it goes encrypted to the practice's secure backend).
- To remove the old Smile Virtual widget, delete its script/button per Smile Virtual's embed.

Questions: contact the practice's developer (this portal is maintained in‑house).
