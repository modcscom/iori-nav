import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder } from '../../_middleware';
import { normalizeOptionalText, normalizeRequiredText } from '../../lib/validators';
import { normalizeVideoPage, normalizeVideoPlatform } from '../../lib/video-utils';

function normalizeVideoPayload(body) {
  const titleResult = normalizeRequiredText(body.title, '视频标题', 120);
  if (!titleResult.ok) return titleResult;

  const urlResult = normalizeRequiredText(body.url, '视频地址', 2048);
  if (!urlResult.ok) return urlResult;

  const coverResult = normalizeOptionalText(body.cover, '视频封面', 2048, { nullIfEmpty: true });
  if (!coverResult.ok) return coverResult;

  const descResult = normalizeOptionalText(body.desc, '视频描述', 1000, { nullIfEmpty: true });
  if (!descResult.ok) return descResult;

  return {
    ok: true,
    value: {
      title: titleResult.value,
      url: urlResult.value,
      cover: coverResult.value,
      desc: descResult.value,
      categoryId: Number(body.category_id || body.categoryId),
      platform: normalizeVideoPlatform(body.platform),
      bvid: String(body.bvid || '').trim() || null,
      aid: String(body.aid || '').trim() || null,
      cid: String(body.cid || '').trim() || null,
      page: normalizeVideoPage(body.page),
      youtubeId: String(body.youtube_id || body.youtubeId || '').trim() || null,
      douyinId: String(body.douyin_id || body.douyinId || '').trim() || null,
      videoUrl: String(body.video_url || body.videoUrl || '').trim() || null,
      sortOrder: normalizeSortOrder(body.sort_order),
    },
  };
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  try {
    const video = await env.NAV_DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
    if (!video) return errorResponse('video not found', 404);
    return jsonResponse({ code: 200, data: video });
  } catch (e) {
    return errorResponse(`获取视频详情失败: ${e.message}`, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const id = params.id;
  if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);

  try {
    const existing = await env.NAV_DB.prepare('SELECT id FROM videos WHERE id = ?').bind(id).first();
    if (!existing) return errorResponse('video not found', 404);

    const body = await request.json();
    const parsed = normalizeVideoPayload(body);
    if (!parsed.ok) return errorResponse(parsed.message, 400);

    const payload = parsed.value;
    if (!payload.categoryId) return errorResponse('视频分类不能为空', 400);

    const category = await env.NAV_DB.prepare('SELECT name FROM video_categories WHERE id = ?').bind(payload.categoryId).first();
    if (!category) return errorResponse('视频分类不存在', 400);

    await env.NAV_DB.prepare(`
      UPDATE videos
      SET title = ?, url = ?, cover = ?, desc = ?, category_id = ?, category_name = ?, platform = ?, bvid = ?, aid = ?, cid = ?, page = ?, youtube_id = ?, douyin_id = ?, video_url = ?, sort_order = ?, update_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      payload.title,
      payload.url,
      payload.cover,
      payload.desc,
      payload.categoryId,
      category.name,
      payload.platform,
      payload.bvid,
      payload.aid,
      payload.cid,
      payload.page,
      payload.youtubeId,
      payload.douyinId,
      payload.videoUrl,
      payload.sortOrder,
      id,
    ).run();

    return jsonResponse({ code: 200, message: '视频已更新' });
  } catch (e) {
    return errorResponse(`更新视频失败: ${e.message}`, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const id = params.id;
  if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);

  try {
    const existing = await env.NAV_DB.prepare('SELECT id FROM videos WHERE id = ?').bind(id).first();
    if (!existing) return errorResponse('video not found', 404);

    await env.NAV_DB.prepare('DELETE FROM videos WHERE id = ?').bind(id).run();
    return jsonResponse({ code: 200, message: '视频已删除' });
  } catch (e) {
    return errorResponse(`删除视频失败: ${e.message}`, 500);
  }
}
