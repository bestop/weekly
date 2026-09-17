import rss from '@astrojs/rss';
import dayjs from 'dayjs';
import { SITE } from '@/config';
import { parseTitle } from '@/util';

let allPosts = import.meta.glob('./posts/*.md', { eager: true });
let posts = Object.values(allPosts);
posts = posts.sort((a, b) => {
  return (
    parseInt(b.url.split('/posts/')[1].split('-')[0]) -
    parseInt(a.url.split('/posts/')[1].split('-')[0])
  );
});

//只保留15，当前太多了
posts.splice(15);

export const get = () =>
  rss({
    title: SITE.title,
    description: SITE.description,
    site: SITE.homePage,
    customData: `<image><url>${SITE.icon}</url></image>`,
    items: posts.map((item) => {
      return {
        link: item.url,
        title: parseTitle(item.url),
        description: item.compiledContent(),
        pubDate: dayjs(item.frontmatter.date).toDate(),
      };
    }),
  });
