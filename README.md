# JWeekly

> 基于 [tw93/weekly](https://github.com/tw93/weekly) 修改的个人周刊项目，文章数据通过 [notion2md](https://github.com/thinkerchan/notion2md) 工作流从 Notion 数据库自动同步，部署到 Vercel 后即可全自动更新。

## 特性

- 🤖 **Notion 自动同步**：每周一自动拉取 Notion 数据库新增内容生成周刊文章；支持手动触发与按日期回填缺失期数
- 🔗 **条目自动补链**：Notion 粘贴时丢失的超链接在构建时自动还原（自动识别 `GitHub - owner/repo`、`N、owner/repo` 等格式，或回填描述段落中的第一个链接）
- 📑 **TOC 目录 + 标题锚点**：文章右侧目录、标题 hover 显示 `#` 锚点
- 🔍 **站内搜索**：基于 pagefind，按 `/` 快速唤起
- 🌙 **夜间模式**
- 💬 **Waline 评论**
- 📊 **busuanzi 访问统计**
- 🗺️ **SEO 基础设施**：sitemap.xml、robots.txt、canonical、OG/Twitter 卡片标签、404 页面

## 快速开始

### 一、准备工作

1. Fork 本仓库到自己的 GitHub 账号下
2. Clone 到本地，确认已安装 node / npm 环境
3. 执行 `npm i` 安装依赖，然后 `npm run dev` 跑起来看效果

### 二、站点配置

编辑 `src/config.ts` 设置站点信息：

```js
export const SITE = {
  "title": "JWeekly",
  "author": "joe",
  "description": "Joe's Weekly",
  "keywords": "joe,hijoe,weekly,hijoe.net",
  "icon": "https://t-qiniu.linkroutes.com/uPic/logo_vZ4QQZ.png",
  "pic": "",
  "homePage": "https://wk.hijoe.net",   // 部署后的正式域名，sitemap/canonical 依赖它
  "blogPage": "https://hijoe.net",
  "twitterId": "bestop",
  "githubId": "bestop",
  "repo": "bestop/weekly",
  "cmtURL": "https://cmt.hijoe.net",    // Waline 评论服务地址
  "cmtJs": "https://unpkg.com/@waline/client@2.15.8/dist/waline.js",
  "cmtCss": "https://unpkg.com/@waline/client@2.15.8/dist/waline.css",
  "pv": true
}
```

### 三、Notion 数据源配置（notion2md）

文章数据从 Notion 数据库同步，参考 [notion2md](https://github.com/thinkerchan/notion2md) 说明完成以下准备：

**1. 创建 Notion 数据库**

可以直接复制官方 [demo 数据库](https://thinkrchan.notion.site/10ae95237d4b8023add0d42c858d464f?v=fffe95237d4b8162bc57000ce467f9df) 作为模板。数据库需要包含的常用字段：标题、日期（date）、分类（tags，多选）。

**2. 获取 Notion Token 并连接数据库**

- 到 [Notion Integrations](https://www.notion.so/profile/integrations) 创建一个 Integration，获取 `NOTION_TOKEN`（`ntn_` 或 `secret_` 开头）
- 在数据库页面右上角 `... → Connections` 中把该 Integration 连接到数据库（不连接会报 401）

**3. 获取数据库 ID**

数据库视图 URL 中 32 位字符串即 database id，例如：

```
https://app.notion.com/p/123f04fc1f1b80a1b3abe060d70745f7?v=123f04fc...
                            └────── 123f04fc1f1b80a1b3abe060d70745f7 ──────┘
```

**4. 配置 GitHub Secrets**

仓库 `Settings → Secrets and variables → Actions → New repository secret`，添加两个变量：

| Secret 名 | 值 |
|-----------|-----|
| `NOTION_TOKEN` | 上一步获取的 Notion Integration Token |
| `NOTION_DATABASE_ID` | 上一步获取的数据库 ID |

### 四、同步工作流说明

同步脚本为本仓库重写版（`.github/workflows/notion2md.js`），相对上游修复了记录无 tags 时静默丢弃、日期窗口取不到数据等问题，并新增按日期回填能力。

**自动同步**：GitHub Actions 每周一 UTC 0 点（`cron: 0 0 * * 1`）自动拉取最近 7 天的数据生成新一期文章并提交。

**手动触发 / 回填缺失期数**：

`Actions → Notion to Markdown → Run workflow`，可选填：

- `start`：起始日期（含），格式 `2026-05-11`，留空 = 最近 7 天
- `end`：结束日期（不含），格式 `2026-05-18`，留空 = 今天

例如第 53 期（2026-05-11 ~ 2026-05-18）内容缺失，填入对应日期触发即可回填。

**本地调试同步**：

```bash
# 1. 在项目根目录创建 .env 文件（已被 .gitignore 忽略，不会提交）
NOTION_TOKEN=your_token
NOTION_DATABASE_ID=your_db_id

# 2. 安装依赖后运行（默认拉取最近 7 天）
npm run fetch

# 按日期窗口拉取 / 回填
node .github/workflows/notion2md.js --start 2026-05-11 --end 2026-05-18
```

脚本默认配置可在 `.github/workflows/notion2md.js` 顶部调整：

```js
const CONFIG = {
  days: 7,                      // 默认拉取最近几天
  dir: './src/pages/posts',     // 文章输出目录
  filename: '本周见闻',          // 生成的文件名
};
```

**收藏内容**：日常收集可安装 [save-to-notion](https://chromewebstore.google.com/detail/save-to-notion/ldmmifpegigmeammaeckplhnjbbpccmm) 浏览器插件，选中自己创建的数据库，填写表单保存即可，下周自动出现在新一期里。

### 五、文档格式说明

同步生成的文章遵循以下规范，手写文章同样适用：

1. `src/pages/posts` 下文件名建议用 `期号-标题-日期范围` 的形式，如 `53-本周见闻-20260511_20260518.md`
2. 第一行建议是图片展示，构建时会自动取第一张图为头图；也可用 front matter 的 `pic` 字段指定，都没有则使用默认图片
3. 中间空一行，第三行是文档描述，也可用 front matter 的 `desc` 字段表示，没有则使用默认描述
4. 文章时间默认取文件创建时间，可用 front matter 的 `date` 字段覆盖
5. 需要 TOC 目录时在 front matter 中设置 `toc: true`

```md
---
date: 2026/05/18
toc: true
---

![头图](https://example.com/cover.png)

这里是文章的描述文字，会显示在首页卡片上。

## 实用工具

**1、GitHub - owner/repo: 项目标题**

项目描述文字。
```

### 六、部署说明

1. 推荐用 Vercel 部署
2. 确保 Fork 的代码已推送到 GitHub，进入 [Vercel](https://vercel.com/new) 选择 `Continue with GitHub`，导入对应仓库
3. 确认 FRAMEWORK PRESET 是 Astro（一般会默认选中），点击 Deploy 等待部署完成
4. 部署完成后把分配的域名（或自定义域名）更新到 `src/config.ts` 的 `homePage`，这样 sitemap / canonical / RSS 里的地址才是正确的

## 相对上游的改动记录

| 类别 | 内容 |
|------|------|
| 修复 | TOC 高亮选择器语法错误（上游选择器缺 `[h` 导致滚动报错、高亮失效） |
| 修复 | 上一篇/下一篇按期号定位真实邻居，期号断档不再错乱 |
| 修复 | TOC 锚点不再误开新窗口；外链统一 `rel="noopener noreferrer"` |
| 修复 | Waline CSS/JS 版本统一（2.15.8）；RSS 标题与时间格式修正 |
| 修复 | notion2md 无 tags 静默丢弃、日期窗口取不到数据等问题，支持按日期回填 |
| 增强 | 条目标题超链接构建时自动还原（Notion 同步丢链问题） |
| 增强 | SEO：sitemap.xml、robots.txt、canonical、OG/Twitter 标签、og:type=article、文章封面作分享图 |
| 增强 | 404 页面、本地 favicon、lozad 本地打包（移除第三方 CDN 依赖） |

## 感谢

- [tw93/weekly](https://github.com/tw93/weekly)
- [thinkerchan/weekly](https://github.com/thinkerchan/weekly)
- [thinkerchan/notion2md](https://github.com/thinkerchan/notion2md)
