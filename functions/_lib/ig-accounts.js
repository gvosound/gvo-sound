// Every Instagram account the site shows, and where. A new account is one new line plus its token in Cloudflare.
//   key       what the page asks for
//   handle    the @name
//   id        the Instagram account id from the Meta app
//   token     the name of the Cloudflare secret that holds this account's token (the token itself never lives here)
//   shows     where it appears (for people reading this file)
//   approval  new posts also go to the Social posts tab of the form sheet, where the team ticks Approved
export const IG_ACCOUNTS = [
  { key: 'sound', handle: 'gvo.sound', id: '17841437160886622', token: 'IG_TOKEN_SOUND', shows: 'Homepage band; music and podcast pages after approval', approval: true },
  { key: 'events', handle: 'gvosound.events', id: '17841476462433430', token: 'IG_TOKEN_EVENTS', shows: 'Events page band' },
  { key: 'clothing', handle: 'gvosound.clothing', id: '17841472729096295', token: 'IG_TOKEN_CLOTHING', shows: 'Shop page band' },
  { key: 'travel', handle: 'gvosound.travel', id: '17841478697887076', token: 'IG_TOKEN_TRAVEL', shows: 'Travel page band' },
];

// These tokens come from Facebook login, so they work on graph.facebook.com (checked Oct 27, 2026).
// graph.instagram.com rejects them.
export const GRAPH = 'https://graph.facebook.com/v21.0';
export const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
