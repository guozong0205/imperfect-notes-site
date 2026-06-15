import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Solar } = require('lunar-javascript');
const { astro, util } = require('iztro');

const REFERENCE_DATE = '2026-06-15';
const REFERENCE_YEAR = 2026;
const MUTAGEN_LABELS = ['祿', '權', '科', '忌'];

const CASES = [
  {
    id: 'A',
    birthDate: '1990-06-15',
    birthTime: '14:30',
    place: '北京',
    longitude: 116.4,
    gender: '男',
  },
  {
    id: 'B',
    birthDate: '1995-11-03',
    birthTime: '23:30',
    place: '上海',
    longitude: 121.5,
    gender: '女',
  },
  {
    id: 'C',
    birthDate: '1988-02-20',
    birthTime: null,
    place: '廣州',
    longitude: 113.3,
    gender: '女',
  },
];

const GAN_ELEMENT = {
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
};

const GAN_POLARITY = {
  甲: '陽',
  丙: '陽',
  戊: '陽',
  庚: '陽',
  壬: '陽',
  乙: '陰',
  丁: '陰',
  己: '陰',
  辛: '陰',
  癸: '陰',
};

const BRANCH_HIDDEN = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
};

const GENERATES = {
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木',
};

const CONTROLS = {
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木',
};

function t2(value) {
  if (Array.isArray(value)) return value.map(t2);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, t2(item)]));
  }
  if (typeof value !== 'string') return value;
  return value
    .replaceAll('财', '財')
    .replaceAll('伤', '傷')
    .replaceAll('杀', '殺')
    .replaceAll('贞', '貞')
    .replaceAll('军', '軍')
    .replaceAll('阳', '陽')
    .replaceAll('阴', '陰')
    .replaceAll('机', '機')
    .replaceAll('贪', '貪')
    .replaceAll('辅', '輔')
    .replaceAll('门', '門')
    .replaceAll('禄', '祿');
}

function parseDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function parseTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
}

