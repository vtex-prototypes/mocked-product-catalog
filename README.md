# Mock Product Catalog

A small, consistent product catalog for designers at VTEX building code prototypes. Every product has English and Brazilian Portuguese copy, prices in USD and BRL, a stock state, and at least one 1024×1024 product image on a true-white background, with no shadows and no text.

Public mock APIs (DummyJSON, Fake Store, Platzi) exist, but their photos are inconsistent and the data doesn't cover the states a storefront needs. This repo trades breadth for consistency: fewer products, but all of them look like they belong in the same store.

## Use it in a prototype

Everything is static files. Fetch `catalog.json` and prefix image paths with the raw URL of this repo:

```js
const BASE = "https://raw.githubusercontent.com/vtex/mocked-product-catalog/main/";

const { categories, products } = await fetch(`${BASE}catalog.json`).then((r) => r.json());

const locale = "pt-BR"; // or "en"
const currency = "BRL"; // or "USD"

const product = products[0];
product.name[locale];                 // "Almofada Decorativa Casa Norte Xadrez Tartan 45x45 cm…"
product.price[currency];              // 89.9
BASE + product.images[0].src;         // images/plaid-cushion/1.png
```

A product looks like this:

```json
{
  "id": "plaid-cushion",
  "brand": "Casa Norte",
  "categoryId": "cama-mesa-banho",
  "name": {
    "en": "Casa Norte Tartan Plaid Decorative Throw Pillow 18x18 in, Teal/Rust Multicolor, Removable Cover with Hidden Zipper, Hypoallergenic Fiber Insert Included",
    "pt-BR": "Almofada Decorativa Casa Norte Xadrez Tartan 45x45 cm Verde-Petróleo e Ferrugem, Capa Removível com Zíper Invisível, Enchimento em Fibra Siliconada Antialérgica Incluso"
  },
  "description": { "en": "Square decorative pillow in a woven tartan plaid…", "pt-BR": "Almofada quadrada em tecido xadrez tartan…" },
  "price": { "BRL": 89.9, "USD": 19.99 },
  "listPrice": { "BRL": 119.9, "USD": 26.99 },
  "availability": "in_stock",
  "tags": { "en": ["throw pillow", "plaid", "decor", "living room"], "pt-BR": ["almofada", "xadrez", "decoração", "sala"] },
  "images": [
    {
      "file": "1.png",
      "alt": { "en": "Square tartan plaid throw pillow seen from the front", "pt-BR": "Almofada quadrada xadrez tartan vista de frente" },
      "src": "images/plaid-cushion/1.png"
    }
  ]
}
```

Field notes:

- Every human-readable string (`name`, `description`, `tags`, `alt`, category `name`) is an object keyed by locale: `en` and `pt-BR`. Pick one at render time.
- Every price is an object keyed by currency: `BRL` and `USD`. USD values are plausible US retail prices, not conversions.
- Names are deliberately long (60+ characters), like real marketplace listings, so prototypes see real wrapping and truncation.
- `listPrice` is only present when the product is on sale. Render a strike-through when `listPrice[currency] > price[currency]`.
- `availability` is `in_stock`, `low_stock` or `out_of_stock`, so you can prototype those states.
- `images[0]` is the main image. Extra angles are `2.png`, `3.png`, …
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
products/<id>.json          # metadata
images/<id>/1.png           # main image
images/<id>/2.png           # optional extra angles
```

`<id>` is a kebab-case slug in English (`bath-towel`, `air-mattress`). Copy an existing file in `products/` as a starting point.

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

## Add an extra image to an existing product

Drop `images/<id>/2.png` (same rules) and append `{ "file": "2.png", "alt": { "en": "…", "pt-BR": "…" } }` to the product's `images` array. Run `npm run check`.

## Layout

```
categories.json             # category tree
products/*.json             # one file per product (source of truth)
images/<id>/*.png           # product images
catalog.json                # generated: categories + products with resolved image paths
schema/product.schema.json  # JSON schema for products/*.json
scripts/validate.mjs        # metadata + image checks
scripts/build.mjs           # builds catalog.json
```
