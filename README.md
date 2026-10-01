# Mock Product Catalog

A small, consistent product catalog for designers at VTEX building code prototypes. Every product has English and Brazilian Portuguese copy, prices in USD and BRL, a stock state, and color variants. Every photo is 1024×1024 and ships twice: once on pure white (`#ffffff`) and once on `#f5f5f5`, with no shadows and no text.

Public mock APIs (DummyJSON, Fake Store, Platzi) exist, but their photos are inconsistent and the data doesn't cover the states a storefront needs. This repo trades breadth for consistency: fewer products, but all of them look like they belong in the same store.

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
- `options` are what the shopper picks. `color` values include a `hex` swatch. The pillow also has `size`; most products are color only.
- `variants` are the combinations you can buy. Each has its own `sku`, `price`, `availability` and photos. A size that shares a color reuses the same files.
- `listPrice` is only present when that variant is on sale. Render a strike-through when `listPrice[currency] > price[currency]`.
- `availability` is `in_stock`, `low_stock` or `out_of_stock`. The sage queen pillow is out of stock, and the gray air mattress is out of stock while navy is in stock, so a color change can change the button.
- Every photo has two files: `#ffffff` and `#f5f5f5`. `images[0]` is the main shot. `src` is added in `catalog.json`; the source files only store the filename.
- `categories` is a flat list; each one has a `parent` id or `null`.

Full schema: [`schema/product.schema.json`](schema/product.schema.json).

## Add a product

You don't need to be an engineer. The steps are: generate an image, write a small JSON file, run one command, open a PR.

### 1. Generate the image

Use any image model. This is the prompt that produced the current set. Replace the product in quotes:

> Create a product image for a "cotton bath towel". The product is isolated on a pure flat white background (#FFFFFF). Absolutely no shadows: no drop shadow, no contact shadow, no soft gray under the product, no floor, no vignette. No text, labels, logos or brand tags. Clean e-commerce cutout look, square format.

Rules the image has to meet:

| Rule | Checked by |
|---|---|
| PNG, exactly 1024×1024 | `npm run validate` |
| Background is true white at the edges (every channel ≥ 248) | `npm run validate` |
| No shadow or gray halo around the product | you, and the PR reviewer |
| No text, logos, tags or labels | you, and the PR reviewer |
| Fictional or generic product, no real brands | you, and the PR reviewer |

"White" means `#FFFFFF`, not "light". Many models output a warm `#F5F5F0` background that looks white in isolation but shows as a gray square on a white page. If the validator says the edges are off-white, re-prompt with "pure flat white background (#FFFFFF)" rather than editing the image. We tried cutting out backgrounds by hand and the results were worse than regenerating.

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
- **Fictional brands.** `Casa Norte`, `Fio Puro` and `Trilha Livre` are in use; add your own, but never a real one.
- If the category you need isn't in `categories.json`, add it there in the same PR, with both language names.

### 3. Check and build

```sh
npm install
npm run check
```

`check` validates every product, rebuilds `catalog.json` and fails if the committed `catalog.json` is stale. Commit the regenerated `catalog.json` together with your files.

### 4. Open a PR

The PR template has the three visual checks the validator can't do (shadows, text, real brands). CI runs `npm run check`.

## Add an extra image or a variant

Another angle of a color you already have: add `2-ffffff.png`, run `npm run backgrounds`, and append a second object to that color's `images` array, with both filenames.

A new color: generate `<color>-ffffff.png` on white, run `npm run backgrounds`, add the color to `options`, and add one variant per combination that uses it. A new size usually reuses the existing photos and only changes `price` and `sku`.

## Layout

```
categories.json             # category tree
products/*.json             # one file per product (source of truth)
images/<id>/*-ffffff.png    # product photos on white
images/<id>/*-f5f5f5.png    # the same photos, background repainted
scripts/backgrounds.mjs     # paints the #f5f5f5 twins
catalog.json                # generated: categories + products with resolved image paths
schema/product.schema.json  # JSON schema for products/*.json
scripts/validate.mjs        # metadata + image checks
scripts/build.mjs           # builds catalog.json
```
