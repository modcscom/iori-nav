import { jsonResponse, errorResponse } from '../../_middleware';
import { buildVideoTree } from '../../lib/video-utils';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const [categoryRows, videoRows] = await Promise.all([
      env.NAV_DB.prepare('SELECT id, name, sort_order, parent_id FROM video_categories ORDER BY sort_order ASC, id ASC').all(),
      env.NAV_DB.prepare('SELECT * FROM videos ORDER BY sort_order ASC, create_time DESC').all(),
    ]);

    const categories = categoryRows.results || [];
    const videos = videoRows.results || [];
    const tree = buildVideoTree(categories, videos);

    return jsonResponse({ code: 200, data: { categories, videos, tree } });
  } catch (e) {
    return errorResponse(`获取视频中心数据失败: ${e.message}`, 500);
  }
}
