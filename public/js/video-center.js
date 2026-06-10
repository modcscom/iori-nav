(function () {
  const state = {
    tree: [],
    flatVideos: [],
    selectedVideo: null,
    isPlayerMode: false,
  };

  const contentEl = document.getElementById('videoContent');
  const playlistEl = document.getElementById('videoPlaylist');
  const searchInput = document.getElementById('videoSearchInput');
  const gridModeEl = document.getElementById('videoGridMode');
  const playerModeEl = document.getElementById('videoPlayerMode');
  const playerBoxEl = document.getElementById('videoPlayerBox');
  const selectedTitleEl = document.getElementById('selectedVideoTitle');
  const selectedDescEl = document.getElementById('selectedVideoDesc');
  const modeToggleBtn = document.getElementById('videoModeToggle');
  const modalEl = document.getElementById('videoModal');
  const modalPlayerEl = document.getElementById('videoModalPlayer');
  const modalTitleEl = document.getElementById('videoModalTitle');
  const modalDescEl = document.getElementById('videoModalDesc');
  const closeModalBtn = document.getElementById('closeVideoModal');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function normalizeUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('//')) return 'https:' + trimmed;
    return trimmed;
  }

  function getVideoEmbedHtml(video) {
    if (!video) return '<div class="w-full h-full flex items-center justify-center text-gray-400">暂无视频</div>';

    // Bilibili 播放 - 只需要 bvid 即可播放
    if (video.platform === 'bilibili' && video.bvid) {
      const src = `https://player.bilibili.com/player.html?isOutside=true&bvid=${encodeURIComponent(video.bvid)}&p=${encodeURIComponent(video.page || 1)}&autoplay=1`;
      return `<iframe src="${src}" class="w-full h-full border-0" allowfullscreen scrolling="no"></iframe>`;
    }

    // YouTube 播放
    if (video.platform === 'youtube' && video.youtube_id) {
      const src = `https://www.youtube.com/embed/${encodeURIComponent(video.youtube_id)}?autoplay=1`;
      return `<iframe src="${src}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }

    // 普通链接 - 尝试用 iframe 打开
    const safeUrl = normalizeUrl(video.url);
    if (safeUrl) {
      return `<iframe src="${escapeHTML(safeUrl)}" class="w-full h-full border-0" allowfullscreen></iframe>`;
    }

    return `<div class="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-300"><p>该视频暂不支持内嵌播放</p><a class="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700" href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer">新窗口打开</a></div>`;
  }

  function flattenTree(nodes, bucket) {
    nodes.forEach(node => {
      (node.videos || []).forEach(video => bucket.push(video));
      if (node.children?.length) flattenTree(node.children, bucket);
    });
  }

  function renderVideoCard(video) {
    const cover = normalizeUrl(video.cover);
    const badge = video.platform === 'bilibili'
      ? '<span class="absolute top-3 left-3 px-2 py-1 rounded-md bg-pink-500/90 text-white text-xs">bilibili</span>'
      : video.platform === 'youtube'
        ? '<span class="absolute top-3 left-3 px-2 py-1 rounded-md bg-red-600/90 text-white text-xs">YouTube</span>'
        : '<span class="absolute top-3 left-3 px-2 py-1 rounded-md bg-slate-700/90 text-white text-xs">链接</span>';

    return `
      <button class="video-card group text-left w-full overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all" data-video-id="${video.id}">
        <div class="relative aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden">
          ${cover ? `<img src="${escapeHTML(cover)}" alt="${escapeHTML(video.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">` : `<div class="w-full h-full flex items-center justify-center text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.868v4.264a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>`}
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.868v4.264a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
            </div>
          </div>
          ${badge}
        </div>
        <div class="p-4">
          <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">${escapeHTML(video.title)}</h3>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2rem]">${escapeHTML(video.desc || '')}</p>
        </div>
      </button>
    `;
  }

  function renderCategorySection(category, keyword) {
    const lowerKeyword = keyword.toLowerCase();
    const ownVideos = (category.videos || []).filter(video => {
      if (!lowerKeyword) return true;
      const text = `${video.title || ''} ${video.desc || ''} ${video.category_name || ''}`.toLowerCase();
      return text.includes(lowerKeyword);
    });

    const childrenHtml = (category.children || []).map(child => renderCategorySection(child, keyword)).filter(Boolean).join('');
    if (ownVideos.length === 0 && !childrenHtml) return '';

    const cardsHtml = ownVideos.length > 0 ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">${ownVideos.map(renderVideoCard).join('')}</div>` : '';
    return `
      <section class="space-y-4">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">${escapeHTML(category.name)}</h2>
        </div>
        ${cardsHtml}
        ${childrenHtml ? `<div class="pl-4 border-l border-gray-200 dark:border-gray-800 space-y-6">${childrenHtml}</div>` : ''}
      </section>
    `;
  }

  function renderGrid(keyword) {
    const html = state.tree.map(category => renderCategorySection(category, keyword || '')).filter(Boolean).join('');
    contentEl.innerHTML = html || '<div class="text-center text-gray-500 py-16">暂无视频数据</div>';

    contentEl.querySelectorAll('[data-video-id]').forEach(button => {
      button.addEventListener('click', function () {
        const video = state.flatVideos.find(item => String(item.id) === String(this.dataset.videoId));
        openVideoModal(video);
      });
    });
  }

  function renderPlaylist() {
    playlistEl.innerHTML = state.tree.map(category => {
      const directItems = (category.videos || []).map(video => renderPlaylistItem(video)).join('');
      const childItems = (category.children || []).map(child => renderPlaylistGroup(child)).join('');
      if (!directItems && !childItems) return '';
      return `
        <div class="space-y-2">
          <div class="font-medium text-sm text-gray-900 dark:text-gray-100">${escapeHTML(category.name)}</div>
          <div class="space-y-1">${directItems}${childItems}</div>
        </div>
      `;
    }).join('');

    playlistEl.querySelectorAll('[data-play-video-id]').forEach(button => {
      button.addEventListener('click', function () {
        const video = state.flatVideos.find(item => String(item.id) === String(this.dataset.playVideoId));
        selectVideo(video);
      });
    });
  }

  function renderPlaylistGroup(category) {
    const items = (category.videos || []).map(video => renderPlaylistItem(video)).join('');
    const children = (category.children || []).map(child => renderPlaylistGroup(child)).join('');
    if (!items && !children) return '';
    return `
      <div class="ml-3 pl-3 border-l border-gray-200 dark:border-gray-800 space-y-1">
        <div class="text-xs text-gray-500 dark:text-gray-400">${escapeHTML(category.name)}</div>
        ${items}
        ${children}
      </div>
    `;
  }

  function renderPlaylistItem(video) {
    const activeClass = state.selectedVideo && String(state.selectedVideo.id) === String(video.id)
      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800'
      : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 border-transparent';

    return `<button class="w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${activeClass}" data-play-video-id="${video.id}">${escapeHTML(video.title)}</button>`;
  }

  function selectVideo(video) {
    if (!video) return;
    state.selectedVideo = video;
    playerBoxEl.innerHTML = getVideoEmbedHtml(video);
    selectedTitleEl.textContent = video.title || '未命名视频';
    selectedDescEl.textContent = video.desc || '';
    renderPlaylist();
  }

  function openVideoModal(video) {
    if (!video) return;
    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
    modalPlayerEl.innerHTML = getVideoEmbedHtml(video);
    modalTitleEl.textContent = video.title || '未命名视频';
    modalDescEl.textContent = video.desc || '';
  }

  function closeVideoModal() {
    modalEl.classList.add('hidden');
    modalEl.classList.remove('flex');
    modalPlayerEl.innerHTML = '';
  }

  function toggleMode() {
    state.isPlayerMode = !state.isPlayerMode;
    if (state.isPlayerMode) {
      gridModeEl.classList.add('hidden');
      playerModeEl.classList.remove('hidden');
      modeToggleBtn.textContent = '卡片模式';
      if (!state.selectedVideo && state.flatVideos[0]) selectVideo(state.flatVideos[0]);
      renderPlaylist();
      return;
    }

    playerModeEl.classList.add('hidden');
    gridModeEl.classList.remove('hidden');
    modeToggleBtn.textContent = '播放器模式';
  }

  function initThemeToggle() {
    themeToggleBtn?.addEventListener('click', function () {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
    });
  }

  function bindEvents() {
    searchInput?.addEventListener('input', function () {
      renderGrid(this.value || '');
    });
    modeToggleBtn?.addEventListener('click', toggleMode);
    closeModalBtn?.addEventListener('click', closeVideoModal);
    modalEl?.addEventListener('click', function (event) {
      if (event.target === modalEl) closeVideoModal();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeVideoModal();
    });
  }

  fetch('/api/videos/public')
    .then(res => res.json())
    .then(result => {
      if (result.code !== 200) throw new Error(result.message || '加载失败');
      state.tree = result.data.tree || [];
      state.flatVideos = [];
      flattenTree(state.tree, state.flatVideos);
      renderGrid('');
      renderPlaylist();
    })
    .catch(error => {
      contentEl.innerHTML = `<div class="text-center text-red-500 py-16">${escapeHTML(error.message)}</div>`;
    });

  bindEvents();
  initThemeToggle();
})();
