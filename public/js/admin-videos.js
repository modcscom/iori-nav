(function () {
  const state = {
    categories: [],
    categoryTree: [],
    videos: [],
    currentVideoPage: 1,
    videoPageSize: 50,
    videoTotal: 0,
    currentCategoryParentId: null,
  };

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHTML(value) {
    return window.escapeHTML ? window.escapeHTML(value) : String(value || '');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  function openModal(modal) {
    if (!modal) return;
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
  }

  function normalizeVideoCategoryRows(rows) {
    return (rows || []).map(item => ({
      ...item,
      catelog: item.name,
      children: [],
    }));
  }

  function buildTree(rows) {
    const map = new Map();
    const roots = [];

    rows.forEach(item => map.set(item.id, { ...item, children: [] }));
    rows.forEach(item => {
      const node = map.get(item.id);
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortRecursive = nodes => {
      nodes.sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.id - b.id);
      nodes.forEach(node => sortRecursive(node.children));
    };
    sortRecursive(roots);
    return roots;
  }

  function findCategory(id) {
    return state.categories.find(item => String(item.id) === String(id));
  }

  function getVideoPayload() {
    return {
      title: els.videoTitle.value.trim(),
      url: els.videoUrl.value.trim(),
      cover: els.videoCover.value.trim(),
      desc: els.videoDesc.value.trim(),
      category_id: Number(els.videoCategory.value),
      platform: els.videoPlatform.value,
      bvid: els.videoBvid.value.trim(),
      aid: els.videoAid.value.trim(),
      cid: els.videoCid.value.trim(),
      page: Number(els.videoPage.value || 1),
      youtube_id: els.videoYoutubeId.value.trim(),
      douyin_id: els.videoDouyinId.value.trim(),
      video_url: els.videoVideoUrl?.value?.trim() || '',
      sort_order: els.videoSortOrder.value === '' ? undefined : Number(els.videoSortOrder.value),
    };
  }

  function getVideoCategoryPayload() {
    return {
      name: els.videoCategoryName.value.trim(),
      parent_id: Number(els.videoCategoryParent.value || 0),
      sort_order: els.videoCategorySortOrder.value === '' ? undefined : Number(els.videoCategorySortOrder.value),
    };
  }

  function createVideoDropdown(containerId, inputId, initialValue = null, excludeId = null) {
    if (typeof window.createCascadingDropdown === 'function') {
      window.createCascadingDropdown(containerId, inputId, state.categoryTree, initialValue, excludeId);
    }
  }

  async function loadVideoCategories() {
    const res = await fetch('/api/video-categories?pageSize=10000');
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.message || '加载视频分类失败');
    state.categories = normalizeVideoCategoryRows(data.data || []);
    state.categoryTree = buildTree(state.categories);
    return data;
  }

  async function loadVideos(page = state.currentVideoPage) {
    if (!els.videoGrid) return;
    state.currentVideoPage = page;
    els.videoGrid.innerHTML = '<div class="col-span-full text-center py-10">加载中...</div>';

    const params = new URLSearchParams({ page: String(page), pageSize: String(state.videoPageSize) });
    if (els.videoKeyword?.value) params.set('keyword', els.videoKeyword.value.trim());
    if (els.videoCategoryFilter?.value) params.set('categoryId', els.videoCategoryFilter.value);

    const res = await fetch(`/api/videos?${params.toString()}`);
    const data = await res.json();
    if (data.code !== 200) {
      els.videoGrid.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">加载失败</div>';
      window.showMessage?.(data.message || '加载视频失败', 'error');
      return;
    }

    state.videos = data.data || [];
    state.videoTotal = data.total || 0;
    state.currentVideoPage = data.page || page;
    renderVideos();
    updateVideoPagination();
  }

  function renderVideos() {
    if (!els.videoGrid) return;
    if (!state.videos.length) {
      els.videoGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">暂无视频数据</div>';
      return;
    }

    els.videoGrid.innerHTML = state.videos.map(video => {
      const cover = video.cover ? `<img src="${escapeHTML(video.cover)}" alt="" class="w-full h-32 object-cover bg-gray-100">` : '<div class="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400">无封面</div>';
      return `
        <div class="site-card group bg-white border border-primary-100/60 rounded-xl shadow-sm overflow-hidden relative" data-video-id="${video.id}">
          <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <button class="video-edit-btn p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200" data-video-id="${video.id}" title="编辑">编辑</button>
            <button class="video-del-btn p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200" data-video-id="${video.id}" title="删除">删除</button>
          </div>
          ${cover}
          <div class="p-4">
            <div class="flex items-center justify-between gap-2 mb-2">
              <h3 class="font-medium text-gray-900 truncate" title="${escapeHTML(video.title)}">${escapeHTML(video.title)}</h3>
              <span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">${escapeHTML(video.platform)}</span>
            </div>
            <p class="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">${escapeHTML(video.desc || '')}</p>
            <div class="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>${escapeHTML(video.category_name || '未分类')}</span>
              <span>排序: ${video.sort_order === 9999 ? '默认' : video.sort_order}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    els.videoGrid.querySelectorAll('.video-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openVideoForm(state.videos.find(item => String(item.id) === String(btn.dataset.videoId))));
    });
    els.videoGrid.querySelectorAll('.video-del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteVideo(btn.dataset.videoId));
    });
  }

  function updateVideoPagination() {
    const totalPages = Math.max(1, Math.ceil(state.videoTotal / state.videoPageSize));
    if (els.videoCurrentPage) els.videoCurrentPage.textContent = state.currentVideoPage;
    if (els.videoTotalPages) els.videoTotalPages.textContent = totalPages;
    if (els.videoPrevPage) els.videoPrevPage.disabled = state.currentVideoPage <= 1;
    if (els.videoNextPage) els.videoNextPage.disabled = state.currentVideoPage >= totalPages;
  }

  function renderVideoCategoryCards(parentId = state.currentCategoryParentId) {
    if (!els.videoCategoryGrid) return;
    state.currentCategoryParentId = parentId;

    const nodes = parentId ? (findCategoryNode(state.categoryTree, parentId)?.children || []) : state.categoryTree;
    updateVideoCategoryBreadcrumb(parentId);

    if (!nodes.length) {
      els.videoCategoryGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">暂无视频分类</div>';
      return;
    }

    els.videoCategoryGrid.innerHTML = nodes.map(item => `
      <div class="site-card group bg-white border border-primary-100/60 rounded-xl shadow-sm overflow-hidden relative" data-video-category-id="${item.id}">
        <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button class="video-category-edit-btn p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200" data-video-category-id="${item.id}">编辑</button>
          <button class="video-category-del-btn p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200" data-video-category-id="${item.id}">删除</button>
        </div>
        <div class="p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-medium text-gray-900 truncate">${escapeHTML(item.name)}</h3>
            <span class="bg-primary-50 text-primary-700 text-xs px-2 py-1 rounded-full">ID: ${item.id}</span>
          </div>
          <div class="text-sm text-gray-500 flex gap-4">
            <span>${item.video_count || 0} 视频</span>
            <span>${item.children?.length || 0} 子分类</span>
            <span>排序: ${item.sort_order === 9999 ? '默认' : item.sort_order}</span>
          </div>
          <div class="mt-4 pt-3 border-t border-gray-100 flex justify-end">
            <button class="video-category-subs-btn text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100" data-video-category-id="${item.id}">管理子分类</button>
          </div>
        </div>
      </div>`).join('');

    els.videoCategoryGrid.querySelectorAll('.video-category-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openVideoCategoryForm(findCategory(btn.dataset.videoCategoryId)));
    });
    els.videoCategoryGrid.querySelectorAll('.video-category-del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteVideoCategory(btn.dataset.videoCategoryId));
    });
    els.videoCategoryGrid.querySelectorAll('.video-category-subs-btn').forEach(btn => {
      btn.addEventListener('click', () => renderVideoCategoryCards(btn.dataset.videoCategoryId));
    });
  }

  function findCategoryNode(nodes, id) {
    for (const node of nodes) {
      if (String(node.id) === String(id)) return node;
      const found = findCategoryNode(node.children || [], id);
      if (found) return found;
    }
    return null;
  }

  function updateVideoCategoryBreadcrumb(parentId) {
    if (!els.videoCategoryBackBtn || !els.videoCategoryBreadcrumb) return;
    if (!parentId) {
      els.videoCategoryBackBtn.classList.add('hidden');
      els.videoCategoryBreadcrumb.textContent = '顶级视频分类';
      return;
    }
    const current = findCategory(parentId);
    els.videoCategoryBreadcrumb.textContent = current ? current.name : '未知分类';
    els.videoCategoryBackBtn.classList.remove('hidden');
    els.videoCategoryBackBtn.onclick = () => renderVideoCategoryCards(current?.parent_id || null);
  }

  async function refreshAll() {
    await loadVideoCategories();
    renderVideoCategoryCards();
    createVideoDropdown('videoCategoryFilterWrapper', 'videoCategoryFilter');
    await loadVideos(1);
  }

  function openVideoCategoryForm(category = null) {
    els.videoCategoryForm.reset();
    els.videoCategoryId.value = category?.id || '';
    els.videoCategoryName.value = category?.name || '';
    els.videoCategorySortOrder.value = category && category.sort_order !== 9999 ? category.sort_order : '';
    els.videoCategoryModalTitle.textContent = category ? '编辑视频分类' : '新增视频分类';
    createVideoDropdown('videoCategoryParentWrapper', 'videoCategoryParent', category?.parent_id || '0', category?.id || null);
    openModal(els.videoCategoryModal);
  }

  async function openVideoForm(video = null) {
    // 确保视频分类数据已加载
    if (state.categories.length === 0) {
      try {
        await loadVideoCategories();
      } catch (e) {
        console.error('加载视频分类失败:', e);
      }
    }
    els.videoForm.reset();
    els.videoId.value = video?.id || '';
    els.videoTitle.value = video?.title || '';
    els.videoUrl.value = video?.url || '';
    els.videoCover.value = video?.cover || '';
    els.videoDesc.value = video?.desc || '';
    els.videoPlatform.value = video?.platform || 'bilibili';
    els.videoBvid.value = video?.bvid || '';
    els.videoAid.value = video?.aid || '';
    els.videoCid.value = video?.cid || '';
    els.videoPage.value = video?.page || 1;
    els.videoYoutubeId.value = video?.youtube_id || '';
    els.videoDouyinId.value = video?.douyin_id || '';
    els.videoVideoUrl.value = video?.video_url || '';
    els.videoSortOrder.value = video && video.sort_order !== 9999 ? video.sort_order : '';
    els.videoModalAdminTitle.textContent = video ? '编辑视频' : '新增视频';
    createVideoDropdown('videoCategoryWrapper', 'videoCategory', video?.category_id || null);
    updatePlatformFields();
    openModal(els.videoModalAdmin);
  }

  function updatePlatformFields() {
    const platform = els.videoPlatform?.value;
    els.bilibiliFields?.classList.toggle('hidden', platform !== 'bilibili');
    els.youtubeFields?.classList.toggle('hidden', platform !== 'youtube');
    els.douyinFields?.classList.toggle('hidden', platform !== 'douyin');
  }

  // 解析 Bilibili URL，提取 bvid/aid/cid/page
  function parseBilibiliUrl(url) {
    if (!url) return null;
    const trimmed = String(url).trim();

    // 匹配 BV 号
    const bvMatch = trimmed.match(/\/video\/(BV[\w]+)/i);
    const bvid = bvMatch ? bvMatch[1] : null;

    // 匹配 av 号 (aid)
    const avMatch = trimmed.match(/\/video\/(av\d+)/i);
    const aid = avMatch ? avMatch[1].replace(/^av/i, '') : null;

    // 匹配 P 参数 (分P)
    const pMatch = trimmed.match(/[?&]p=(\d+)/i);
    const page = pMatch ? parseInt(pMatch[1], 10) : 1;

    // 匹配 t 参数 (时间戳，可选)
    const tMatch = trimmed.match(/[?&]t=(\d+)/i);
    const startTime = tMatch ? parseInt(tMatch[1], 10) : null;

    if (!bvid && !aid) return null;

    return { bvid, aid, page: page || 1, startTime, platform: 'bilibili' };
  }

  // 解析 YouTube URL，提取 videoId
  function parseYoutubeUrl(url) {
    if (!url) return null;
    const trimmed = String(url).trim();

    // 匹配 youtu.be/xxx
    const shortMatch = trimmed.match(/youtu\.be\/([\w-]+)/i);
    if (shortMatch) return { youtubeId: shortMatch[1], platform: 'youtube' };

    // 匹配 youtube.com/watch?v=xxx
    const watchMatch = trimmed.match(/[?&]v=([\w-]+)/i);
    if (watchMatch) return { youtubeId: watchMatch[1], platform: 'youtube' };

    // 匹配 youtube.com/embed/xxx
    const embedMatch = trimmed.match(/embed\/([\w-]+)/i);
    if (embedMatch) return { youtubeId: embedMatch[1], platform: 'youtube' };

    return null;
  }

  // 解析抖音 URL，提取视频 ID
  function parseDouyinUrl(url) {
    if (!url) return null;
    const trimmed = String(url).trim();

    // 匹配 v.douyin.com/xxx 格式
    const douyinMatch = trimmed.match(/v\.douyin\.com\/([\w-]+)/i);
    if (douyinMatch) return { douyinId: douyinMatch[1], platform: 'douyin' };

    // 匹配长链接格式
    const longMatch = trimmed.match(/douyin\.com\/video\/(\d+)/i);
    if (longMatch) return { douyinId: longMatch[1], platform: 'douyin' };

    return null;
  }

  // 从后端代理获取 Bilibili 视频信息（解决 CORS 问题）
  async function fetchBilibiliVideoInfo(bvid) {
    try {
      const res = await fetch(`/api/videos/bilibili-info?bvid=${encodeURIComponent(bvid)}`);
      const result = await res.json();
      if (result.code === 200 && result.data) {
        return result.data;
      }
    } catch (e) {
      console.warn('获取 Bilibili 视频信息失败:', e);
    }
    return null;
  }

  // 从 YouTube oEmbed API 获取视频信息
  async function fetchYoutubeVideoInfo(videoId) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`);
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title,
          desc: '',
          cover: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        };
      }
    } catch (e) {
      console.warn('获取 YouTube 视频信息失败:', e);
    }
    return null;
  }

  // 从后端代理获取抖音视频信息
  async function fetchDouyinVideoInfo(url) {
    try {
      const res = await fetch(`/api/videos/douyin-info?url=${encodeURIComponent(url)}`);
      const result = await res.json();
      if (result.code === 200 && result.data) {
        return result.data;
      }
    } catch (e) {
      console.warn('获取抖音视频信息失败:', e);
    }
    return null;
  }

  // 自动解析视频 URL 并填充相关字段
  async function autoParseVideoUrl() {
    const url = els.videoUrl?.value?.trim();
    if (!url) return;

    // 尝试解析 Bilibili
    const bilibiliInfo = parseBilibiliUrl(url);
    if (bilibiliInfo) {
      els.videoPlatform.value = 'bilibili';
      if (bilibiliInfo.bvid) els.videoBvid.value = bilibiliInfo.bvid;
      if (bilibiliInfo.aid) els.videoAid.value = bilibiliInfo.aid;
      els.videoPage.value = bilibiliInfo.page || 1;
      updatePlatformFields();

      // 获取视频标题和封面
      if (bilibiliInfo.bvid && !els.videoTitle.value.trim()) {
        const info = await fetchBilibiliVideoInfo(bilibiliInfo.bvid);
        if (info) {
          els.videoTitle.value = info.title || '';
          els.videoDesc.value = info.desc || '';
          els.videoCover.value = info.cover || '';
          if (info.aid) els.videoAid.value = info.aid;
          if (info.cid) els.videoCid.value = info.cid;
          console.log('✅ Bilibili 视频信息获取成功:', info.title);
        } else {
          // API 调用失败，提示用户手动填写
          console.warn('⚠️ 无法自动获取视频标题，请手动填写');
          // 尝试从 URL 中提取可能的标题信息
          const urlTitleMatch = url.match(/[?&]title=([^&]+)/i);
          if (urlTitleMatch) {
            els.videoTitle.value = decodeURIComponent(urlTitleMatch[1]);
          }
        }
      }
      return;
    }

    // 尝试解析 YouTube
    const youtubeInfo = parseYoutubeUrl(url);
    if (youtubeInfo) {
      els.videoPlatform.value = 'youtube';
      els.videoYoutubeId.value = youtubeInfo.youtubeId;
      updatePlatformFields();

      // 获取视频标题和封面
      if (youtubeInfo.youtubeId && !els.videoTitle.value.trim()) {
        const info = await fetchYoutubeVideoInfo(youtubeInfo.youtubeId);
        if (info) {
          els.videoTitle.value = info.title || '';
          els.videoDesc.value = info.desc || '';
          els.videoCover.value = info.cover || '';
        }
      }
      return;
    }

    // 尝试解析抖音
    const douyinInfo = parseDouyinUrl(url);
    if (douyinInfo) {
      els.videoPlatform.value = 'douyin';
      els.videoDouyinId.value = douyinInfo.douyinId;
      updatePlatformFields();

      // 获取视频信息
      if (!els.videoTitle.value.trim()) {
        const info = await fetchDouyinVideoInfo(url);
        if (info) {
          els.videoTitle.value = info.title || info.desc || '';
          els.videoDesc.value = info.desc || '';
          if (info.video_url) {
            els.videoVideoUrl.value = info.video_url;
          }
          console.log('✅ 抖音视频信息获取成功:', info.title || info.desc);
        } else {
          console.warn('⚠️ 无法自动获取视频标题，请手动填写');
        }
      }
      return;
    }

    // 默认普通链接
    els.videoPlatform.value = 'link';
    updatePlatformFields();
  }

  async function submitVideoCategory(event) {
    event.preventDefault();
    const id = els.videoCategoryId.value;
    const res = await fetch(id ? `/api/video-categories/${encodeURIComponent(id)}` : '/api/video-categories', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getVideoCategoryPayload()),
    });
    const data = await res.json();
    if (data.code === 200 || data.code === 201) {
      window.showMessage?.('保存成功', 'success');
      closeModal(els.videoCategoryModal);
      await refreshAll();
    } else {
      window.showMessage?.(data.message || '保存失败', 'error');
    }
  }

  async function submitVideo(event) {
    event.preventDefault();
    const payload = getVideoPayload();
    if (!payload.category_id) {
      window.showMessage?.('请选择视频分类', 'error');
      return;
    }
    const id = els.videoId.value;
    const res = await fetch(id ? `/api/videos/${encodeURIComponent(id)}` : '/api/videos', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.code === 200 || data.code === 201) {
      window.showMessage?.('保存成功', 'success');
      closeModal(els.videoModalAdmin);
      await loadVideos(state.currentVideoPage);
      await loadVideoCategories();
      renderVideoCategoryCards();
    } else {
      window.showMessage?.(data.message || '保存失败', 'error');
    }
  }

  async function deleteVideo(id) {
    if (!window.confirm('确定删除该视频吗？')) return;
    const res = await fetch(`/api/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.code === 200) {
      window.showMessage?.('删除成功', 'success');
      await loadVideos(state.currentVideoPage);
      await loadVideoCategories();
      renderVideoCategoryCards();
    } else {
      window.showMessage?.(data.message || '删除失败', 'error');
    }
  }

  async function deleteVideoCategory(id) {
    if (!window.confirm('确定删除该视频分类吗？')) return;
    const res = await fetch(`/api/video-categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
    const data = await res.json();
    if (data.code === 200) {
      window.showMessage?.('删除成功', 'success');
      await refreshAll();
    } else {
      window.showMessage?.(data.message || '删除失败', 'error');
    }
  }

  function cacheElements() {
    Object.assign(els, {
      addVideoCategoryBtn: $('addVideoCategoryBtn'),
      addVideoBtn: $('addVideoBtn'),
      videoCategoryModal: $('videoCategoryModal'),
      videoCategoryModalTitle: $('videoCategoryModalTitle'),
      videoCategoryForm: $('videoCategoryForm'),
      videoCategoryId: $('videoCategoryId'),
      videoCategoryName: $('videoCategoryName'),
      videoCategoryParent: $('videoCategoryParent'),
      videoCategorySortOrder: $('videoCategorySortOrder'),
      closeVideoCategoryModal: $('closeVideoCategoryModal'),
      cancelVideoCategoryBtn: $('cancelVideoCategoryBtn'),
      videoModalAdmin: $('videoModalAdmin'),
      videoModalAdminTitle: $('videoModalAdminTitle'),
      videoForm: $('videoForm'),
      videoId: $('videoId'),
      videoTitle: $('videoTitle'),
      videoUrl: $('videoUrl'),
      videoCover: $('videoCover'),
      videoDesc: $('videoDesc'),
      videoCategory: $('videoCategory'),
      videoPlatform: $('videoPlatform'),
      videoBvid: $('videoBvid'),
      videoAid: $('videoAid'),
      videoCid: $('videoCid'),
      videoPage: $('videoPage'),
      videoYoutubeId: $('videoYoutubeId'),
      videoDouyinId: $('videoDouyinId'),
      videoVideoUrl: $('videoVideoUrl'),
      videoSortOrder: $('videoSortOrder'),
      closeVideoModalAdmin: $('closeVideoModalAdmin'),
      cancelVideoBtn: $('cancelVideoBtn'),
      bilibiliFields: $('bilibiliFields'),
      youtubeFields: $('youtubeFields'),
      douyinFields: $('douyinFields'),
      videoCategoryGrid: $('videoCategoryGrid'),
      videoGrid: $('videoGrid'),
      videoKeyword: $('videoKeyword'),
      videoCategoryFilter: $('videoCategoryFilter'),
      videoPrevPage: $('videoPrevPage'),
      videoNextPage: $('videoNextPage'),
      videoCurrentPage: $('videoCurrentPage'),
      videoTotalPages: $('videoTotalPages'),
      videoPageSizeSelect: $('videoPageSizeSelect'),
      videoCategoryBackBtn: $('videoCategoryBackBtn'),
      videoCategoryBreadcrumb: $('videoCategoryBreadcrumb'),
    });
  }

  function bindEvents() {
    els.addVideoCategoryBtn?.addEventListener('click', () => openVideoCategoryForm());
    els.addVideoBtn?.addEventListener('click', () => openVideoForm());
    els.closeVideoCategoryModal?.addEventListener('click', () => closeModal(els.videoCategoryModal));
    els.cancelVideoCategoryBtn?.addEventListener('click', () => closeModal(els.videoCategoryModal));
    els.closeVideoModalAdmin?.addEventListener('click', () => closeModal(els.videoModalAdmin));
    els.cancelVideoBtn?.addEventListener('click', () => closeModal(els.videoModalAdmin));
    els.videoCategoryForm?.addEventListener('submit', submitVideoCategory);
    els.videoForm?.addEventListener('submit', submitVideo);
    els.videoPlatform?.addEventListener('change', updatePlatformFields);
    els.videoKeyword?.addEventListener('input', () => loadVideos(1));
    els.videoCategoryFilter?.addEventListener('change', () => loadVideos(1));
    els.videoPrevPage?.addEventListener('click', () => state.currentVideoPage > 1 && loadVideos(state.currentVideoPage - 1));
    els.videoNextPage?.addEventListener('click', () => loadVideos(state.currentVideoPage + 1));
    els.videoPageSizeSelect?.addEventListener('change', () => {
      state.videoPageSize = Number(els.videoPageSizeSelect.value || 50);
      loadVideos(1);
    });

    // 视频 URL 自动解析
    els.videoUrl?.addEventListener('blur', autoParseVideoUrl);
    els.videoUrl?.addEventListener('paste', (e) => {
      // 延迟执行，等待粘贴内容生效
      setTimeout(autoParseVideoUrl, 0);
    });
  }

  async function init() {
    cacheElements();
    bindEvents();
    if (els.videoPageSizeSelect) els.videoPageSizeSelect.value = String(state.videoPageSize);
  }

  window.AdminVideos = {
    init,
    refreshAll,
  };
})();