function makeUtc(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function partsFromDate(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDate(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function formatDateTime(parts) {
  return `${formatDate(parts)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function getTrueSolar(caseItem) {
  const correctionMinutes = (120 - caseItem.longitude) * 4;

  if (!caseItem.birthTime) {
    return {
      correctionMinutes,
      beijingTime: null,
      trueSolarTime: null,
      trueSolarParts: null,
      adjustedChartParts: parseDate(caseItem.birthDate),
      lateZiNextDay: false,
    };
  }

  const beijingTime = makeUtc({
    ...parseDate(caseItem.birthDate),
    ...parseTime(caseItem.birthTime),
    second: 0,
  });
  const trueSolarTime = addMinutes(beijingTime, -correctionMinutes);
  const trueSolarParts = partsFromDate(trueSolarTime);
  const lateZiNextDay = trueSolarParts.hour === 23;
  const adjustedChartParts = partsFromDate(lateZiNextDay ? addDays(trueSolarTime, 1) : trueSolarTime);

  return {
    correctionMinutes,
    beijingTime,
    trueSolarTime,
    trueSolarParts,
    adjustedChartParts,
    lateZiNextDay,
  };
}

function getSolarFromParts(parts, includeTime) {
  if (includeTime) {
    return Solar.fromYmdHms(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second ?? 0);
  }
  return Solar.fromYmd(parts.year, parts.month, parts.day);
}

function getPillar(ec, label) {
  return {
    ganzhi: ec[`get${label}`](),
    gan: ec[`get${label}Gan`](),
    zhi: ec[`get${label}Zhi`](),
    hiddenGan: t2(ec[`get${label}HideGan`]()),
    stemTenGod: t2(ec[`get${label}ShiShenGan`]()),
    hiddenTenGod: t2(ec[`get${label}ShiShenZhi`]()),
  };
}

function tenGod(dayGan, targetGan) {
  if (!targetGan) return '';

  const dayElement = GAN_ELEMENT[dayGan];
  const targetElement = GAN_ELEMENT[targetGan];
  const samePolarity = GAN_POLARITY[dayGan] === GAN_POLARITY[targetGan];

  if (targetElement === dayElement) return samePolarity ? '比肩' : '劫財';
  if (GENERATES[dayElement] === targetElement) return samePolarity ? '食神' : '傷官';
  if (GENERATES[targetElement] === dayElement) return samePolarity ? '偏印' : '正印';
  if (CONTROLS[dayElement] === targetElement) return samePolarity ? '偏財' : '正財';
  if (CONTROLS[targetElement] === dayElement) return samePolarity ? '七殺' : '正官';
  return '';
}

function countTenGods(pillars) {
  const counts = {};
  for (const pillar of Object.values(pillars)) {
    const gods = [pillar.stemTenGod, ...pillar.hiddenTenGod].filter(Boolean);
    for (const god of gods) counts[god] = (counts[god] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, 'zh-Hant')));
}

function assessStrength(ec, pillars) {
  const dayGan = ec.getDayGan();
  const dayElement = GAN_ELEMENT[dayGan];
  const monthMainGan = ec.getMonthHideGan()[0];
  const monthMainElement = GAN_ELEMENT[monthMainGan];
  const deLing = monthMainElement === dayElement || GENERATES[monthMainElement] === dayElement;
  const allHiddenGan = Object.values(pillars).flatMap((pillar) => pillar.hiddenGan);
  const rootedBranches = Object.values(pillars)
    .filter((pillar) => pillar.hiddenGan.some((gan) => GAN_ELEMENT[gan] === dayElement))
    .map((pillar) => pillar.zhi);
  const stemSupport = Object.values(pillars)
    .map((pillar) => pillar.gan)
    .filter((gan) => gan !== dayGan && (GAN_ELEMENT[gan] === dayElement || GENERATES[GAN_ELEMENT[gan]] === dayElement));
  const hiddenSupport = allHiddenGan.filter((gan) => GAN_ELEMENT[gan] === dayElement || GENERATES[GAN_ELEMENT[gan]] === dayElement);
  const supportCount = stemSupport.length + hiddenSupport.length;
  const support = supportCount >= 2;
  const score = (deLing ? 2 : 0) + (rootedBranches.length > 0 ? 1 : 0) + (support ? 1 : 0);
  const verdict = score >= 3 ? '旺' : score === 2 ? '中和' : '弱';

  return {
    dayMaster: dayGan,
    dayElement,
    monthCommand: {
      monthBranch: ec.getMonthZhi(),
      mainQi: monthMainGan,
      mainQiElement: monthMainElement,
      deLing,
    },
    rooted: {
      value: rootedBranches.length > 0,
      branches: rootedBranches,
    },
    support: {
      value: support,
      count: supportCount,
      stems: stemSupport,
      hiddenGan: hiddenSupport,
    },
    score,
    verdict,
  };
}

function getCurrentDaYun(ec, gender) {
  const genderFlag = gender === '男' ? 1 : 0;
  const yun = ec.getYun(genderFlag);
  const items = yun.getDaYun().map((item) => ({
    startYear: item.getStartYear(),
    endYear: item.getEndYear(),
    startAge: item.getStartAge(),
    endAge: item.getEndAge(),
    ganzhi: item.getGanZhi(),
  }));
  const current = items.find((item) => item.startYear <= REFERENCE_YEAR && item.endYear >= REFERENCE_YEAR) ?? null;
  const zhi = current?.ganzhi?.[1] ?? '';
  const mainQi = BRANCH_HIDDEN[zhi]?.[0] ?? '';

  return {
    start: {
      years: yun.getStartYear(),
      months: yun.getStartMonth(),
      days: yun.getStartDay(),
      hours: yun.getStartHour(),
      forward: yun.isForward(),
    },
    current: current
      ? {
          ...current,
          stemTenGod: tenGod(ec.getDayGan(), current.ganzhi[0]),
          branchMainQi: mainQi,
          branchMainQiTenGod: tenGod(ec.getDayGan(), mainQi),
        }
      : null,
  };
}

function getCurrentLiuNian(ec) {
  const lunar = Solar.fromYmd(REFERENCE_YEAR, 6, 15).getLunar();
  const ganzhi = lunar.getYearInGanZhiByLiChun();
  const zhi = ganzhi[1];
  const mainQi = BRANCH_HIDDEN[zhi]?.[0] ?? '';

  return {
    year: REFERENCE_YEAR,
    ganzhi,
    stemTenGod: tenGod(ec.getDayGan(), ganzhi[0]),
    branchMainQi: mainQi,
    branchMainQiTenGod: tenGod(ec.getDayGan(), mainQi),
  };
}

function buildBazi(caseItem, timing) {
  const includeTime = Boolean(caseItem.birthTime);
  const sourceParts = includeTime ? timing.trueSolarParts : parseDate(caseItem.birthDate);
  const solar = getSolarFromParts(sourceParts, includeTime);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();
  ec.setSect(1);
  const labels = includeTime ? ['Year', 'Month', 'Day', 'Time'] : ['Year', 'Month', 'Day'];
  const pillars = {};
  const names = ['year', 'month', 'day', 'time'];

  labels.forEach((label, index) => {
    pillars[names[index]] = getPillar(ec, label);
  });

  return {
    chartDateUsed: includeTime ? formatDateTime(sourceParts) : formatDate(sourceParts),
    lateZiDayPillarDate: timing.lateZiNextDay ? formatDate(timing.adjustedChartParts) : null,
    pillars,
    dayMaster: ec.getDayGan(),
    strength: assessStrength(ec, pillars),
    tenGodCounts: countTenGods(pillars),
    currentDaYun: getCurrentDaYun(ec, caseItem.gender),
    currentLiuNian: getCurrentLiuNian(ec),
  };
}

function timeIndexFromParts(parts) {
  if (parts.hour === 23) return 12;
  if (parts.hour === 0) return 0;
  return Math.floor((parts.hour + 1) / 2);
}

function palaceStars(palace) {
  return palace.majorStars.map((star) => star.name);
}

function borrowedSoulStars(astrolabe) {
  const soulPalace = astrolabe.palace('命宮');
  if (soulPalace.majorStars.length > 0) {
    return {
      stars: palaceStars(soulPalace),
      borrowedFromOpposite: false,
      oppositePalace: null,
    };
  }
  const opposite = soulPalace.surroundedPalaces().opposite;
  return {
    stars: palaceStars(opposite),
    borrowedFromOpposite: true,
    oppositePalace: `${opposite.name}(${opposite.earthlyBranch})`,
  };
}

function findStarPlacements(astrolabe, starName) {
  const hits = [];
  for (const palace of astrolabe.palaces) {
    const stars = [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
    for (const star of stars) {
      if (star.name === starName) {
        hits.push({
          palace: palace.name,
          earthlyBranch: palace.earthlyBranch,
          star: star.name,
          natalMutagen: star.mutagen || '',
        });
      }
    }
  }
  return hits;
}

function getEffectiveMutagenTable() {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  return Object.fromEntries(
    stems.map((stem) => [
      stem,
      Object.fromEntries(MUTAGEN_LABELS.map((label, index) => [label, t2(util.getMutagensByHeavenlyStem(stem)[index])])),
    ]),
  );
}

function buildZiwei(caseItem, timing) {
  if (!caseItem.birthTime) return null;

  const chartDate = formatDate(timing.trueSolarParts);
  const timeIndex = timeIndexFromParts(timing.trueSolarParts);
  const astrolabe = astro.bySolar(chartDate, timeIndex, caseItem.gender, true, 'zh-TW');
  const horoscope = astrolabe.horoscope(REFERENCE_DATE);
  const soulStars = borrowedSoulStars(astrolabe);
  const currentDecadalPalace = astrolabe.palaces[horoscope.decadal.index];
  const yearlyMutagens = Object.fromEntries(
    MUTAGEN_LABELS.map((label, index) => {
      const star = horoscope.yearly.mutagen[index];
      return [
        label,
        {
          star,
          placements: findStarPlacements(astrolabe, star),
        },
      ];
    }),
  );

  return {
    iztroConfig: astro.getConfig(),
    chartDateUsed: chartDate,
    timeIndex,
    time: astrolabe.time,
    timeRange: astrolabe.timeRange,
    chineseDate: astrolabe.chineseDate,
    soulPalace: {
      palace: astrolabe.palace('命宮').name,
      earthlyBranch: astrolabe.palace('命宮').earthlyBranch,
      mainStars: soulStars.stars,
      borrowedFromOpposite: soulStars.borrowedFromOpposite,
      oppositePalace: soulStars.oppositePalace,
    },
    palaces: astrolabe.palaces.map((palace) => ({
      name: palace.name,
      earthlyBranch: palace.earthlyBranch,
      mainStars: palaceStars(palace),
    })),
    currentDecadalSoulPalace: {
      referenceDate: REFERENCE_DATE,
      index: horoscope.decadal.index,
      decadalHeavenlyStem: horoscope.decadal.heavenlyStem,
      decadalEarthlyBranch: horoscope.decadal.earthlyBranch,
      horoscopePalaceName: horoscope.decadal.palaceNames[horoscope.decadal.index],
      natalPalace: currentDecadalPalace.name,
      natalEarthlyBranch: currentDecadalPalace.earthlyBranch,
    },
    currentYearlyMutagens: {
      referenceDate: REFERENCE_DATE,
      heavenlyStem: horoscope.yearly.heavenlyStem,
      earthlyBranch: horoscope.yearly.earthlyBranch,
      tableUsedForStem: Object.fromEntries(
        MUTAGEN_LABELS.map((label, index) => [label, horoscope.yearly.mutagen[index]]),
      ),
      placements: yearlyMutagens,
    },
    effectiveMutagenTable: getEffectiveMutagenTable(),
  };
}

function buildCaseResult(caseItem) {
  const timing = getTrueSolar(caseItem);

  return {
    case: caseItem.id,
    input: {
      birthDate: caseItem.birthDate,
      birthTime: caseItem.birthTime ?? '未知',
      place: caseItem.place,
      longitude: caseItem.longitude,
      gender: caseItem.gender,
      trueSolarCorrectionMinutes: Number(timing.correctionMinutes.toFixed(2)),
      beijingTime: timing.beijingTime ? formatDateTime(partsFromDate(timing.beijingTime)) : '未知',
      trueSolarTime: timing.trueSolarParts ? formatDateTime(timing.trueSolarParts) : '時辰未知，未做時分校正',
      lateZiNextDay: timing.lateZiNextDay,
      lateZiDayPillarDate: timing.lateZiNextDay ? formatDate(timing.adjustedChartParts) : null,
      actualChartTime: caseItem.birthTime ? formatDateTime(timing.trueSolarParts) : `${caseItem.birthDate}（降級模式：時辰未知）`,
    },
    degradedMode: !caseItem.birthTime,
    bazi: buildBazi(caseItem, timing),
    ziwei: buildZiwei(caseItem, timing) ?? '降級模式：時辰未知，紫微不安宮',
  };
}

console.log(`Self Notes Engine Verify P1`);
console.log(`Reference date: ${REFERENCE_DATE}`);
console.log(`lunar-javascript: ${require('lunar-javascript/package.json').version}`);
console.log(`iztro: ${require('iztro/package.json').version}`);
console.log(`iztro default config: ${JSON.stringify(astro.getConfig(), null, 2)}`);

for (const caseItem of CASES) {
  console.log(`\n===== Case ${caseItem.id} =====`);
  console.log(JSON.stringify(buildCaseResult(caseItem), null, 2));
}
