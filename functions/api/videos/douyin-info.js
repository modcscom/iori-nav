import { jsonResponse, errorResponse } from '../../_middleware';

const DOUYIN_API_BASE = 'https://douyin-vd.vercel.app/api/hello';

async function resolveRedirectUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
        'Origin': 'https://www.douyin.com',
      },
    });

    if (response.status === 302 || response.status === 301 || response.status === 303) {
      const location = response.headers.get('Location');
      if (location) {
        return location;
      }
    }
    return url;
  } catch (e) {
    console.warn('Resolve redirect failed:', e);
    return url;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const videoUrl = url.searchParams.get('url');

  if (!videoUrl) {
    return errorResponse('缺少 url 参数', 400);
  }

  try {
    const apiUrl = `${DOUYIN_API_BASE}?data&url=${encodeURIComponent(videoUrl)}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error('抖音 API 响应失败:', response.status);
      return errorResponse('解析抖音视频失败', 500);
    }

    const data = await response.json();

    let finalVideoUrl = data.video_url || null;
    if (finalVideoUrl) {
      finalVideoUrl = await resolveRedirectUrl(finalVideoUrl);
    }

    return jsonResponse({
      code: 200,
      data: {
        title: data.title || data.desc || null,
        desc: data.desc || null,
        video_url: finalVideoUrl,
        nickname: data.nickname || null,
        signature: data.signature || null,
        comment_count: data.comment_count || 0,
        digg_count: data.digg_count || 0,
        share_count: data.share_count || 0,
        collect_count: data.collect_count || 0,
        create_time: data.create_time || null,
        type: data.type || null,
        image_url_list: data.image_url_list || null,
      },
    });
  } catch (e) {
    console.error('解析抖音视频失败:', e);
    return errorResponse(`解析抖音视频失败: ${e.message}`, 500);
  }
}