# MindMelt Beta v1.3 — Calendar Refresh Bugfix

Flat deploy-safe static build.

Fixes in this build:
- Full month calendar now refreshes date keys before calculating day counts.
- Calendar day cards count all open dated obligations across Calendar, Tasks, Notes, Ideas, Recommendations, and Brain Dump.
- Day detail pages show all dated items for that day, including completed items for context.
- Weekday parsing is smarter: plain “Thursday” maps to the closest upcoming Thursday, including today; “next Thursday” maps to the following week.
- Older beta entries without dateKey values are repaired automatically when Calendar opens.
- Kept notification support, MindMelt M icon, time setter, subtle blue entry-bar glow, and deploy-safe static setup.

Deploy:
- Upload every file in this zip directly to the repo root.
- Build command: blank.
- Publish directory: root / `/`.
