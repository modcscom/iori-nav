import { jsonResponse, errorResponse } from '../../_middleware';

const DOUYIN_API_BASE = 'https://douyin-vd.vercel.app/api/hello';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const videoUrl = url.searchParams.get('url');

  if (!videoUrl) {
    return errorResponse('缺少 url 参数', 400);
  }

  try {
    // 调用抖音解析 API，获取 JSON 数据（有 data 参数）
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

    // 返回结构化数据
    return jsonResponse({
      code: 200,
      data: {
        // 标题：优先使用 title，其次使用 desc
        title: data.title || data.desc || null,
        // 描述
        desc: data.desc || null,
        // 视频直链
        video_url: data.video_url || null,
        // 作者昵称
        nickname: data.nickname || null,
        // 作者签名
        signature: data.signature || null,
        // 统计数据
        comment_count: data.comment_count || 0,
        digg_count: data.digg_count || 0,
        share_count: data.share_count || 0,
        collect_count: data.collect_count || 0,
        // 创建时间
        create_time: data.create_time || null,
        // 类型
        type: data.type || null,
        // 图片列表（图文视频）
        image_url_list: data.image_url_list || null,
      },
    });
  } catch (e) {
    console.error('解析抖音视频失败:', e);
    return errorResponse(`解析抖音视频失败: ${e.message}`, 500);
  }
}
