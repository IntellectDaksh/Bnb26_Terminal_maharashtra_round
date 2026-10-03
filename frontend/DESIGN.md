# Design decisions (v2, light editorial)

1. **Direction:** editorial, Swiss, architectural. Typography, photography and whitespace carry the page; no decoration.
2. **Type:** Inter only. Display headings bold, tracking -0.045em, line-height 0.92 (`.display`). Small uppercase metadata (`.eyebrow`). Tabular numbers (`.num`).
3. **Palette:** bg `#F3F0E9`, bg-2 `#EAE6DE`, surface `#FAF9F6`, text `#111`, muted `#66645F`, borders `#D8D4CC`, success `#4C8A63` / `#DDE9DF`, danger `#B84C4C`. Black primary buttons. Nothing else.
4. **Radius:** 6px small, 8px buttons/inputs, 12px cards.
5. **Spacing:** desktop gutters 56px, sections 96-128px; mobile gutters 20px.
6. **Photography:** Unsplash venue/audience shots in `public/photos`, warmed and desaturated with `.photo` filter. Used large, never as decoration behind decoration.
7. **Brand:** partial-circle mark (queue in progress) + "Fair Drop" wordmark.
8. **Motion:** 150-250ms opacity/translate (`.rise`), three-dot loading, one pulsing live dot. Off under reduced motion.
9. **Ticket:** surface card, dashed perforation with punched notches, real QR (qrcode.react) encoding the ticket id only.
10. **Avoided:** gradients, glow, glass, neon, big shadows, icon grids, emoji, spinner-only loading. One deviation: the registration divider reads "then", not "or", because Google sign-in is required, not an alternative to the form.
