import { Solar, astro, util } from '../vendor/engine-libs.mjs';

const REFERENCE_DATE = '2026-06-15';
const REFERENCE_YEAR = 2026;
const MUTAGEN_LABELS = ['祿', '權', '科', '忌'];

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

const AXES = [
  {
    axis: 1,
    name: 'energy',
    firstPole: '-',
    firstLetter: 'I',
    secondPole: '+',
    secondLetter: 'E',
    negativeGods: ['正印', '偏印', '比肩', '劫財'],
    positiveGods: ['食神', '傷官', '正財', '偏財'],
    negativeStars: ['太陰', '天機', '天同', '天梁'],
    positiveStars: ['太陽', '貪狼', '破軍', '七殺', '廉貞', '巨門'],
    conflictB: { mbtiPole: '+', mingliPole: '-' },
  },
  {
    axis: 2,
    name: 'decision',
    firstPole: '-',
    firstLetter: 'F',
    secondPole: '+',
    secondLetter: 'T',
    negativeGods: ['正印', '偏印', '食神', '傷官'],
    positiveGods: ['正官', '七殺', '正財', '偏財'],
    negativeStars: ['太陰', '天同', '天梁', '貪狼'],
    positiveStars: ['武曲', '天府', '紫微', '天相', '七殺'],
    conflictB: { mbtiPole: '+', mingliPole: '-' },
  },
  {
    axis: 3,
    name: 'focus',
    firstPole: '-',
    firstLetter: 'S',
    secondPole: '+',
    secondLetter: 'N',
    negativeGods: ['正官', '正財', '正印'],
    positiveGods: ['傷官', '偏印', '劫財'],
    negativeStars: ['天府', '天相', '武曲', '巨門'],
    positiveStars: ['天機', '破軍', '貪狼', '廉貞'],
    conflictB: { mbtiPole: '-', mingliPole: '+' },
  },
  {
    axis: 4,
    name: 'rhythm',
    firstPole: '-',
    firstLetter: 'J',
    secondPole: '+',
    secondLetter: 'P',
    negativeGods: ['正官', '正印', '正財'],
    positiveGods: ['七殺', '傷官', '偏財', '劫財'],
    negativeStars: ['天府', '天相', '紫微', '太陰', '天梁', '天同'],
    positiveStars: ['破軍', '七殺', '貪狼', '天機', '廉貞', '巨門'],
    conflictB: { mbtiPole: '-', mingliPole: '+' },
  },
];

const AX5 = {
  hardGods: ['比肩', '劫財', '七殺'],
  softGods: ['正印', '偏印', '食神', '正官'],
  hardStars: ['七殺', '破軍', '紫微', '武曲', '太陽', '廉貞'],
  softStars: ['天同', '太陰', '天梁', '天相', '天機'],
};

const PHASE_BY_GOD = {
  正印: 'ax6.xiuyang',
  偏印: 'ax6.xiuyang',
  比肩: 'ax6.jingzheng',
  劫財: 'ax6.jingzheng',
  食神: 'ax6.biaoda',
  傷官: 'ax6.biaoda',
  正財: 'ax6.chengdan',
  偏財: 'ax6.chengdan',
  正官: 'ax6.zeren',
  七殺: 'ax6.zeren',
};

const PHASE_BY_MUTAGEN = {
  祿: 'ax6.biaoda',
  權: 'ax6.chengdan',
  科: 'ax6.xiuyang',
  忌: 'ax6.zeren',
};

const STRENGTH_WEIGHT = {
  強: 2,
  弱: 1,
  模糊: 0,
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
  return `${formatDate(parts)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second ?? 0)}`;
}

function normalizeGender(gender) {
  if (gender === 'm' || gender === '男') return '男';
  if (gender === 'f' || gender === '女') return '女';
  return '女';
}

function getBirthDate(birth) {
  return birth.birthDate ?? birth.date;
}

function getBirthTime(birth) {
  if (birth.timeUnknown) return null;
  return birth.birthTime ?? birth.time ?? null;
}

function getLongitude(birth) {
  return Number(birth.longitude ?? birth.lng ?? birth.birthLongitude ?? 120);
}

