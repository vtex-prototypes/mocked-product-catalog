# Agent instructions

Agents are who use this repo. Follow this before loading products into a prototype or generating a photo.

## Consume

Follow [CONSUMING.md](CONSUMING.md). Answer both of its questions before picking products: which store or categories, and which fields each screen shows. It has the loading code and the rule for categories that have no published products yet.

Load with `loader.js` from a versioned jsDelivr URL (`@1`, or an exact `@1.0.0` when the data must not move), never from `main`. When the prototype needs different data, pass `overrides` to `loadCatalog`. Do not edit the catalog for one prototype, and do not copy `catalog.json` or the photos into it. See [Versions](CONSUMING.md#versions) and [Change data for one prototype](CONSUMING.md#change-data-for-one-prototype).

## Contribute

Open a PR to `vtex-prototypes/mocked-product-catalog` when you generate something that meets the spec below. A compliant product, variant, or extra photo belongs here, not only in the prototype's `public/` folder. Leave a rough fixture in the prototype when it does not meet the spec.

There are two kinds of contribution. Each PR is one or the other.

- **Content**: what the catalog holds. A promoted draft (same `id` and `categoryId`, images regenerated from `drafts/<id>.jpg`, both draft files deleted). A new product, a new variant, or another photo of an existing one. A category in `categories.json`, a brand in `brands.json`, or a specification value in `specifications.json`, each with `en` and `pt-BR` names. Content PRs touch `products/`, `images/`, `drafts/`, `categories.json`, `brands.json`, `specifications.json`, and the regenerated `catalog.json` and `drafts.json`.
- **Framework**: how the catalog works. The schema, the validator and its rules, the scripts, `loader.js`, the build, CI and releases, the image spec, the PR template, and these instructions. Framework PRs do not add or change products.

When you need both, open two PRs. Merge the framework PR first, then open the content PR that uses it. A new field on products, for example, is a framework PR that adds it to the schema and validator, followed by a content PR that fills it in. Start the PR title with `content:` or `framework:`.

Prototypes depend on every id and field in `catalog.json`. Change values freely, and add whatever you need. Do not remove or rename a product, variant, option value, category, brand, specification, or field unless there is no other way, and never reuse an id for something else.

When a product or variant has to go, take it out in two PRs:

1. A `content:` PR that adds `"deprecated": { "reason": "...", "replacedBy": "<id>" }` to it and changes nothing else. The reason is in English, for whoever builds prototypes. `replacedBy` is a product id on a product, or a variant id of the same product on a variant; leave it out only when nothing replaces it. The default variant cannot be deprecated: point `defaultVariantId` at a variant that stays first. This merges as a minor release, and prototypes that load the item start warning.
2. Later, a `content!:` PR that removes it. The compatibility check fails a removal of anything that was not deprecated at the base branch.

A removal is released as a new major version, so prototypes on the current major are not affected. Start the title with `content!:` or `framework!:` for any removal, and for a `loader.js` change that would break existing callers. The compatibility check fails a PR that removes something without the `!`. Merge with squash, so the PR title is the commit the release reads.

Before opening any PR, run both checks. GitHub Actions is disabled for the vtex-prototypes organization, so nothing runs them for you:

```sh
npm run check
npm run compat -- origin/main                    # add --allow-breaking when the title has `!`
```

A brand is optional. Leave `brandId` out, and leave it out of the name, when the product has none. A tomato does not need one. When it has one, add the brand once to `brands.json` and set `brandId`. Never use a trademark or a real brand name, in the brand, the name, description, tags, or alt text, or as a logo or label in the photo.

A value that should match across products goes in `specifications.json` once, with `en` and `pt-BR`. Material and capacity are product specifications. A shared option such as apparel size uses `specificationId` and `valueId` instead of copying the label. Color stays on the product, because the hex belongs to that photo. Write a new value into `specifications.json` when an existing one would be a stretch. The listing name stays the product's own words.

Work on a branch. Generate the white PNG with the prompt in the README, with the draft photo attached when you are promoting one. Run `npm run backgrounds`, then `npm run check`. `check` writes the WebP beside the PNG and rebuilds `catalog.json`. Commit the PNG and the WebP. The PNG stays the source.

Open the PR with `gh pr create` and fill in the template. Confirm by eye: no shadow, no text, no logo, no trademark.

Regenerate a photo that fails the white-edge check. Cutting the background out by hand produces a worse image. Paint extra background colors with `npm run backgrounds`; that pass is cheap. Keep the white PNG as the original.
