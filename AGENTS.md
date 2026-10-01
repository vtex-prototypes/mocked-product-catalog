# Agent instructions

Agents are who use this repo. Follow this before loading products into a prototype or generating a photo.

## Consume

Read [CONSUMING.md](CONSUMING.md) and answer both questions before picking products: which store or categories, and which fields each screen shows.

The repo is public. Load it by URL in the preview:

```js
const BASE = "https://raw.githubusercontent.com/vtex-prototypes/mocked-product-catalog/main/";
```

Fetch `${BASE}catalog.json` and prefix `src` with `BASE`. `src` is `images/<id>/<file>.webp`. Leave the photos where they are. Copying them into the prototype's `public/` folder makes a second copy that goes stale.

Use published products. `drafts/` photos are not compliant. If a chosen category has no published products, stop. Open a `content:` pull request that promotes the drafts (regenerated white PNG, `npm run backgrounds`, `npm run check`) and point the prototype at the raw URLs. Do not copy `drafts/` into the prototype, and do not repaint a draft photo.

## Contribute

Open a PR to `vtex-prototypes/mocked-product-catalog` when you generate something that meets the spec below. A compliant product, variant, or extra photo belongs here, not only in the prototype's `public/` folder. Leave a rough fixture in the prototype when it does not meet the spec.

There are two kinds of contribution. Each PR is one or the other.

- **Content**: what the catalog holds. A promoted draft (same `id` and `categoryId`, images regenerated from `drafts/<id>.jpg`, both draft files deleted). A new product, a new variant, or another photo of an existing one. A category in `categories.json`, a brand in `brands.json`, or a specification value in `specifications.json`, each with `en` and `pt-BR` names. Content PRs touch `products/`, `images/`, `drafts/`, `categories.json`, `brands.json`, `specifications.json`, and the regenerated `catalog.json` and `drafts.json`.
- **Framework**: how the catalog works. The schema, the validator and its rules, the scripts, the build, CI, the image spec, the PR template, and these instructions. Framework PRs do not add or change products.

When you need both, open two PRs. Merge the framework PR first, then open the content PR that uses it. A new field on products, for example, is a framework PR that adds it to the schema and validator, followed by a content PR that fills it in. Start the PR title with `content:` or `framework:`.

A brand is optional. Leave `brandId` out, and leave it out of the name, when the product has none. A tomato does not need one. When it has one, add the brand once to `brands.json` and set `brandId`. Never use a trademark or a real brand name, in the brand, the name, description, tags, or alt text, or as a logo or label in the photo.

A value that should match across products goes in `specifications.json` once, with `en` and `pt-BR`. Material and capacity are product specifications. A shared option such as apparel size uses `specificationId` and `valueId` instead of copying the label. Color stays on the product, because the hex belongs to that photo. Write a new value into `specifications.json` when an existing one would be a stretch. The listing name stays the product's own words.

Work on a branch. Generate the white PNG with the prompt in the README, with the draft photo attached when you are promoting one. Run `npm run backgrounds`, then `npm run check`. `check` writes the WebP beside the PNG and rebuilds `catalog.json`. Commit the PNG and the WebP. The PNG stays the source.

Open the PR with `gh pr create` and fill in the template. Confirm by eye: no shadow, no text, no logo, no trademark.

Regenerate a photo that fails the white-edge check. Cutting the background out by hand produces a worse image. Paint extra background colors with `npm run backgrounds`; that pass is cheap. Keep the white PNG as the original.
