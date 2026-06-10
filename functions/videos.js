let cachedVideosHtml = null;

async function getVideosTemplate(env, requestUrl) {
  if (cachedVideosHtml !== null) return cachedVideosHtml;
  const res = await env.ASSETS.fetch(new URL('/videos.html', requestUrl));
  cachedVideosHtml = await res.text();
  return cachedVideosHtml;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const html = await getVideosTemplate(env, request.url);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
