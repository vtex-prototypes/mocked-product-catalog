# Mock Product Catalog

A small, consistent product catalog for designers at VTEX building code prototypes. Every product has pt-BR copy, a price, stock state and at least one 1024×1024 product image on a true-white background, with no shadows and no text.

Public mock APIs (DummyJSON, Fake Store, Platzi) exist, but their photos are inconsistent and the data doesn't cover the states a storefront needs. This repo trades breadth for consistency: fewer products, but all of them look like they belong in the same store.

## Use it in a prototype

Everything is static files. Fetch `catalog.json` and prefix image paths with the raw URL of this repo:

```js
const BASE = "https://raw.githubusercontent.com/vtex/mocked-product-catalog/main/";

const { categories, products } = await fetch(`${BASE}catalog.json`).then((r) => r.json());

const product = products[0];
const imageUrl = BASE + product.images[0].src; // images/<id>/1.png
```

A product looks like this:

```json
{
  "id": "plaid-cushion",
  "name": "Almofada Xadrez Tartan 45x45",
  "brand": "Casa Norte",
  "categoryId": "cama-mesa-banho",
  "description": "Almofada decorativa em tecido xadrez tartan…",
  "price": { "value": 89.9, "currency": "BRL" },
  "listPrice": 119.9,
  "availability": "in_stock",
  "tags": ["almofada", "xadrez", "decoração", "sala"],
  "images": [
    { "file": "1.png", "alt": "Almofada quadrada xadrez tartan vista de frente", "src": "images/plaid-cushion/1.png" }
  ]
}
```

Field notes:

- `listPrice` is only present when the product is on sale. Render a strike-through when `listPrice > price.value`.
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

`<id>` is a kebab-case slug in English (`bath-towel`, `air-mattress`). Copy an existing file in `products/` as a starting point. Names and descriptions are pt-BR, brands are fictional, prices are plausible BRL. If the category you need isn't in `categories.json`, add it there in the same PR.

### 3. Check and build

```sh
npm install
npm run check
```

`check` validates every product, rebuilds `catalog.json` and fails if the committed `catalog.json` is stale. Commit the regenerated `catalog.json` together with your files.

### 4. Open a PR

The PR template has the three visual checks the validator can't do (shadows, text, real brands). CI runs `npm run check`.

## Add an extra image to an existing product

Drop `images/<id>/2.png` (same rules) and append `{ "file": "2.png", "alt": "…" }` to the product's `images` array. Run `npm run check`.

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
