# Tiptap official Simple Editor

Source: https://github.com/ueberdosis/tiptap-ui-components
Commit: 799929bea4804c73767562b69f8acc2acdb8ac86
License: MIT (LICENSE retained).

Official Simple Editor toolbar/components copied from the public repository. Adapted to the existing introduction JSON adapter, scoped styling, existing font, and the profile draft document. Image/link/code/task-list/superscript controls are omitted because the introduction format does not allow those nodes. The additional size/color selectors retain existing introduction controls. Application-owned adapters connect validated documents to existing owner-checked draft storage; the independent development preview remains write-free.

Detail-introduction mode now adds application-owned media nodes (JPEG/PNG/WebP/GIF/MP4/WebM references and YouTube IDs). Only this mode enables file/YouTube controls. Uploads reuse the private, owner-checked existing detail-media workflow. Introduction mode retains its closed text-only format. Media node React views are app adapters; toolbar components remain official MIT source.
