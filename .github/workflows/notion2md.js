import { Client } from '@notionhq/client';
import moment from 'moment';
import fs from 'fs';
import path from 'path';
import dotEnv from 'dotenv';

if (!process.env.GITHUB_ACTIONS) {
  dotEnv.config();
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

const CONFIG = {
  days: 7,
  dir: './src/pages/posts',
  filename: '本周见闻',
};

// 读取拉取窗口：CLI 参数 > 环境变量 > 默认最近 7 天
// 回填用法：node notion2md.js --start 2026-05-11 --end 2026-05-18
function getFetchWindow() {
  const args = process.argv.slice(2);
  const arg = (name) => {
    const i = args.indexOf(name);
    return i > -1 && args[i + 1] ? args[i + 1] : null;
  };
  const end = arg('--end') || process.env.FETCH_END || moment().format('YYYY-MM-DD');
  const start =
    arg('--start') ||
    process.env.FETCH_START ||
    moment(end, 'YYYY-MM-DD').subtract(CONFIG.days, 'days').format('YYYY-MM-DD');
  return { start, end };
}

function formatStr(str) {
  if (!!str && str.trim()) {
    str = str.replace(/[&<>'"]/g, '');
    const url = str.replace(
      /(?![^\[]*\])(http|https):\/\/[\w\-]+\.[\w\-]+(\/[\w\-]+)*\b([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\\+#])?/g,
      function (match) {
        return `<${match}>`;
      }
    );
    return url;
  }
  return str;
}

function richTextToMd(richText) {
  if (!richText || !Array.isArray(richText) || richText.length === 0) {
    return '';
  }
  return richText
    .map((segment) => {
      const text = segment.plain_text || '';
      if (segment.href) {
        return `[${text}](${segment.href})`;
      }
      return text;
    })
    .join('');
}

async function main() {
  try {
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
      console.error(
        'Error: NOTION_TOKEN / NOTION_DATABASE_ID 未配置（GitHub Secrets 或本地 .env）'
      );
      process.exit(1);
    }

    const { start, end } = getFetchWindow();
    console.log(`拉取窗口: [${start}, ${end})`);

    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          {
            property: 'date',
            date: {
              on_or_after: start,
            },
          },
          {
            property: 'date',
            date: {
              before: end,
            },
          },
        ],
      },
      // 修复：sorts 必须与 filter 平级（原代码误嵌在 filter 内部）
      sorts: [
        {
          property: 'date',
          direction: 'ascending',
        },
      ],
    });

    console.log(`本次共取到 ${response.results.length} 条记录`);

    if (!response.results.length) {
      console.log('no data');
      return;
    }

    let mid = (`${start}_${end}`).replace(/-/g, '');
    let mdHead = `---\ndate: ${end.replace(/-/g, '/')}\ntoc: true\n---\n\n`;
    let mdContent = '';
    let secData = {};
    let mdImg = '';

    function setMdImg(img, txt) {
      let desc = txt ? `<small>${txt}</small>\n\n` : '';
      return `<img src="${img}" width="800" />\n\n${desc}`;
    }

    const skipped = [];

    for (const page of response.results) {
      const cover = page.cover?.external?.url || page.cover?.file?.url;

      const props = page.properties;
      const title = richTextToMd(props.title?.title);
      const plainTitle = (props.title?.title || [])
        .map((s) => s.plain_text || '')
        .join('')
        .trim();
      const content = richTextToMd(props.desc?.rich_text) || '';
      const img =
        props.img?.files?.[0]?.file?.url || props.img?.files?.[0]?.external?.url || '';
      const imgDesc = props.imgDesc?.rich_text?.[0]?.plain_text || '';
      const tag =
        (props.tags?.multi_select && props.tags.multi_select[0]?.name) ||
        props.tags?.select?.name ||
        '';
      const pageDate = props.date?.date?.start || '(date为空)';

      // 逐条打印诊断信息，避免内容缺失再无声无息
      console.log(`· [${pageDate}] ${plainTitle || '(无标题)'}  tags=${tag || '(未填)'}`);

      // 封面图取本周第一条带图条目（原逻辑为最后一条覆盖前面的）
      if (img && !mdImg) {
        mdImg = setMdImg(img, imgDesc);
      }

      let section = tag;
      if (!tag) {
        // 修复：无 tags 的条目原来被静默丢弃（导致某期内容缺失且无任何提示）
        if (!plainTitle && !content.trim()) {
          console.log('  └─ 空白记录，跳过');
          continue;
        }
        section = '未分类';
        skipped.push(plainTitle || '(无标题)');
        console.warn('  └─ ⚠️ 未填写 tags，已归入「未分类」');
      }

      const _content = content;
      const targetStr = formatStr(_content);
      const oneImg = cover ? `![](${cover})` : '';

      if (!secData[section]) {
        secData[section] = [];
        secData[section].index = 0;
      }
      const idx = secData[section].index++;
      const oneMsg = `**${idx + 1}、${title.trim()}**\n\n${targetStr}\n\n${oneImg}\n\n`;
      secData[section].push(oneMsg);
    }

    if (skipped.length) {
      console.warn(
        `\n⚠️ 有 ${skipped.length} 条记录未填 tags，已归入「未分类」：${skipped.join(' / ')}`
      );
    }

    Object.keys(secData).map((key) => {
      mdContent += `## ${key}\n${secData[key].join('')}`;
    });

    const existingFiles = fs
      .readdirSync(CONFIG.dir)
      .filter((file) => !file.startsWith('.')); // ignore hidden files
    const existingFile = existingFiles.find((file) => file.includes(mid));

    let filePath = '';
    if (existingFile) {
      filePath = path.join(CONFIG.dir, existingFile);
      console.log(`覆盖已有文件: ${existingFile}`);
    } else {
      const fileCount = existingFiles.length;
      const fileName = `${(fileCount < 10 ? '0' + fileCount : fileCount) + '-' + (CONFIG.filename || end)}-${mid}.md`;
      filePath = path.join(CONFIG.dir, fileName);
      console.log(`创建新文件: ${fileName}`);
    }

    const fileContent = `${mdHead + mdImg + mdContent}`;
    fs.writeFileSync(filePath, fileContent);
    console.log(`✅ 已写入 ${filePath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
