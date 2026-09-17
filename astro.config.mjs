import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import dayjs from 'dayjs';
import fs from 'fs';
import { defineConfig } from 'astro/config';
import { parse } from 'node-html-parser';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { SITE } from './src/config';

function fetchMdImg(file){
  const regex = /!\[.*?\]\((.*?)\)/;
  const match = file.match(regex);
  const img = match ? match[1] : '';
  return img
}
function defaultLayoutPlugin() {
  return function (tree, file) {
    const filePath = file.history[0];
    file.data.astro.frontmatter.layout = '@layouts/post.astro';

    // 头图放到文档中的第一行，会自动帮你处理，也可以用 frontmatter 方式，赋值给 pic 字段
    if (tree.children[0]?.value) {
      const imageElement = parse(tree.children[0].value).querySelector('img');
      file.data.astro.frontmatter.pic = imageElement.getAttribute('src');
    }

    // 描述放到文档中头图的下一行，会自动帮你处理，也可以用 frontmatter 方式，赋值给 desc 字段
    if (tree.children[1]?.children[1]?.value) {
      file.data.astro.frontmatter.desc = tree.children[1].children[1].value;
    }

    const { date, desc, pic } = file.data.astro.frontmatter;

    // 兼容没有描述情况
    if (!desc) {
      file.data.astro.frontmatter.desc = SITE.cardDesc || SITE.description;
    }

    // 兼容没有头图的情况
    if (!pic) {
      file.data.astro.frontmatter.pic =  SITE.pic || fetchMdImg(file.value);
    }

    //这里也可以直接在 frontmatter，赋值给 date 字段
    if (!date) {
      const createDate = dayjs(fs.statSync(filePath).birthtime).format(
        'YYYY-MM-DD',
      );

      file.data.astro.frontmatter.date = createDate;
    }
  };
}

// Notion 同步导出的条目标题是纯文本（超链接丢失），构建时自动还原：
// 规则1：标题含 "GitHub - owner/repo" 或开头为 "owner/repo" → 链接到 GitHub 仓库
// 规则2：标题无仓库标识时，用紧随其后的描述段落里出现的第一个链接作为标题链接
function autoLinkEntryTitles() {
  const OWNER = '(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{1,39}';
  const REPO = '(?=[A-Za-z0-9_.-]*[A-Za-z])[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_.-]+)*';
  // 形式1：GitHub - owner/repo（标题任意位置）
  const GH_RE = new RegExp(`GitHub[ \\t]*-[ \\t]*(${OWNER}/${REPO})`, 'g');
  // 形式2：条目编号 "N、" 后紧跟的 owner/repo（仅标题开头，避免误链 Bilibili/YouTube 之类词组）
  const LEAD_RE = new RegExp(
    `^(\\d+、[ \\t]*)(${OWNER}/${REPO})(?=$|[:：\\s(（.,，。;；!！?？)）])`,
  );
  const NUM_RE = /^(\d+、[ \t]*)/;

  const text = (value) => ({ type: 'text', value });
  const link = (value, url) => ({
    type: 'link',
    url,
    title: null,
    children: [text(value)],
  });

  // 拆分文本中的 "GitHub - owner/repo"
  function linkifyGitHub(value) {
    const parts = [];
    let last = 0;
    GH_RE.lastIndex = 0;
    let m;
    while ((m = GH_RE.exec(value))) {
      if (m.index > last) parts.push(text(value.slice(last, m.index)));
      parts.push(link(m[0], `https://github.com/${m[1]}`));
      last = m.index + m[0].length;
    }
    if (last < value.length) parts.push(text(value.slice(last)));
    return parts;
  }

  const isEntryTitle = (node) => {
    if (node.type !== 'paragraph') return null;
    const strong = node.children.find((c) => c.type === 'strong');
    if (!strong) return null;
    const firstText = strong.children.find((c) => c.type === 'text');
    return firstText && NUM_RE.test(firstText.value) ? strong : null;
  };

  const hasLink = (node) =>
    node.children.some(function walk(c) {
      return c.type === 'link' || (c.children && c.children.some(walk));
    });

  return (tree) => {
    tree.children.forEach((node, i) => {
      const strong = isEntryTitle(node);
      if (!strong || hasLink(strong)) return;

      // 规则1
      strong.children = strong.children.flatMap((c, idx) => {
        if (c.type !== 'text') return [c];
        const ghParts = linkifyGitHub(c.value);
        if (ghParts.some((p) => p.type === 'link')) return ghParts;
        // 没有 GitHub 前缀时，仅在编号后的第一个文本节点尝试 "N、owner/repo"
        if (idx === 0) {
          const m = c.value.match(LEAD_RE);
          if (m) {
            return [
              text(m[1]),
              link(m[2], `https://github.com/${m[2]}`),
              ...(c.value.slice(m[0].length)
                ? [text(c.value.slice(m[0].length))]
                : []),
            ];
          }
        }
        return [c];
      });

      // 规则2
      if (!strong.children.some((c) => c.type === 'link')) {
        const next = tree.children[i + 1];
        if (next && next.type === 'paragraph') {
          const urlNode = next.children.find(
            (c) => c.type === 'link' && /^https?:\/\//.test(c.url),
          );
          if (urlNode) {
            strong.children = strong.children
              .map((c) => {
                if (c.type !== 'text') return [c];
                const m = c.value.match(NUM_RE);
                if (!m) return [c];
                const rest = c.value.slice(m[0].length);
                return rest ? [text(m[1]), link(rest, urlNode.url)] : [c];
              })
              .flat();
          }
        }
      }
    });
  };
}

// https://astro.build/config
export default defineConfig({
  // 站点根地址：sitemap/canonical/绝对链接依赖它
  site: SITE.homePage,
  integrations: [react(), tailwind()],
  markdown: {
    remarkPlugins: [
      defaultLayoutPlugin,
      autoLinkEntryTitles,
    ],
    extendDefaultPlugins: true,
    rehypePlugins: [
      // 给标题生成稳定的 id（TOC 跳转依赖它）
      rehypeSlug,
      // 给每个标题追加可点击的 # 锚点链接，hover 时显示
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          content: { type: 'text', value: '#' },
          properties: { className: ['header-anchor'], 'aria-hidden': 'true' },
        },
      ],
    ],
  },
});