function getTiming(birth) {
  const birthDate = getBirthDate(birth);
  const birthTime = getBirthTime(birth);
  const longitude = getLongitude(birth);
  const correctionMinutes = (120 - longitude) * 4;

  if (!birthTime) {
    return {
      birthDate,
      birthTime: null,
      longitude,
      correctionMinutes,
      beijingParts: null,
      trueSolarParts: null,
      baziParts: parseDate(birthDate),
      ziweiParts: null,
      lateZiNextDay: false,
    };
  }

  const beijingTime = makeUtc({
    ...parseDate(birthDate),
    ...parseTime(birthTime),
    second: 0,
  });
  const trueSolarTime = addMinutes(beijingTime, -correctionMinutes);
  const trueSolarParts = partsFromDate(trueSolarTime);
  const lateZiNextDay = trueSolarParts.hour === 23;
  const nextDayParts = partsFromDate(addDays(trueSolarTime, 1));
  const ziweiParts = lateZiNextDay
    ? { ...nextDayParts, hour: 0, minute: trueSolarParts.minute, second: trueSolarParts.second }
    : trueSolarParts;

  return {
    birthDate,
    birthTime,
    longitude,
    correctionMinutes,
    beijingParts: partsFromDate(beijingTime),
    trueSolarParts,
    baziParts: trueSolarParts,
    ziweiParts,
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
  return counts;
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

function buildBazi(birth, timing) {
  const includeTime = Boolean(timing.birthTime);
  const solar = getSolarFromParts(timing.baziParts, includeTime);
  const ec = solar.getLunar().getEightChar();
  ec.setSect(1);

  const labels = includeTime ? ['Year', 'Month', 'Day', 'Time'] : ['Year', 'Month', 'Day'];
  const names = ['year', 'month', 'day', 'time'];
  const pillars = {};
  labels.forEach((label, index) => {
    pillars[names[index]] = getPillar(ec, label);
  });

  return {
    chartDateUsed: includeTime ? formatDateTime(timing.baziParts) : formatDate(timing.baziParts),
    lateZiNextDay: timing.lateZiNextDay,
    lateZiUnifiedDate: timing.lateZiNextDay ? formatDate(timing.ziweiParts) : null,
    pillars,
    dayMaster: ec.getDayGan(),
    strength: assessStrength(ec, pillars),
    tenGodCounts: countTenGods(pillars),
    currentDaYun: getCurrentDaYun(ec, normalizeGender(birth.gender)),
    currentLiuNian: getCurrentLiuNian(ec),
  };
}

function timeIndexFromParts(parts) {
  if (parts.hour === 23) return 12;
  if (parts.hour === 0) return 0;
  return Math.floor((parts.hour + 1) / 2);
}

function palaceMainStars(palace) {
  return palace.majorStars.map((star) => star.name);
}

function getSoulStars(astrolabe) {
  const soulPalace = astrolabe.palace('命宮');
  if (soulPalace.majorStars.length > 0) {
    return {
      stars: palaceMainStars(soulPalace),
      borrowedFromOpposite: false,
      oppositePalace: null,
    };
  }
  const opposite = soulPalace.surroundedPalaces().opposite;
  return {
    stars: palaceMainStars(opposite),
    borrowedFromOpposite: true,
    oppositePalace: `${opposite.name}(${opposite.earthlyBranch})`,
  };
}

function findStarPlacements(astrolabe, starName) {
  const placements = [];
  for (const palace of astrolabe.palaces) {
    const stars = [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
    for (const star of stars) {
      if (star.name === starName) {
        placements.push({
          palace: palace.name,
          earthlyBranch: palace.earthlyBranch,
          star: star.name,
          natalMutagen: star.mutagen || '',
        });
      }
    }
  }
  return placements;
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

function buildZiwei(birth, timing) {
  if (!timing.birthTime) return null;

  const chartDate = formatDate(timing.ziweiParts);
  const timeIndex = timing.lateZiNextDay ? 0 : timeIndexFromParts(timing.ziweiParts);
  const astrolabe = astro.bySolar(chartDate, timeIndex, normalizeGender(birth.gender), true, 'zh-TW');
  const horoscope = astrolabe.horoscope(REFERENCE_DATE);
  const soulStars = getSoulStars(astrolabe);
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
      mainStars: palaceMainStars(palace),
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
      tableUsedForStem: Object.fromEntries(MUTAGEN_LABELS.map((label, index) => [label, horoscope.yearly.mutagen[index]])),
      placements: yearlyMutagens,
    },
    effectiveMutagenTable: getEffectiveMutagenTable(),
  };
}

export function computeChart(birth) {
  const timing = getTiming(birth);
  const degraded = !timing.birthTime;

  return {
    version: '1.0',
    input: {
      birthDate: timing.birthDate,
      birthTime: timing.birthTime,
      birthPlace: birth.birthPlace ?? birth.place ?? null,
      longitude: timing.longitude,
      gender: normalizeGender(birth.gender),
      trueSolarCorrectionMinutes: Number(timing.correctionMinutes.toFixed(2)),
      beijingTime: timing.beijingParts ? formatDateTime(timing.beijingParts) : null,
      trueSolarTime: timing.trueSolarParts ? formatDateTime(timing.trueSolarParts) : null,
      lateZiNextDay: timing.lateZiNextDay,
      unifiedChartDateTime: timing.ziweiParts ? formatDateTime(timing.ziweiParts) : null,
    },
    bazi: buildBazi(birth, timing),
    ziwei: degraded ? null : buildZiwei(birth, timing),
    degraded,
  };
}

function countSet(counts, set) {
  return set.reduce((sum, item) => sum + (counts[item] ?? 0), 0);
}

function signPole(score) {
  if (score > 0) return '+';
  if (score < 0) return '-';
  return '0';
}

function strengthFromScore(score) {
  const abs = Math.abs(score);
  if (abs >= 2) return '強';
  if (abs === 1) return '弱';
  return '模糊';
}

function mbtiPole(mbti, axis) {
  if (!mbti || mbti.length < 4) return '0';
  if (mbti.includes(axis.secondLetter)) return '+';
  if (mbti.includes(axis.firstLetter)) return '-';
  return '0';
}

function ziweiPoleScore(stars, positiveStars, negativeStars) {
  if (!stars?.length) return 0;
  const score = stars.reduce((sum, star) => {
    if (positiveStars.includes(star)) return sum + 1;
    if (negativeStars.includes(star)) return sum - 1;
    return sum;
  }, 0);
  return Math.sign(score);
}

function fragmentForAxis(axis, verdict, mbti, mingli) {
  if (verdict === 'C') return `ax${axis.axis}.C`;
  if (verdict === 'A') return mingli === '-' ? `ax${axis.axis}.A` : `ax${axis.axis}.Aprime`;
  const isB = mbti === axis.conflictB.mbtiPole && mingli === axis.conflictB.mingliPole;
  return isB ? `ax${axis.axis}.B` : `ax${axis.axis}.Bprime`;
}

function verdictFor(mbti, mingli, strength) {
  if (strength === '模糊' || mbti === '0' || mingli === '0') return 'C';
  if (mbti === mingli) return 'A';
  if (strength === '弱') return 'C';
  return 'B';
}

function computeNormalAxis(axis, chart, mbti) {
  const baziScore = countSet(chart.bazi.tenGodCounts, axis.positiveGods) - countSet(chart.bazi.tenGodCounts, axis.negativeGods);
  const ziweiScore = chart.degraded ? 0 : ziweiPoleScore(chart.ziwei.soulPalace.mainStars, axis.positiveStars, axis.negativeStars);
  const mingliScore = baziScore + ziweiScore;
  const mingliPole = signPole(mingliScore);
  const strength = strengthFromScore(mingliScore);
  const currentMbtiPole = mbtiPole(mbti, axis);
  const verdict = verdictFor(currentMbtiPole, mingliPole, strength);
  const fragmentId = fragmentForAxis(axis, verdict, currentMbtiPole, mingliPole);

  return {
    axis: axis.axis,
    name: axis.name,
    mbtiPole: currentMbtiPole,
    mingliPole,
    strength,
    verdict,
    target: verdict === 'B' ? 'm2' : 'm1',
    fragmentId,
    scores: {
      baziScore,
      ziweiScore,
      mingliScore,
    },
  };
}

function computeAxis5(chart) {
  const counts = chart.bazi.tenGodCounts;
  const baziScore =
    (chart.bazi.strength.verdict === '旺' ? 2 : 0) +
    countSet(counts, AX5.hardGods) -
    (chart.bazi.strength.verdict === '弱' ? 2 : 0) -
    countSet(counts, AX5.softGods);
  const ziweiScore = chart.degraded ? 0 : ziweiPoleScore(chart.ziwei.soulPalace.mainStars, AX5.hardStars, AX5.softStars);
  const mingliScore = baziScore + ziweiScore;
  const mingliPole = signPole(mingliScore);
  const strength = strengthFromScore(mingliScore);
  const fragmentId = mingliPole === '+' ? 'ax5.gang' : mingliPole === '-' ? 'ax5.rou' : 'ax5.mid';

  return {
    axis: 5,
    name: 'force',
    mbtiPole: 'weak',
    mingliPole,
    strength,
    verdict: 'A',
    target: 'm1',
    fragmentId,
    scores: {
      baziScore,
      ziweiScore,
      mingliScore,
    },
  };
}

function addPhaseScore(scores, fragmentId, weight) {
  scores[fragmentId] = (scores[fragmentId] ?? 0) + weight;
}

function computeAxis6(chart) {
  const scores = {};
  const current = chart.bazi.currentDaYun.current;
  const liuNian = chart.bazi.currentLiuNian;

  if (current?.stemTenGod) addPhaseScore(scores, PHASE_BY_GOD[current.stemTenGod], 2);
  if (current?.branchMainQiTenGod) addPhaseScore(scores, PHASE_BY_GOD[current.branchMainQiTenGod], 1);
  if (liuNian?.stemTenGod) addPhaseScore(scores, PHASE_BY_GOD[liuNian.stemTenGod], 1);
  if (liuNian?.branchMainQiTenGod) addPhaseScore(scores, PHASE_BY_GOD[liuNian.branchMainQiTenGod], 1);

  if (!chart.degraded) {
    const decadalPalace = chart.ziwei.currentDecadalSoulPalace.natalPalace;
    for (const [label, entry] of Object.entries(chart.ziwei.currentYearlyMutagens.placements)) {
      if (entry.placements.some((placement) => placement.palace === decadalPalace)) {
        addPhaseScore(scores, PHASE_BY_MUTAGEN[label], 1);
      }
    }
  }

  const order = ['ax6.xiuyang', 'ax6.jingzheng', 'ax6.biaoda', 'ax6.chengdan', 'ax6.zeren'];
  const fragmentId = order.reduce((best, currentId) => {
    if ((scores[currentId] ?? 0) > (scores[best] ?? 0)) return currentId;
    return best;
  }, order[0]);

  return {
    axis: 6,
    name: 'phase',
    mbtiPole: null,
    mingliPole: fragmentId,
    strength: (scores[fragmentId] ?? 0) >= 2 ? '強' : '弱',
    verdict: 'phase',
    target: 'phase',
    fragmentId,
    scores,
  };
}

export function computeAxes(chart, mbti) {
  return [...AXES.map((axis) => computeNormalAxis(axis, chart, mbti)), computeAxis5(chart), computeAxis6(chart)];
}

function byStrengthThenAxis(a, b) {
  return (STRENGTH_WEIGHT[b.strength] ?? 0) - (STRENGTH_WEIGHT[a.strength] ?? 0) || a.axis - b.axis;
}

function pick(items, limit) {
  return items.slice(0, limit).map((item) => item.fragmentId);
}

export function selectFragments(axisResults) {
  const baseAxes = axisResults.filter((item) => item.axis >= 1 && item.axis <= 5);
  const m1Items = baseAxes.filter((item) => item.target === 'm1').sort(byStrengthThenAxis).slice(0, 3);
  const m2Items = baseAxes.filter((item) => item.target === 'm2').sort(byStrengthThenAxis).slice(0, 1);
  const phase = axisResults.find((item) => item.axis === 6);

  return {
    m1: m1Items.map((item) => item.fragmentId),
    m2: m2Items.map((item) => item.fragmentId),
    m2Fallback: m2Items.length === 0 ? 'profile.m2_forces' : null,
    m3: [],
    m3Fallback: 'profile.m3_gifts',
    phase: phase ? [phase.fragmentId] : [],
  };
}
