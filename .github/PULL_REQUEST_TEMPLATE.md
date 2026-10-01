## What this adds

<!-- e.g. "3 products in Cama, Mesa e Banho" or "second image for pillow" -->

## Checklist

The validator (`npm run check`) covers metadata, file layout, 1024×1024 PNG and a true-white background. These three can only be checked by eye, so please confirm them:

- [ ] No shadows under or around the product (no soft gray on the background)
- [ ] No text, logos, brand tags or labels anywhere in the image
- [ ] The product is fictional or generic. No real brands, no real product photos

And:

- [ ] `npm run check` passes locally
- [ ] `en` and `pt-BR` copy both read naturally (not a literal translation of each other)
- [ ] Name is a long, marketplace-style listing (brand, product, size, material, color, key features)
- [ ] `BRL` and `USD` prices are what a store in each market would actually charge
- [ ] If the product is on sale, `listPrice` is set in both currencies and is higher than `price`
