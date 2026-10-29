// Every YouTube playlist the site shows, and where. A new playlist or a new artist strip is one new line.
//   key       what the page asks for
//   playlist  the YouTube playlist id
//   shows     where it appears (for people reading this file)
//   artist    set it to put a video strip under that artist's card on the music page (name as it appears in ARTISTS)
//   label     the heading on that strip
//   takesFrom a video in this playlist and in one of these is shown only here
//   max       how many videos to show, newest first
//   fetch     read only this many from the top of the playlist (for a big channel's uploads)
//   noShorts  the playlist has no Shorts, so skip the Shorts check
export const VIDEO_LISTS = [
  { key: 'sessions', playlist: 'PLNs_QvLiR6oc', shows: 'Music page, Watch the sessions', max: 12 },
  { key: 'podcasts', playlist: 'PLeR8d2FeKKTY', shows: 'Podcast page, featured video and episode list', max: 12 },
  // BagBoy Network (Skandle's channel, filmed at GVO). UULF + the channel id is YouTube's list of the channel's
  // full-length uploads, newest first, with no Shorts in it, so only the newest few are read and none need a Shorts check.
  { key: 'bagboy', playlist: 'UULFFNAkKsoeYX1pU8IN6sDB1A', shows: 'Content page, BagBoy Network row', max: 12, fetch: 12, noShorts: true },
  { key: 'flawless', playlist: 'PLcHLuAfRjBqxjg2GDrQZTcLNzA3lVuD2F', shows: 'Music page, Studio artists, under Flawless Breezyy', artist: 'Flawless Breezyy', label: 'Watch Flawless', takesFrom: ['sessions'], max: 20 },
];

// How names read on the site when YouTube has them in all caps. Anything not listed shows as YouTube has it.
export const NAME_FIX = {
  'LEX BRATCHER': 'Lex Bratcher', 'AEXO': 'AEXO', 'THEO BOSSED UP': 'Theo Bossed Up', 'WILLTHARAPPER': 'WillThaRapper',
  'TMCTHEDON': 'TMCTHEDON', 'SKANDLE': 'Skandle', 'FLAWLESS BREEZYY': 'Flawless Breezyy', 'SHY WEEZYY': 'Shy Weezyy',
  'LOCAL HOMIE': 'Local Homie', 'TOP DOLLA SWEIZY': 'Top Dolla Sweizy', 'A1 BEAM': 'A1 Beam', 'YOUNG DYLAN': 'Young Dylan', "IT'S ON ME": "It's On Me",
};
