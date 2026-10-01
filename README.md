# Mock Product Catalog

The standard mock product catalog for designers at VTEX building code prototypes. One data shape, one image spec, one place to get products from, so every prototype at VTEX speaks the same catalog and photos from different people look like they belong in the same store.

It covers the five categories of a real marketplace, Roupa e Acessórios, Casa e Decoração, Supermercado, Eletrônicos and Esportes, with 30 subcategories and 229 products. Every published product has English and Brazilian Portuguese copy, prices in USD and BRL, a stock state, color variants, and 1024×1024 photos on pure white (`#ffffff`) and on `#f5f5f5`, with no shadows and no text.

Public mock APIs (DummyJSON, Fake Store, Platzi) exist, but their photos don't match each other, their data has no variants, no localization and no stock states, and nobody at VTEX controls them. This repo sets the standard and keeps it: a product is only in `catalog.json` once it meets the spec below. Products that are not there yet live in `drafts/` with their original photo, so you can see the full breadth and pick what to promote.

## Use it in a prototype

Everything is static files. Fetch `catalog.json` and prefix image paths with the raw URL of this repo:

```js
const BASE = "https://raw.githubusercontent.com/vtex/mocked-product-catalog/main/";

const { categories, products } = await fetch(`${BASE}catalog.json`).then((r) => r.json());

const locale = "pt-BR"; // or "en"
const currency = "BRL"; // or "USD"
const background = "#f5f5f5"; // or "#ffffff"

const product = products.find((p) => p.id === "pillow");
const variant = product.variants.find((v) => v.id === product.defaultVariantId);

product.name[locale];
variant.price[currency];                              // 69.9
BASE + variant.images[0].src[background];              // images/pillow/white-f5f5f5.png

const sageQueen = product.variants.find((v) => v.options.color === "sage" && v.options.size === "queen");
sageQueen.availability;                               // "out_of_stock"
```

A product looks like this. Photos live on the variant, and every photo has both backgrounds:

```json
{
  "id": "pillow",
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
      "name": { "en": "Size", "pt-BR": "Tamanho" },
      "values": [
        { "id": "standard", "name": { "en": "Standard 20x28 in", "pt-BR": "Padrão 50x70 cm" } },
        { "id": "queen", "name": { "en": "Queen 20x30 in", "pt-BR": "Queen 50x76 cm" } }
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
          "backgrounds": { "#ffffff": "white-ffffff.png", "#f5f5f5": "white-f5f5f5.png" },
          "src": {
            "#ffffff": "images/pillow/white-ffffff.png",
            "#f5f5f5": "images/pillow/white-f5f5f5.png"
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
- `options` are what the shopper picks. `color` values include a `hex` swatch. Some products also have `size`; most are color only.
- `variants` are the combinations you can buy. Each has its own `sku`, `price`, `availability` and photos. A size that shares a color reuses the same files.
- `listPrice` is only present when that variant is on sale. Render a strike-through when `listPrice[currency] > price[currency]`.
- `availability` is `in_stock`, `low_stock` or `out_of_stock`. Some variants are out of stock on purpose so a color change can change the button.
- Every photo has two files: `#ffffff` and `#f5f5f5`. `images[0]` is the main shot. `src` is added in `catalog.json`; the source files only store the filename.
- `categories` is a flat list of 35 entries; each one has a `parent` id or `null`. The five roots are `roupa-acessorios`, `casa-decoracao`, `supermercado`, `eletronicos`, `esportes`.

Full schema: [`schema/product.schema.json`](schema/product.schema.json).

## Drafts: the queue of products to promote

`drafts.json` lists every product that has a photo and a category but is not compliant yet. The photos come from the original Figma board; most of them have an off-white background, and a few have printed text or a dark background (see `notes`). Nothing in `drafts/` is in `catalog.json`. You can still render drafts in a prototype if you only need volume, but they won't match the published photos.

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

## Add a product

You don't need to be an engineer. The steps are: generate an image, write a small JSON file, run one command, open a PR.

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
images/<id>/<color>-ffffff.png
images/<id>/<color>-f5f5f5.png
```

`<id>` is a kebab-case slug in English (`bath-towel`, `air-mattress`). Copy an existing file in `products/` as a starting point. Generate the white photo only, then run `npm run backgrounds` to paint the `#f5f5f5` twin from it. Do not redraw the gray version: the product has to be the same pixels.

Content rules:

- **Both languages, always.** `name`, `description`, `tags` and every `alt` need an `en` and a `pt-BR` version. Write them as a native speaker would, not as literal translations (sizes in inches for `en`, centimeters for `pt-BR`).
- **Both currencies, always.** `price` (and `listPrice` if on sale) need `BRL` and `USD`. Use the price a real store would charge in each market rather than converting.
- **Long names.** Write the name the way a marketplace listing reads: brand, product, size, material, color, two or three selling points. Minimum 60 characters per language; the current set is 120–170. Short names make prototypes look fake and hide layout bugs.
- **At least two colors.** Every product has a color option with two or more values, each with its own photo. Pick a second color that reads as clearly different from the first.
- **Fictional brands.** `Casa Norte`, `Fio Puro`, `Trilha Livre`, `Altitude` and `Ritmo` are in use; add your own, but never a real one.
- If the category you need isn't in `categories.json`, add it there in the same PR, with both language names.

### 3. Check and build

```sh
npm install
npm run check
```

`check` validates every product and draft, rebuilds `catalog.json` and `drafts.json`, and fails if the committed copies are stale. Commit the regenerated files together with yours.

### 4. Open a PR

The PR template has the visual checks the validator can't do (shadows, text, real brands) and the draft-promotion checklist. CI runs `npm run check`.

## Add an extra image or a variant

Another angle of a color you already have: add `2-ffffff.png`, run `npm run backgrounds`, and append a second object to that color's `images` array, with both filenames.

A new color: generate `<color>-ffffff.png` on white, run `npm run backgrounds`, add the color to `options`, and add one variant per combination that uses it. A new size usually reuses the existing photos and only changes `price` and `sku`.

## Layout

```
categories.json             # category tree (5 roots, 30 subcategories)
products/*.json             # one file per published product (source of truth)
images/<id>/*-ffffff.png    # product photos on white
images/<id>/*-f5f5f5.png    # the same photos, background repainted
drafts/<id>.json            # products waiting for compliant photos
drafts/<id>.jpg             # their original reference photo
catalog.json                # generated: categories + published products with resolved image paths
drafts.json                 # generated: the promotion queue
schema/product.schema.json  # JSON schema for products/*.json
scripts/validate.mjs        # metadata + image checks for products and drafts
scripts/backgrounds.mjs     # paints the #f5f5f5 twins
scripts/build.mjs           # builds catalog.json and drafts.json
```

Published PNGs are about 1.4 MB each and every product ships at least four of them. Once a meaningful share of the drafts is promoted the repo will be several hundred megabytes; at that point move `images/` to Git LFS or switch to WebP before it hurts clone times.
