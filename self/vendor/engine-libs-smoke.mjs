import { Solar, astro } from './engine-libs.mjs';

const lunar = Solar.fromYmdHms(1990, 6, 15, 14, 30, 0).getLunar();
const astrolabe = astro.bySolar('1990-06-15', 7, '男', true, 'zh-TW');

console.log(
  JSON.stringify(
    {
      bazi: lunar.getEightChar().toString(),
      ziwei: {
        config: astro.getConfig(),
        time: astrolabe.time,
        soulPalace: astrolabe.palace('命宮').earthlyBranch,
        soulStars: astrolabe.palace('命宮').majorStars.map((star) => star.name),
      },
    },
    null,
    2,
  ),
);
