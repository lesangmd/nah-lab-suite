# 2026-11-01 UI / document export corrective branch (NOT RELEASED)

This branch is derived from Windows source baseline **v1.3.28 / Web v1.58.58**. The screenshot of the deployed Android app says Web **v1.58.59**. Do **not** deploy this older Web artifact over the running v1.58.59 plugin.

Fix: preserve two signature columns THƯ KÝ (left) and CHỦ TỌA (right) in Sổ giao ban A4 and DOCX. Fix DOCX converter to preserve generic three-column `.form-signatures` for ISO/2429 reports. This does not constitute a visual QA of all 83 templates.

Fix: Android no longer forces immersive fullscreen, its status/navigation icons stay visible, light login status bar matches mint background, and Android API 35+ uses root insets. No package-name, storage, offline DB or signing changes.

QA required: Web v1.58.59 source rebase; DOCX/PDF layout samples for all 38 ISO and 45 QĐ 2429 templates; Android status bar tests (light/dark, rotation, keyboard, devices API 29/34/35+); full signing and rollback QA. Production update remains HOLD.
