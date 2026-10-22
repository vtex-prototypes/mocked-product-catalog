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

## One product, many variants

A product is one object a shopper would put in a cart. Everything that changes how much of it, or which version of it, is a **variant** of that product. This rule comes before any count target, and `npm run validate` enforces it: it fails when two products that are not deprecated share a photo file.

Make it a variant, never a second product, when the only differences are:

- a size, length, width, diameter, gauge, capacity, volume, weight, or pack count;
- a rating or model of the same item: amperage, thread, with or without a part;
- a grade, finish, or formulation of the same item;
- a color of the same object, with its own photo per color.

An intended use is not a difference at all. "Portland cement for slabs", "for screeds" and "for foundations" are one cement. Do not create a product, and not a variant either, for a use: put the uses in the description and the tags.

Check before you write a file. If any answer is yes, it is one product:

1. Would the two photos be the same picture, or the same object with only its size or label different?
2. Does the name differ only by a size, rating, model, pack, color, or "for <use>"?
3. Would a store list it as one item with a menu to choose from?

Counts never justify a split. "30 products per category" is not permission to turn one cement, one wire or one toilet into eight products: if a category is short, add objects that are really different and have their own photo, or report how many you reached. Do not get around the check by redrawing or retouching the same picture. A picture of the same object is the same product.

Lookalike photos are a related, weaker problem. Each new product needs a photo a person can tell apart at a glance: a different object, color, shape, material, or angle. Variants of one product may share a photo when the difference would not show. If a request only works by shipping lookalike photos, stop before generating files and say how many products would look alike and in which categories. The default is to skip those and add only products with their own photo. A count target is not permission. Continue with lookalike photos only after the person explicitly confirms that warning.

```text
Bad: eight Portland cement products, "for slabs", "for screeds", "for foundations"…, one bag photo.
Good: one Portland cement with a pack option, and masonry, white, rapid-set and sulfate-resistant cement as their own products, each on a bag that looks different.

Bad: single-pole-breaker-10-amp, -16-amp, -20-amp as three products on the same module photo.
Good: one miniature circuit breaker with a rating option (10, 16, 20 A) and a pack option.
```

## Naming options and values

An option is one question a shopper answers and a value is one answer. Name them like a store's filter, never like a product title. `npm run validate` fails on the first four rules.

- **The option names the dimension, the value is only the answer.** The option is `Rating`, `Gauge`, `Thread size`, `Edge`, `Kit size`; the value is `20 A`, `2.5 mm²`, `1/2 in`, `Rectified`. Never repeat the option's name in the value: "20 Amp Rating" under "Rating" is wrong, "20 A" is right.
- **No placeholders.** Never `Original`, `Alternate`, `Alternative`, `Default`, `Option A` or `Variant 2`, and never a generic option name such as "Option" or "Choice". The base product's own value gets its real measure ("1-1/4 in"), not "Original".
- **No value repeated** inside an option, and no value over 30 characters. A chip names the choice; the detail goes in the description.
- **Every value is something a person picks by name or number.** If you cannot say what two values are, they are not variants. Two values that differ only in price ("Standard | Alternate" at +20%) are not a variant either: say what the dearer one includes, as in `Includes: Piece only | Installation kit`.
- **Sizes are real sizes.** "Compact | Standard | Large" is not a tile size: write "12×24 in | 24×24 in | 48×48 in". Abbreviate units (A, V, mm, mm², cm, in, L, kg) and set them in the product's language: inches in `en`, centimeters in `pt-BR`.
- **Order values naturally**, numbers ascending and then the rest, and keep one dimension to an option when you can.

```text
Bad:  Rating: "20 Amp Rating", "10 Amp Rating", "16 Amp Rating"
Good: Rating: "10 A", "16 A", "20 A"

Bad:  Drain: "Standard", "Alternate"
Good: Includes: "Piece only", "Installation kit"

Bad:  Format: "Compact", "Standard", "Large"
Good: Format: "12×24 in", "24×24 in", "48×48 in"
```

Add an application photo when seeing the product in use would materially help someone decide. It supplements, and never replaces, the isolated product photo. Show a representative use at a useful scale without implying a property or installation that the product does not declare. Paint always needs an application photo of a painted room, facade, floor, ceiling, door, or other appropriate surface that matches its color, finish, and indoor or outdoor application. Keep application photos free of text, logos, and real brands, inset them on the required white canvas, and generate the gray-background twin from that same image.

Regenerate a photo that fails the white-edge check. Cutting the background out by hand produces a worse image. Paint extra background colors with `npm run backgrounds`; that pass is cheap. Keep the white PNG as the original.
