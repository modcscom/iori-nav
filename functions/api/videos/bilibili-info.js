// 代理获取 Bilibili 视频信息，解决浏览器 CORS 问题
import { jsonResponse, errorResponse } from '../../_middleware';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const bvid = url.searchParams.get('bvid');

  if (!bvid) {
    return errorResponse('缺少 bvid 参数', 400);
  }

  try {
    const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
      },
    });

    const data = await res.json();

    if (data.code === 0 && data.data) {
      return jsonResponse({
        code: 200,
        data: {
          title: data.data.title,
          desc: data.data.desc,
          cover: data.data.pic,
          aid: String(data.data.aid || ''),
          cid: String(data.data.cid || ''),
          bvid: data.data.bvid,
        },
      });
    }

    return errorResponse('获取视频信息失败: ' + (data.message || '未知错误'), 500);
  } catch (e) {
    return errorResponse(`获取视频信息失败: ${e.message}`, 500);
  }
}
