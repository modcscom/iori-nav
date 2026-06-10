import { getSettingsKeys, parseSettings } from './lib/settings-parser';
import { sanitizeUrl, escapeHTML } from './lib/utils';

let cachedVideosHtml = null;

async function getVideosTemplate(env, requestUrl) {
  if (cachedVideosHtml !== null) return cachedVideosHtml;
  const res = await env.ASSETS.fetch(new URL('/videos.html', requestUrl));
  cachedVideosHtml = await res.text();
  return cachedVideosHtml;
}

function getStyleStr(size, color, font) {
  const styles = [];
  if (size) styles.push(`font-size:${size}`);
  if (color) styles.push(`color:${color}`);
  if (font) styles.push(`font-family:${font}`);
  return styles.length ? `style="${styles.join(';')}"` : '';
}

function normalizeCssPixelValue(value, fallback) {
  const normalized = String(value ?? '').trim().replace(/[^0-9]/g, '');
  if (normalized === '') return String(fallback);
  return normalized;
}

export async function onRequestGet(context) {
  const { env, request } = context;

  // 获取设置
  const settingsKeys = getSettingsKeys();
  const settingsPlaceholders = settingsKeys.map(() => '?').join(',');

  const fetchSettings = async () => {
    try {
      const cached = await env.NAV_AUTH.get('settings_cache', { type: 'json' });
      if (cached) return { results: cached, fromCache: true };
    } catch (e) {
      console.warn('Settings cache read failed:', e);
    }
    const result = await env.NAV_DB.prepare(`SELECT key, value FROM settings WHERE key IN (${settingsPlaceholders})`).bind(...settingsKeys).all();
    if (result.results && env.NAV_AUTH) {
      context.waitUntil(env.NAV_AUTH.put('settings_cache', JSON.stringify(result.results), { expirationTtl: 86400 }));
    }
    return result;
  };

  const [settingsResult, templateHtml] = await Promise.all([
    fetchSettings().catch(e => ({ results: [], error: e })),
    getVideosTemplate(env, request.url)
  ]);

  const S = parseSettings(settingsResult.results || settingsResult);

  // 应用美化设置
  let html = templateHtml;

  // 站点名称和描述
  const siteName = S.home_site_name || env.SITE_NAME || '灰色轨迹';
  const siteDescription = S.home_site_description || env.SITE_DESCRIPTION || '视频中心';

  // 标题样式
  const titleStyle = getStyleStr(S.home_title_size, S.home_title_color, S.home_title_font);
  const subtitleStyle = getStyleStr(S.home_subtitle_size, S.home_subtitle_color, S.home_subtitle_font);

  // 背景壁纸
  const safeWallpaperUrl = sanitizeUrl(S.layout_custom_wallpaper);
  const defaultBgColor = '#fdf8f3';
  let bgLayerHtml = '';
  if (safeWallpaperUrl) {
    const blurStyle = S.layout_enable_bg_blur ? `filter: blur(${S.layout_bg_blur_intensity}px); transform: scale(1.02);` : '';
    bgLayerHtml = `<div id="fixed-background" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -9999; pointer-events: none; overflow: hidden;"><img src="${safeWallpaperUrl}" alt="" fetchpriority="high" style="width: 100%; height: 100%; object-fit: cover; ${blurStyle}" /></div>`;
  } else {
    bgLayerHtml = `<div id="fixed-background" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -9999; pointer-events: none; background-color: ${defaultBgColor};"></div>`;
  }

  // CSS 变量
  const cardRadius = normalizeCssPixelValue(S.layout_card_border_radius, 12);
  const frostedBlur = normalizeCssPixelValue(S.layout_frosted_glass_intensity, 15);

  // 构建 head 注入内容
  let headInjections = '';

  // 壁纸预加载
  if (safeWallpaperUrl) {
    headInjections += `<link rel="preload" as="image" href="${safeWallpaperUrl}">\n`;
  }

  // 全局样式
  headInjections += `<style>
    html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }
    body { background-color: transparent !important; }
    #fixed-background { transition: background-color 0.3s ease, filter 0.3s ease; }
  </style>`;

  // CSS 变量
  headInjections += `<style>:root { --card-radius: ${cardRadius}px; --frosted-glass-blur: ${frostedBlur}px; }</style>`;

  // 自定义字体
  const usedFonts = new Set();
  if (S.home_title_font) usedFonts.add(S.home_title_font);
  if (S.home_subtitle_font) usedFonts.add(S.home_subtitle_font);

  const FONT_MAP = {
    'zcoolkuaile': 'https://fonts.loli.net/css2?family=ZCOOL+KuaiLe&display=swap',
    'zcoolqingke': 'https://fonts.loli.net/css2?family=ZCOOL+QingKe+HuangYou&display=swap',
    'maoshan': 'https://fonts.loli.net/css2?family=Ma+Shan+Zheng&display=swap',
    'longcang': 'https://fonts.loli.net/css2?family=Long+Cang&display=swap',
    'notosans': 'https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap',
    'notoserif': 'https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@400;500;700&display=swap',
  };

  let fontLinksHtml = '';
  usedFonts.forEach(font => {
    if (font && FONT_MAP[font]) {
      fontLinksHtml += `<link rel="stylesheet" href="${FONT_MAP[font]}">`;
    }
  });
  if (fontLinksHtml) headInjections += fontLinksHtml;

  // 注入到 head
  html = html.replace('</head>', `${headInjections}\n</head>`);

  // 注入背景层
  html = html.replace('<body', `${bgLayerHtml}\n<body`);

  // 替换标题和描述
  html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHTML(siteName)} - 视频中心</title>`);
  html = html.replace('视频中心</h1>', `${escapeHTML(siteDescription)}</h1>`);
  html = html.replace('<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">按分类浏览视频，点击卡片即可播放</p>',
    `<p class="text-sm text-gray-500 dark:text-gray-400 mt-1" ${subtitleStyle}>按分类浏览视频，点击卡片即可播放</p>`);

  // 应用标题样式
  if (titleStyle) {
    html = html.replace('<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">',
      `<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100" ${titleStyle}>`);
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
