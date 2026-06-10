import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder } from '../../_middleware';
import { normalizeRequiredText } from '../../lib/validators';
import { parsePagination } from '../../lib/utils';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(url.searchParams, { maxPageSize: 10000 });

  try {
    const { results } = await env.NAV_DB.prepare(`
      SELECT c.id, c.name, c.sort_order, c.parent_id, COUNT(v.id) AS video_count
      FROM video_categories c
      LEFT JOIN videos v ON c.id = v.category_id
      GROUP BY c.id, c.name, c.sort_order, c.parent_id
      ORDER BY c.sort_order ASC, c.id ASC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all();
    const countResult = await env.NAV_DB.prepare('SELECT COUNT(*) AS total FROM video_categories').first();

    return jsonResponse({ code: 200, data: results, total: countResult?.total || 0, page, pageSize });
  } catch (e) {
    return errorResponse(`获取视频分类失败: ${e.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);

  try {
    const body = await request.json();
    const nameResult = normalizeRequiredText(body.name, '视频分类名称', 80);
    if (!nameResult.ok) return errorResponse(nameResult.message, 400);

    const parentId = body.parent_id ? parseInt(body.parent_id, 10) : 0;
    if (parentId !== 0) {
      const parent = await env.NAV_DB.prepare('SELECT id FROM video_categories WHERE id = ?').bind(parentId).first();
      if (!parent) return errorResponse('父级视频分类不存在', 400);
    }

    const existing = await env.NAV_DB.prepare('SELECT id FROM video_categories WHERE name = ? AND parent_id = ?')
      .bind(nameResult.value, parentId)
      .first();
    if (existing) return errorResponse('该视频分类名称在当前父级下已存在', 409);

    const sortOrder = normalizeSortOrder(body.sort_order);
    const insert = await env.NAV_DB.prepare('INSERT INTO video_categories (name, sort_order, parent_id) VALUES (?, ?, ?)')
      .bind(nameResult.value, sortOrder, parentId)
      .run();

    return jsonResponse({ code: 201, message: '视频分类创建成功', insert }, 201);
  } catch (e) {
    return errorResponse(`创建视频分类失败: ${e.message}`, 500);
  }
}
