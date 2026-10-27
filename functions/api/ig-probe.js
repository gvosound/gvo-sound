// Temporary: tests IG_TOKEN_SOUND on both Graph hosts. Reports status codes and field names only. Removed after the check.
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
export async function onRequestGet({ env }) {
  const tok = env.IG_TOKEN_SOUND, id = '17841437160886622';
  if (!tok) return Response.json({ ok: false, error: 'IG_TOKEN_SOUND is not set in this deployment' });
  const scrub = s => String(s || '').split(tok).join('[token]').slice(0, 240);
  const out = { tokenLength: tok.length, tokenStart: tok.slice(0, 4) };
  for (const host of ['graph.instagram.com', 'graph.facebook.com']) {
    const u = `https://${host}/v21.0/${id}/media?fields=${FIELDS}&limit=3&access_token=${encodeURIComponent(tok)}`;
    try {
      const r = await fetch(u); const j = await r.json().catch(() => ({}));
      out[host] = { status: r.status, error: j.error ? { type: j.error.type, code: j.error.code, sub: j.error.error_subcode, message: scrub(j.error.message) } : null,
        count: (j.data || []).length, fields: j.data && j.data[0] ? Object.keys(j.data[0]) : [], types: (j.data || []).map(x => x.media_type), newest: j.data && j.data[0] ? j.data[0].timestamp : null, paging: !!(j.paging && j.paging.next) };
    } catch (e) { out[host] = { error: scrub(e.message) }; }
  }
  return Response.json(out, { headers: { 'Cache-Control': 'no-store' } });
}
