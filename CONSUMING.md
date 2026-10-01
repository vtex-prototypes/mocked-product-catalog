# Consuming the catalog

Use this when a prototype at VTEX needs products. Answer both questions before loading anything. The first answer chooses the products. The second chooses the fields those screens render. Leave either one open and the prototype shows a generic marketplace.

Published products are in `catalog.json`. `drafts.json` is the queue of photos that are not compliant yet. A realistic prototype uses published products.

## 1. What store is this?

Answer with the type of store to emulate, or with the category ids to include. One of the two is enough.

A store type maps onto the roots in `categories.json`:

| Store | Root id |
|---|---|
| Clothing and accessories | `roupa-acessorios` |
| Home and decor | `casa-decoracao` |
| Grocery | `supermercado` |
| Electronics and appliances | `eletronicos` |
| Sports and outdoors | `esportes` |

A department store or a marketplace names more than one root. A narrower prototype names subcategories instead, such as `casa-cama-mesa-banho` or `esportes-casacos`. A sporting-goods store can be `esportes` plus part of `roupa-acessorios`. Take the children of any chosen root: each category has a `parent` id, or `null` when it is a root.

Then keep the products whose `categoryId` is in that set. If a chosen category has no published products yet, say so. Narrow the prototype to categories that have products, or promote drafts before using them. Draft photos do not match the published ones.

Also pick the locale and the currency for the whole prototype: `en` or `pt-BR`, `USD` or `BRL`. Each currency is the retail price a store in that market would charge. And pick the photo background, `#ffffff` or `#f5f5f5`, and use it on every product.

## 2. What about each product should be shown?

List the fields each screen shows. A product card and a product page almost always show different subsets. These are the fields that exist:

| Field | Where it lives | Useful on |
|---|---|---|
| Photo | `variants[].images[0].src[background]` of the default variant, or of the selected one | Card, page |
| Name | `name[locale]` | Card, page |
| Brand | `brand` | Card, page |
| Price | `price[currency]`, or the selected variant's `price` | Card, page |
| Sale price | `listPrice[currency]`, only present when that variant is on sale | Card, page |
| Availability | `in_stock`, `low_stock`, `out_of_stock` | Card, page, button |
| Options | `options` (color swatches use `hex`; size, volume, capacity and others are the same shape) | Page, sometimes the card |
| Gallery | `variants[].images` | Page |
| Description | `description[locale]` | Page |
| SKU | `variants[].sku` | Page |
| Category | `categoryId`, resolved through `categories` | Listing, breadcrumb |
| Tags | `tags[locale]` | Filters, rarely the card |

`price` and `availability` on the product match the default variant, so a card can render before anyone picks an option. Once an option changes, read price, stock and photos from that variant. Some variants are out of stock on purpose.

Write the list in the prototype brief. Example for a grocery home: photo, short-enough name, price, and a low-stock badge on the card; description, pack size and availability on the page. Example for a fashion product page: photo gallery, name, price, sale price, color swatches, size, and a disabled button when the chosen size is `out_of_stock`.

## Load

```js
const BASE = "https://raw.githubusercontent.com/vtex-prototypes/mocked-product-catalog/main/";
const { categories, products } = await fetch(`${BASE}catalog.json`).then((r) => r.json());

const locale = "pt-BR";
const currency = "BRL";
const background = "#f5f5f5";

const wanted = new Set(["esportes-casacos", "esportes-mochilas"]); // from question 1
const catalog = products.filter((p) => wanted.has(p.categoryId));

function card(product) {
  const variant = product.variants.find((v) => v.id === product.defaultVariantId);
  return {
    name: product.name[locale],
    price: variant.price[currency],
    listPrice: variant.listPrice?.[currency],
    availability: variant.availability,
    image: BASE + variant.images[0].src[background],
  };
}
```

Show only the fields from question 2. The rest stays in the data.
