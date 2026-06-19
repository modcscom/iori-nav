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

    const requestHeaders = new Headers();
    requestHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    requestHeaders.set('Referer', 'https://www.douyin.com/');
    requestHeaders.set('Origin', 'https://www.douyin.com');
    
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      requestHeaders.set('Range', rangeHeader);
    }

    const response = await fetch(videoUrl, {
      headers: requestHeaders,
    });

    if (!response.ok) {
      return errorResponse(`Video fetch failed: ${response.status}`, 500);
    }

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range, Accept, Content-Type');
    headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (e) {
    console.error('Video proxy failed:', e);
    return errorResponse(`Video proxy failed: ${e.message}`, 500);
  }
}

export async function onRequestOptions(context) {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, Accept, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 200, headers });
}