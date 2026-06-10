import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder } from '../../_middleware';
import { escapeLikePattern, parsePagination } from '../../lib/utils';
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
      sortOrder: normalizeSortOrder(body.sort_order),
    },
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(url.searchParams, { maxPageSize: 200 });
  const categoryId = url.searchParams.get('categoryId');
  const keyword = url.searchParams.get('keyword');

  try {
    let queryBase = 'FROM videos WHERE 1 = 1';
    const bindParams = [];

    if (categoryId) {
      queryBase += ' AND category_id = ?';
      bindParams.push(Number(categoryId));
    }

    if (keyword) {
      const escaped = escapeLikePattern(keyword);
      queryBase += " AND (title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\' OR category_name LIKE ? ESCAPE '\\' OR desc LIKE ? ESCAPE '\\')";
      bindParams.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    }

    const { results } = await env.NAV_DB.prepare(`SELECT * ${queryBase} ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?`)
      .bind(...bindParams, pageSize, offset)
      .all();
    const countResult = await env.NAV_DB.prepare(`SELECT COUNT(*) AS total ${queryBase}`).bind(...bindParams).first();

    return jsonResponse({ code: 200, data: results, total: countResult?.total || 0, page, pageSize });
  } catch (e) {
    return errorResponse(`获取视频列表失败: ${e.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);

  try {
    const body = await request.json();
    const parsed = normalizeVideoPayload(body);
    if (!parsed.ok) return errorResponse(parsed.message, 400);

    const payload = parsed.value;
    if (!payload.categoryId) return errorResponse('视频分类不能为空', 400);

    const category = await env.NAV_DB.prepare('SELECT name FROM video_categories WHERE id = ?').bind(payload.categoryId).first();
    if (!category) return errorResponse('视频分类不存在', 400);

    const insert = await env.NAV_DB.prepare(`
      INSERT INTO videos (title, url, cover, desc, category_id, category_name, platform, bvid, aid, cid, page, youtube_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      payload.sortOrder,
    ).run();

    return jsonResponse({ code: 201, message: '视频创建成功', insert }, 201);
  } catch (e) {
    return errorResponse(`创建视频失败: ${e.message}`, 500);
  }
}
