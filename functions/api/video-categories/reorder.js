import { isAdminAuthenticated, errorResponse, jsonResponse } from '../../_middleware';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);

  try {
    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) return errorResponse('缺少排序数据', 400);

    await env.NAV_DB.batch(items.map(item => env.NAV_DB.prepare(
      'UPDATE video_categories SET sort_order = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(Number(item.sort_order), Number(item.id))));

    return jsonResponse({ code: 200, message: '视频分类排序已保存' });
  } catch (e) {
    return errorResponse(`保存视频分类排序失败: ${e.message}`, 500);
  }
}
