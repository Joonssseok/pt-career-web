# YouTube width and sharing controls

- Release requested on 2026-11-20: commit, push, merge, application deployment and a sanitized status-board entry. Exact release provenance is recorded on the status board after successful deployment.
- Removed business-card design/export controls from both sharing layouts. Link, QR and device sharing remain.
- Detail-introduction YouTube nodes support integer widthPercent values from 10 to 100, with a 100% default and reset. Rendering retains a 16:9 ratio and click-to-load behavior.
- Serialization omits unset width values; existing documents remain compatible. Read-only editor controls are disabled.
- Applied the presentation-only `youtube_video_width` validator extension to the existing database. Verified function grants, profile-version counts and full-row fingerprints were unchanged. Synthetic 55% accepted and 101% rejected. No profile content was saved or published for testing.
- YouTube renders the public thumbnail before playback, with a fallback play control if the image fails. No page referrer is sent with the thumbnail. The player is created only after a click, with autoplay permission and inline playback requested so a second click is unnecessary. Browser restrictions may still apply.
- Removed the duplicate workplace name/address from the detail tab and its unconditional decorating/coming-soon notice. Home workplace/map and existing contact actions remain; stored workplace data is unchanged.
- Validation: 61 tests across detail-document, YouTube node view, photo node view, profile template and sharing tools passed; TypeScript checks passed.
- Browser: actual thumbnail loaded; a single click started playback and advanced the elapsed time. Detail tab no longer shows either removed annotation. Test playback was stopped afterward.
- Browser: preview-only document changed from 100% to 55%, then 56% with the keyboard and back to 55%; editor and rendered result match. My Page retains URL/QR/Kakao controls without the business-card menu.
- Rollback SQL restores the previous validator; first remove optional YouTube width attributes from documents using the normal editor reset flow if any were subsequently saved. Do not silently remove user formatting.
