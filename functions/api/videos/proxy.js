import { errorResponse } from '../../_middleware';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const videoUrl = url.searchParams.get('url');

  if (!videoUrl) {
    return errorResponse('Missing url parameter', 400);
  }

  try {
    const parsedUrl = new URL(videoUrl);
    
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return errorResponse('Invalid URL protocol', 400);
    }

    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
        'Origin': 'https://www.douyin.com',
      },
      redirect: 'manual',
    });

    if (response.status === 302 || response.status === 301 || response.status === 303) {
      const location = response.headers.get('Location');
      if (location) {
        const headers = new Headers();
        headers.set('Location', location);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD');
        headers.set('Access-Control-Allow-Headers', 'Range');
        return new Response(null, { status: 302, headers });
      }
    }

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD');
    headers.set('Access-Control-Allow-Headers', 'Range');

    return new Response(response.body, {
      status: response.status,
      headers: headers,
    });
  } catch (e) {
    console.error('Video proxy failed:', e);
    return errorResponse(`Video proxy failed: ${e.message}`, 500);
  }
}