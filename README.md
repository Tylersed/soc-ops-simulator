# SOC Ops Simulator (GitHub Pages)
**A polished, security-forward SOC workflow simulator** you can host on GitHub Pages as a portfolio project.

This is *not* a hacking toolkit. It’s a blue-team simulation designed to demonstrate:
- Alert triage discipline (status, severity, notes, timeline)
- Case management workflows (linked alerts, timeline, notes, priority)
- Log exploration + pivoting (toy query language, “pivot to alert”)
- Defensive analyst tools (email header parsing, URL defang/refang, hashing, base64, reputation simulation)
- Strong UI/UX in a no-build, static site (great for classes + interviews)

Everything runs **locally in the browser**. No network calls. State is stored in `localStorage`.

---

## Quick Start (GitHub Pages)
1. Create a repo (example: `soc-ops-simulator`)
2. Upload the contents of this folder to the repo root
3. Go to **Settings → Pages**
4. Under **Build and deployment**, set:
   - Source: **Deploy from a branch**
   - Branch: **main** / **root**
5. Save — your site will publish at your GitHub Pages URL.

---

## Keyboard Shortcuts
- `Ctrl/⌘ + K` → Command palette
- `G` → Toggle alert generator
- `/` → Focus alert search

---

## Query Tips
Use field:value pairs in the sidebar or log explorer:
- `severity:high`
- `source:"Entra ID"`
- `user:tyler`
- `host:LAB-UBU`

Operators supported: `AND`, `OR`, `NOT` (simple left-to-right parsing).

---

## Safe Usage Notes
- Don’t paste real sensitive emails, customer info, or secrets
- Tools are defensive / analysis only
- The “reputation” tool is a toy offline list (for demos)

---

## Repo Structure
```
/
  index.html
  css/styles.css
  js/app.js
  js/components.js
  js/data_seed.js
  js/utils.js
```

---

## Ideas to Level It Up (Roadmap)
- Add a “Phishing triage” guided wizard page
- Add “MITRE heatmap” view (tactic/technique counts)
- Add exportable incident report PDF (client-side)
- Add unit tests (Vitest) + CI workflow
- Add a separate `/api` folder for a future Python backend (optional)

---

## License
MIT
