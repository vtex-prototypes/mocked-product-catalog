# Agent instructions

Agents are who use this repo. Follow this before loading products into a prototype or generating a photo.

## Consume

Read [CONSUMING.md](CONSUMING.md) and answer both questions before picking products: which store or categories, and which fields each screen shows.

The repo is public. Load it by URL in the preview:

```js
const BASE = "https://raw.githubusercontent.com/vtex-prototypes/mocked-product-catalog/main/";
```

Fetch `${BASE}catalog.json` and prefix `src` with `BASE`. `src` is `images/<id>/<file>.webp`. Leave the photos where they are. Copying them into the prototype's `public/` folder makes a second copy that goes stale.

Use published products. `drafts/` photos are not compliant. If a chosen category has no published products, say so and narrow the prototype, or promote the drafts with a PR here first.

## Contribute

Open a PR to `vtex-prototypes/mocked-product-catalog` when you generate something that meets the spec below. A compliant product, variant, or extra photo belongs here, not only in the prototype's `public/` folder. Leave a rough fixture in the prototype when it does not meet the spec.

A contribution is one of these:

- A promoted draft: same `id` and `categoryId`, images regenerated from `drafts/<id>.jpg`, and both draft files deleted.
- A new product, a new variant, or another photo of an existing one.
- A category added to `categories.json`, with `en` and `pt-BR` names.

Use a fictional brand. Never use a trademark or a real brand name, in `brand`, in the name, description, tags, or alt text, or as a logo or label in the photo. `Casa Norte`, `Fio Puro`, `Trilha Livre`, `Altitude`, and `Ritmo` are already in the catalog. Invent another one the same way.

Work on a branch. Generate the white PNG with the prompt in the README, with the draft photo attached when you are promoting one. Run `npm run backgrounds`, then `npm run check`. `check` writes the WebP beside the PNG and rebuilds `catalog.json`. Commit the PNG and the WebP. The PNG stays the source.

Open the PR with `gh pr create` and fill in the template. Confirm by eye: no shadow, no text, no logo, no trademark.

Regenerate a photo that fails the white-edge check. Cutting the background out by hand produces a worse image. Paint extra background colors with `npm run backgrounds`; that pass is cheap. Keep the white PNG as the original.
