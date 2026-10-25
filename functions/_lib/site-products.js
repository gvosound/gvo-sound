// The site's own product pages (photos, category, flag) and the names each one may carry in Square.
// Square names came over from Wix Stores, so the Wix names and URL slugs are listed as aliases.
// color: a site page that shows one color of a product. Used to split a Square item by color, or to pick
// between two Square items that only differ by color.
export const SITE_PRODUCTS = [
  { id: 'gvo-x-ace-distressed-tee', a: ['GVO x Ace Distressed Tee', 'Ace Distressed Tee'] },
  { id: 'prove-a-point-tee', a: ['Prove A Point Tee', 'Lose A Point Tee'] },
  { id: 'world-tour-tee-white', a: ['World Tour Tee White', 'World Tour Tee'], color: 'White' },
  { id: 'world-tour-tee-black', a: ['World Tour Tee Black', 'World Tour Tee'], color: 'Black' },
  { id: 'gvo-muscle-tee', a: ['GVO Muscle Tee', 'Muscle Tee'] },
  { id: 'no-art-for-today-tee', a: ['No Art For Today Tee', 'No Art For Today'] },
  { id: 'pain-is-temporary-dirtbike-jersey', a: ['Pain Is Temporary Dirtbike Jersey', 'Pain Is Temporary Hockey Tee', 'Pain Is Temporary Jersey', 'Pain Is Temporary'] },
  { id: 'world-tour-cheetah-hoodie', a: ['World Tour Cheetah Hoodie', 'Cheetah Hoodie'] },
  { id: 'gvo-skater-shorts', a: ['GVO Skater Shorts', 'GVO Shorts', 'Skater Shorts'] },
  { id: 'gvo-golf-set-shorts', a: ['GVO Golf Set Shorts', 'Golf Set Shorts', 'Golf Shorts'] },
  { id: 'gvo-golf-set-shirt', a: ['GVO Golf Set Shirt', 'Golf Set Shirt', 'Golf Shirt', 'Golf Shirts'] },
  { id: 'collective-set-shirt', a: ['The Collective Set Shirt', 'Collective Set Shirt', 'Collective Set Tee', 'Collective Tee', 'Collective Shirt'] },
  { id: 'collective-set-pants', a: ['The Collective Set Pants', 'Collective Set Pants', 'Collective Pants'] },
  { id: 'never-see-the-haters-here-tee', a: ['Never See The Haters Here Tee', 'Never See The Haters Here'] },
  { id: 'music-is-a-drug-long-sleeve', a: ['Music Is A Drug Long Sleeve', 'Music Is A Drug'] },
  { id: 'no-deadbeats-oversized-pink', a: ['No Deadbeats Oversized Tee Pink', 'No Deadbeats Oversized Pink', 'No Deadbeats Oversized Tee', 'No Deadbeats Oversized'], color: 'Pink' },
  { id: 'no-deadbeats-oversized-grey', a: ['No Deadbeats Oversized Tee Grey', 'No Deadbeats Oversized Grey', 'No Deadbeats Oversized Tee', 'No Deadbeats Oversized'], color: 'Grey' },
  { id: 'world-tour-cozy-hoodie', a: ['World Tour Cozy Hoodie', 'World Tour Cozy Set', 'Cozy Hoodie'] },
  { id: 'world-tour-cozy-pants', a: ['World Tour Cozy Pants', 'Cozy Pants'] },
  { id: 'worker-jacket', a: ['Worker Jacket', 'GVO Worker Jacket'] },
  { id: 'world-tour-tracksuit-jacket', a: ['World Tour Tracksuit Jacket', 'World Tour Tracksuit'] },
  { id: 'world-tour-tracksuit-pants', a: ['World Tour Tracksuit Pants', 'Tracksuit Pants'] },
  { id: 'gvo-bodysuit', a: ['GVO Bodysuit', 'Bodysuit'] },
  { id: 'gvo-body-set-top', a: ['GVO Body Set Top', 'Body Set Top'] },
  { id: 'gvo-body-set-bottoms', a: ['GVO Body Set Bottoms', 'Body Set Bottoms', 'Body Set Bottom'] },
  { id: 'gvo-beanie', a: ['GVO Beanie', 'Beanie'] },
];

// Square item ids pinned to site pages once the live catalog has been checked.
// Filled in after the first run of /api/shop?debug=1 with the token in place. While empty, matching is by name.
export const PINNED = {
  // 'SQUARE_ITEM_ID': 'site-product-id',
};

// Items in Square from before the Wix move. Never sold on the site (Cory's call to change).
export const OLD_ITEM_PATTERNS = [
  /signature\s+tee/i, /essentials?\s+(hoodie|pants)/i, /ski\s*mask/i, /\bkings?\b/i, /\bqueens?\b/i,
  /\bfee\b/i, /ticket/i, /french\s+bulldog/i, /\bdeposit\b/i, /^world tour tee$/i,
];
