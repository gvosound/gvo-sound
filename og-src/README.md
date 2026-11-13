# Link previews

The image, title and description apps show when someone shares a GVO link.

- `build.cjs` draws one 1200 × 630 preview per page, product and song into `/og`, and writes `/og/pages.json`.
- Page headlines and photos are in `PAGES` at the top of `build.cjs`. Titles and descriptions come from `META` in `index.html`; products and songs come from `PRODUCTS`, `PHOTOS` and `REL` there.
- `src/` holds photos used only in previews: a still from the recording studio walkthrough and a frame from GVO's party reel.
- `functions/[[path]].js` serves the clean links (gvosound.com/events, /shop/worker-jacket, /music/holy-father) with each page's preview, then hands the browser the normal /#page. Which paths it handles is set in `_routes.json`.

`EXTRA` in `build.cjs` holds previews for pages outside the main site (the team form at /team/). Those pages carry their own og tags.

Rebuild after adding a product, a song or a page, or after changing a headline:

```sh
cd og-src && npm install && npm run build
```

To redraw one preview only: `ONLY=team npm run build`. Then commit `/og`. Apps keep an old preview for a while; a fresh conversation usually shows the new one.
