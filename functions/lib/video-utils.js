import { normalizeSortOrder } from './utils';

export function normalizeVideoPlatform(value) {
  const platform = String(value || 'link').trim().toLowerCase();
  return ['bilibili', 'youtube', 'douyin', 'link'].includes(platform) ? platform : 'link';
}

export function normalizeVideoPage(value) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function mapVideoRow(row) {
  if (!row) return null;
  return {
    ...row,
    platform: normalizeVideoPlatform(row.platform),
    page: normalizeVideoPage(row.page),
    sort_order: normalizeSortOrder(row.sort_order),
  };
}

export function buildVideoTree(categories, videos) {
  const map = new Map();
  const roots = [];

  categories.forEach(category => {
    map.set(category.id, {
      ...category,
      sort_order: normalizeSortOrder(category.sort_order),
      children: [],
      videos: [],
    });
  });

  categories.forEach(category => {
    const node = map.get(category.id);
    if (category.parent_id && map.has(category.parent_id)) {
      map.get(category.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  videos.forEach(video => {
    const node = map.get(video.category_id);
    if (node) node.videos.push(mapVideoRow(video));
  });

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    nodes.forEach(node => {
      node.videos.sort((a, b) => a.sort_order - b.sort_order || b.id - a.id);
      sortNodes(node.children);
    });
  };

  sortNodes(roots);
  return roots;
}
