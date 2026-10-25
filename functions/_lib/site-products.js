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

// The 27 Square items that came from Wix Stores, checked against /api/shop?debug=1 on Oct 25, 2026.
// Only these sell on the site. Each points at the site page whose photos it uses ('' = no site page, Square photos).
// A new item added in Square stays off the site until its id is added here.
export const PINNED = {
  'B45FHAADJKXMNJWWTINVWQVJ': 'no-deadbeats-oversized-pink', // No Deadbeats Oversized, Pink
  'B6LSIFNINJQMF6KN6UNVP6FO': 'world-tour-tee-black', // World Tour Tee - Black
  'IGHE5Q2IFP3QFGV2TVSZKQUS': 'world-tour-cozy-hoodie', // World Tour Cozy Hoodie
  'CGCXB2Y4D5UOBOFFCV674VCA': 'world-tour-tracksuit-pants', // World Tour Tracksuit Pants
  'OOPB5E5OJRJKSMA6DMAW5OGZ': 'prove-a-point-tee', // Prove A Point Tee
  'VNANFTRHUASES273LPG77SR4': 'music-is-a-drug-long-sleeve', // Music is a Drug (Long Sleeve)
  'CHJQBLDYGCTT3USMGTOFMBQE': 'world-tour-tee-white', // World Tour Tee - White
  'GCOUEOHKTP4H4Z7RRGK5EXGU': 'gvo-beanie', // GVO Beanie
  'DJRIQZJQATDPUJIDMKR32CRX': 'gvo-muscle-tee', // GVO Muscle Tee
  'YFB3DFVEWR3LBAALDF4PRHKD': 'worker-jacket', // Worker Jacket
  'YA3K27VD3BETIUAABVQNUJQW': 'gvo-x-ace-distressed-tee', // GVO X Ace Distressed Tee
  'DKN6FBIHMJ6FL5UKTFMEU2MS': 'gvo-body-set-top', // GVO Body Set- Tops
  'EPYKEBLV3A3Q7JNOTS3LJRLS': 'gvo-skater-shorts', // GVO Skater Shorts
  'L6KQ2RLB4NT45WWJ2PU3BV7V': 'gvo-golf-set-shirt', // GVO Golf Set - SHIRT ONLY *
  'MQKVEOUCG5P3W7JYULO2RFJ5': 'never-see-the-haters-here-tee', // Never See The Haters Here! Tee
  '7EGDHFSS53LCM36QHGRUFDPT': 'gvo-bodysuit', // GVO Bodysuit
  'KUS53WDUTWGJBBVCC3MYK3PR': 'gvo-golf-set-shorts', // GVO Golf Set - SHORTS ONLY*
  'SLNGVPSQWXFST5XKE52CJIP4': 'world-tour-cheetah-hoodie', // World Tour Cheetah Hoodie
  'AIRNHRORQ3DURIEYWLYJ5DA2': 'pain-is-temporary-dirtbike-jersey', // Pain Is Temporary - Dirtbike Jersey
  'HCWN7YJ7CQIKBBDGL6YP4GU4': 'world-tour-cozy-pants', // World Tour Cozy Pants
  'X7VPNAN667FGEN6Q2MFVOOM3': 'collective-set-shirt', // The Collective Set - SHIRT*
  'UUXYF464FHXTMZXNKLYWEVTO': 'world-tour-tracksuit-jacket', // World Tour Tracksuit Jacket
  'PTU3SAUK24HNNR2GS6EBNBOG': '', // Music is a Drug
  'VTTJMB6L7NZUQSCZAWM2PHIP': 'no-deadbeats-oversized-grey', // No Deadbeats Oversized, Gray
  'G5B5BKIY37XNKVNXIVXNDJOO': 'gvo-body-set-bottoms', // GVO Body Set-Bottoms
  'Z6VMLFZEJ7VUDF77J3N6CEK4': 'no-art-for-today-tee', // No Art For Today Tee
  'IQGMLKOJNJQUQ33W3RFVSOW7': 'collective-set-pants', // The Collective Set - Pants*
};

// Items in Square from before the Wix move. Never sold on the site (Cory's call to change).
export const OLD_ITEM_PATTERNS = [
  /signature\s+tee/i, /essentials?\s+(hoodie|pants)/i, /ski\s*mask/i, /\bkings?\b/i, /\bqueens?\b/i,
  /\bfee\b/i, /ticket/i, /french\s+bulldog/i, /\bdeposit\b/i, /^world tour tee$/i,
];

// Names the site shows, used in confirmation emails instead of Square's internal item names.
export const SITE_NAMES = {
  "gvo-x-ace-distressed-tee": "GVO x Ace Distressed Tee",
  "prove-a-point-tee": "Prove A Point Tee",
  "world-tour-tee-white": "World Tour Tee, White",
  "world-tour-tee-black": "World Tour Tee, Black",
  "gvo-muscle-tee": "GVO Muscle Tee",
  "no-art-for-today-tee": "No Art For Today Tee",
  "pain-is-temporary-dirtbike-jersey": "Pain Is Temporary Dirtbike Jersey",
  "world-tour-cheetah-hoodie": "World Tour Cheetah Hoodie",
  "gvo-skater-shorts": "GVO Skater Shorts",
  "gvo-golf-set-shorts": "GVO Golf Set, Shorts",
  "gvo-golf-set-shirt": "GVO Golf Set, Shirt",
  "collective-set-shirt": "The Collective Set, Shirt",
  "collective-set-pants": "The Collective Set, Pants",
  "never-see-the-haters-here-tee": "Never See The Haters Here! Tee",
  "music-is-a-drug-long-sleeve": "Music Is A Drug Long Sleeve",
  "no-deadbeats-oversized-pink": "No Deadbeats Oversized Tee, Pink",
  "no-deadbeats-oversized-grey": "No Deadbeats Oversized Tee, Grey",
  "world-tour-cozy-hoodie": "World Tour Cozy Hoodie",
  "world-tour-cozy-pants": "World Tour Cozy Pants",
  "worker-jacket": "Worker Jacket",
  "world-tour-tracksuit-jacket": "World Tour Tracksuit Jacket",
  "world-tour-tracksuit-pants": "World Tour Tracksuit Pants",
  "gvo-bodysuit": "GVO Bodysuit",
  "gvo-body-set-top": "GVO Body Set, Top",
  "gvo-body-set-bottoms": "GVO Body Set, Bottoms",
  "gvo-beanie": "GVO Beanie"
};
