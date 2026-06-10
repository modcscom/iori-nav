import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder } from '../../_middleware';
import { normalizeRequiredText } from '../../lib/validators';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const categoryId = params.id;
  if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);

  try {
    const body = await request.json();

    if (body?.reset) {
      const hasChildren = await env.NAV_DB.prepare('SELECT id FROM video_categories WHERE parent_id = ? LIMIT 1').bind(categoryId).first();
      if (hasChildren) return errorResponse('无法删除：该视频分类包含子分类', 400);

      const hasVideos = await env.NAV_DB.prepare('SELECT id FROM videos WHERE category_id = ? LIMIT 1').bind(categoryId).first();
      if (hasVideos) return errorResponse('无法删除：该视频分类包含视频', 400);

      await env.NAV_DB.prepare('DELETE FROM video_categories WHERE id = ?').bind(categoryId).run();
      return jsonResponse({ code: 200, message: '视频分类已删除' });
    }

    const nameResult = normalizeRequiredText(body.name, '视频分类名称', 80);
    if (!nameResult.ok) return errorResponse(nameResult.message, 400);

    const parentId = body.parent_id !== undefined ? parseInt(body.parent_id, 10) : 0;
    if (parentId !== 0 && String(parentId) === String(categoryId)) return errorResponse('分类不能设为自身的子分类', 400);

    if (parentId !== 0) {
      let currentParent = parentId;
      const visited = new Set([parseInt(categoryId, 10)]);
      let depth = 0;
      while (currentParent !== 0 && depth++ < 20) {
        if (visited.has(currentParent)) return errorResponse('不允许创建循环引用的分类层级', 400);
        visited.add(currentParent);
        const row = await env.NAV_DB.prepare('SELECT parent_id FROM video_categories WHERE id = ?').bind(currentParent).first();
        if (!row) return errorResponse('父级视频分类不存在', 400);
        currentParent = row.parent_id || 0;
      }
    }

    const duplicate = await env.NAV_DB.prepare('SELECT id FROM video_categories WHERE name = ? AND parent_id = ? AND id != ?')
      .bind(nameResult.value, parentId, categoryId)
      .first();
    if (duplicate) return errorResponse('该视频分类名称在当前父级下已存在', 409);

    const sortOrder = normalizeSortOrder(body.sort_order);
    await env.NAV_DB.batch([
      env.NAV_DB.prepare('UPDATE video_categories SET name = ?, sort_order = ?, parent_id = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(nameResult.value, sortOrder, parentId, categoryId),
      env.NAV_DB.prepare('UPDATE videos SET category_name = ? WHERE category_id = ?')
        .bind(nameResult.value, categoryId),
    ]);

    return jsonResponse({ code: 200, message: '视频分类已更新' });
  } catch (e) {
    return errorResponse(`处理视频分类失败: ${e.message}`, 500);
  }
}
