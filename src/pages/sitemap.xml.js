// 站点地图：首页 + 全部文章。
// 不引入 @astrojs/sitemap（其依赖的 sitemap 库与 Astro 1.x 构建产物路径存在兼容问题），零依赖自生成。
import dayjs from 'dayjs';
import { SITE } from '@/config';
import { sortPosts } from '@/util';

let allPosts = import.meta.glob('./posts/*.md', { eager: true });
let posts = sortPosts(Object.values(allPosts));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const entries = [
  // 首页
  { loc: '/', lastmod: posts[0]?.frontmatter?.date },
  // 文章页（p.url 形如 /posts/53-本周见闻-20260511_20260518/）
  ...posts.map((p) => ({ loc: p.url, lastmod: p.frontmatter?.date })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(({ loc, lastmod }) => {
    const d = lastmod && dayjs(lastmod).isValid() ? `<lastmod>${dayjs(lastmod).format('YYYY-MM-DD')}</lastmod>` : '';
    return `  <url><loc>${esc(SITE.homePage + loc)}</loc>${d}</url>`;
  })
  .join('\n')}
</urlset>
`;

export const get = () => ({
  body: xml,
  headers: { 'Content-Type': 'application/xml; charset=utf-8' },
});
