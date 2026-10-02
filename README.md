# Mock Product Catalog

The standard mock product catalog for building realistic prototypes at VTEX. One data shape, one image spec, one place to get products from, so every prototype at VTEX speaks the same catalog and photos from different people look like they belong in the same store.

Categories live in `categories.json`, and a prototype picks the roots and subcategories it needs. The tree has roots for clothing and accessories, home and decor, grocery, electronics, and sports, but not every root has published products yet: [CONSUMING.md](CONSUMING.md#1-what-store-is-this) has the current count per root. A store that needs a different cut adds a root. Every published product has English and Brazilian Portuguese copy, prices in USD and BRL, a stock state, variants, and 1024×1024 photos on pure white (`#ffffff`) and on `#f5f5f5`, with no shadows and no text.

Public mock APIs (DummyJSON, Fake Store, Platzi) exist, but their photos don't match each other, their data has no variants, no localization and no stock states, and nobody at VTEX controls them. This repo sets the standard and keeps it: a product is only in `catalog.json` once it meets the spec below. Products that are not there yet live in `drafts/` with their original photo, so you can see the full breadth and pick what to promote.

## Use it in a prototype

You do not clone this repo. Send its link to the agent that is building your prototype:

> Use the products from https://github.com/vtex-prototypes/mocked-product-catalog. Follow its AGENTS.md.

Then answer the two questions the agent asks, which store the prototype emulates and which product information each screen shows. [CONSUMING.md](CONSUMING.md) is the list it works from.

That is the whole setup. The repo is public, so the agent fetches `catalog.json` and the photos straight from GitHub, and the prototype stays up to date with it. Nothing is copied into the prototype.

For the agent, this is what the load looks like:

```js
const BASE = "https://raw.githubusercontent.com/vtex-prototypes/mocked-product-catalog/main/";

const { categories, products } = await fetch(`${BASE}catalog.json`).then((r) => r.json());

const locale = "pt-BR"; // or "en"
const currency = "BRL"; // or "USD"
const background = "#f5f5f5"; // or "#ffffff"

const product = products.find((p) => p.id === "pillow");
const variant = product.variants.find((v) => v.id === product.defaultVariantId);

product.name[locale];
variant.price[currency];                              // 69.9
BASE + variant.images[0].src[background];              // images/pillow/white-gray.webp

const sageQueen = product.variants.find((v) => v.options.color === "sage" && v.options.size === "queen");
sageQueen.availability;                               // "out_of_stock"
```

A product in `catalog.json` looks like this. Photos live on the variant, and every photo has both backgrounds. This is the built shape a prototype reads, not a source file: `npm run build` adds `src` and copies the `size` names from `specifications.json`. To write a file in `products/`, copy an existing one instead.

```json
{
  "id": "pillow",
  "brandId": "fio-puro",
  "categoryId": "casa-cama-mesa-banho",
  "defaultVariantId": "white-standard",
  "price": { "BRL": 69.9, "USD": 16.99 },
  "availability": "in_stock",
  "options": [
    {
      "id": "color",
      "name": { "en": "Color", "pt-BR": "Cor" },
      "values": [
        { "id": "white", "name": { "en": "White", "pt-BR": "Branco" }, "hex": "#F7F5F2" },
        { "id": "sage", "name": { "en": "Sage", "pt-BR": "Sálvia" }, "hex": "#A8BBA3" }
      ]
    },
    {
      "id": "size",
      "specificationId": "size",
      "name": { "en": "Size", "pt-BR": "Tamanho" },
      "values": [
        { "id": "standard", "valueId": "pillow-standard", "name": { "en": "Standard 20x28 in", "pt-BR": "Padrão 50x70 cm" } },
        { "id": "queen", "valueId": "pillow-queen", "name": { "en": "Queen 20x30 in", "pt-BR": "Queen 50x76 cm" } }
      ]
    }
  ],
  "variants": [
    {
      "id": "white-standard",
      "sku": "FP-PIL-WHT-STD",
      "options": { "color": "white", "size": "standard" },
      "price": { "BRL": 69.9, "USD": 16.99 },
      "availability": "in_stock",
      "images": [
        {
          "alt": { "en": "White rectangular bed pillow", "pt-BR": "Travesseiro branco retangular" },
          "backgrounds": { "#ffffff": "white-white.png", "#f5f5f5": "white-gray.png" },
          "src": {
            "#ffffff": "images/pillow/white-white.webp",
            "#f5f5f5": "images/pillow/white-gray.webp"
          }
        }
      ]
    }
  ]
}
```

Field notes:

- Every human-readable string (`name`, `description`, `tags`, `alt`, option and category `name`) is an object keyed by locale: `en` and `pt-BR`. Pick one at render time.
- Every price is an object keyed by currency: `BRL` and `USD`. USD values are plausible US retail prices, not conversions.
- `price` and `availability` on the product match the default variant, so a product card can render before a variant is chosen. The real numbers live on `variants`.
- Names are deliberately long (60+ characters), like real marketplace listings, so prototypes see real wrapping and truncation.
- `brandId` is optional and points at `brands.json`. `catalog.json` adds `brand` with the localized name. Leave it out when the product has no brand.
- `specifications` point at `specifications.json` by `id` and `valueId`. Material and capacity live there, so "cotton" is the same value on a towel and a sheet. `catalog.json` adds the localized `name` and `value`.
- `options` are the axes a shopper picks, and a product can have several. Color stays on the product and carries a `hex` swatch. A shared axis such as apparel size sets `specificationId` and each value's `valueId`, and the label comes from `specifications.json`. The pillow has color and size; a jacket has color and size; a bottle can have volume only.
- `variants` are the combinations you can buy. Each has its own `sku`, `price`, `availability` and photos. Variants that look the same share image files (every size of a navy jacket points at `navy-white.png`). Variants that look different get their own shot (a 500 ml bottle and a 1 L bottle, a 128 GB phone and a 256 GB phone).
- `listPrice` is only present when that variant is on sale. Render a strike-through when `listPrice[currency] > price[currency]`.
- `availability` is `in_stock`, `low_stock` or `out_of_stock`. Some variants are out of stock on purpose, so changing color or size can change the button.
- Every photo has two backgrounds, `#ffffff` and `#f5f5f5`. `images[0]` is the main shot. The source files store the PNG filename. `src` is added in `catalog.json` and points at the WebP a prototype loads.
- `categories` is a flat tree. Each entry has a `parent` id, or `null` when it is a root. Read the roots from `categories.json`.

Schema of the source files in `products/`: [`schema/product.schema.json`](schema/product.schema.json). `scripts/validate.mjs` enforces it, plus the rules a schema can't express (references between files, image pixels, default-variant consistency).

## Drafts: the queue of products to promote

`drafts.json` lists every product that has a photo and a category but is not compliant yet. The photos come from the original Figma board; most of them have an off-white background, and a few have printed text or a dark background (see `notes`). Nothing in `drafts/` is in `catalog.json`. If a prototype needs one of these categories, promote the drafts first ([CONSUMING.md](CONSUMING.md#when-a-category-has-no-published-products) explains why not to use them directly).

```json
{
  "id": "hooded-puffer-jacket",
  "categoryId": "esportes-casacos",
  "name": { "en": "Hooded puffer jacket", "pt-BR": "Jaqueta puffer com capuz" },
  "photo": "hooded-puffer-jacket.jpg",
  "figmaNode": "136:5642",
  "src": "drafts/hooded-puffer-jacket.jpg"
}
```

Promoting a draft is the main way to contribute. Pick one, follow [Add a product](#add-a-product) keeping the draft's `id` and `categoryId`, regenerate the photo using the draft as the visual reference, and delete `drafts/<id>.json` and `drafts/<id>.jpg` in the same PR.

Drafts are also how new photos enter the repo. If you have a product idea but no compliant image yet, add a draft (id, category, bilingual short name, 1024×1024 JPEG) and someone can promote it later.

## Content and framework

A contribution is either content (what the catalog holds) or framework (how it works), and each PR is one or the other. [AGENTS.md](AGENTS.md#contribute) has the exact split and the order to merge them in.

## Add a product

You don't need to be an engineer. Ask the agent in your prototype to promote the drafts your category needs, or to add the product, and to open the PR here. It follows [AGENTS.md](AGENTS.md). The steps it takes are: generate an image, write a small JSON file, run one command, open a PR.

### 1. Generate the image

Use any image model. This is the prompt that produced the current set. Replace the product in quotes and, when promoting a draft, attach the draft photo as the reference:

> Create a product image for a "cotton bath towel". The product is isolated on a pure flat white background (#FFFFFF). Absolutely no shadows: no drop shadow, no contact shadow, no soft gray under the product, no floor, no vignette. No text, labels, logos or brand tags. Clean e-commerce cutout look, square format.

Rules the image has to meet:

| Rule | Checked by |
|---|---|
| PNG, exactly 1024×1024 | `npm run validate` |
| Background is true white at the edges (every channel ≥ 248) | `npm run validate` |
| No shadow or gray halo around the product | you, and the PR reviewer |
| No text, logos, tags or labels | you, and the PR reviewer |
| Fictional or generic product, no real brands | you, and the PR reviewer |

"White" means `#FFFFFF`, not "light". Many models output a warm `#F5F5F0` background that looks white in isolation but shows as a gray square on a white page. Only 9 of the 229 original Figma photos pass this check, which is why drafts exist. If the validator says the edges are off-white, re-prompt with "pure flat white background (#FFFFFF)" rather than editing the image. We tried cutting out backgrounds by hand and the results were worse than regenerating.

### 2. Add the files

```
products/<id>.json
images/<id>/<slug>-white.png
images/<id>/<slug>-gray.png
```

`<id>` is a kebab-case slug in English (`bath-towel`, `air-mattress`). `<slug>` names the shot: `navy` when the color is what changes the picture, `500ml` when the volume does, `navy-back` for a second angle of the same variant. Copy an existing file in `products/` as a starting point. Generate the white PNG only, then run `npm run backgrounds` to paint the `#f5f5f5` twin from it. Do not redraw the gray version: the product has to be the same pixels. `npm run check` writes a WebP next to each PNG and points `catalog.json` at the WebP. Commit both files. The PNG stays the source.

Content rules:

- **Both languages, always.** `name`, `description`, `tags` and every `alt` need an `en` and a `pt-BR` version. Write them as a native speaker would, not as literal translations (sizes in inches for `en`, centimeters for `pt-BR`).
- **Both currencies, always.** `price` (and `listPrice` if on sale) need `BRL` and `USD`. Use the price a real store would charge in each market rather than converting.
- **Long names.** Write the name the way a marketplace listing reads: the product, its size, material, color, and two or three selling points. Add a brand only when the product has one. Minimum 60 characters per language; the current set is 120–170. Short names make prototypes look fake and hide layout bugs.
- **At least two variants, on whatever axes fit the product.** List them under `options` and sell each combination as a `variant`. Give a new photo to each combination that looks different, and reuse the files when it does not (sizes of the same jacket, for example). When one of the axes is color, give it two or more values with a `hex` swatch and a clearly different photo each. Color is optional: a bottle can vary by volume only.
- **Fictional brands, when you use one.** Add it to `brands.json` and set `brandId`. `Casa Norte`, `Fio Puro`, `Trilha Livre`, `Altitude` and `Ritmo` are already there. Never use a trademark or a real brand name, in the copy or in the photo.
- **Shared values go in `specifications.json`.** Reuse a material, size, or capacity instead of writing a near-copy on the product. Add a value there when none fits.
- If the category you need isn't in `categories.json`, add it there in the same PR, with both language names.

### 3. Check and build

Requires Node 20 or later.

```sh
npm install
npm run check
```

`check` validates every product and draft, rebuilds `catalog.json`, `drafts.json` and the coverage table in `CONSUMING.md`, and fails if the committed copies are stale. Commit the regenerated files together with yours.

### 4. Open a PR

The PR template has the visual checks the validator can't do (shadows, text, real brands) and the draft-promotion checklist. CI runs `npm run check`.

## Add an extra image or a variant

Another angle of a shot you already have: add `<slug>-white.png` (for example `navy-back-white.png`), run `npm run backgrounds`, and append a second object to that variant's `images` array, with both filenames.

A new option value: add it under `options`, then add one variant per combination that uses it. Generate `<slug>-white.png` when the new combination looks different. A new size of a garment usually reuses the existing photos and only changes `price` and `sku`.

## Layout

```
AGENTS.md                   # instructions for agents consuming and contributing
CONSUMING.md                # how to pick products for a prototype (coverage table is generated)
brands.json                 # fictional brands, referenced by products
specifications.json         # shared values a shopper filters or compares
categories.json             # category tree
products/*.json             # one file per published product (source of truth)
images/<id>/*-white.png    # source photo on white
images/<id>/*-gray.png     # same photo, background repainted #f5f5f5
images/<id>/*.webp         # what a prototype loads, generated from the PNG
drafts/<id>.json            # products waiting for compliant photos
drafts/<id>.jpg             # their original reference photo
catalog.json                # generated: brands, specifications, categories, and published products
drafts.json                 # generated: the promotion queue
schema/product.schema.json  # JSON schema for products/*.json
scripts/validate.mjs        # metadata + image checks for products and drafts
scripts/backgrounds.mjs     # paints the #f5f5f5 twins
scripts/webp.mjs            # writes a WebP next to every PNG
scripts/build.mjs           # builds catalog.json and drafts.json
```

Prototypes load the WebP. The PNG stays beside it, and validation and `npm run backgrounds` read the PNG.

## Maintaining

The repo stores both the PNG and the WebP, so clone size follows the PNGs. Once a meaningful share of the drafts is promoted, move `images/` to Git LFS before that hurts clone times.
