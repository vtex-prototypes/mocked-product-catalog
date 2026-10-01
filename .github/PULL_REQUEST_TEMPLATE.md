## What this adds

<!-- e.g. "3 products in Cama, Mesa e Banho" or "second image for pillow" -->

## Checklist

The validator (`npm run check`) covers metadata, file layout, 1024×1024 PNG and a true-white background. These three can only be checked by eye, so please confirm them:

- [ ] No shadows under or around the product (no soft gray on the background)
- [ ] No text, logos, brand tags or labels anywhere in the image
- [ ] The product is fictional or generic. No real brands, no real product photos

And:

- [ ] `npm run check` passes locally
- [ ] Names and descriptions are in pt-BR
- [ ] If the product is on sale, `listPrice` is set and is higher than `price.value`
