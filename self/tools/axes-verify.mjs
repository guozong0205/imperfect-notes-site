import fs from 'node:fs';
import { computeAxes, computeChart, computeWealthCareer, selectFragments } from '../engine/engine.mjs';

const copy = JSON.parse(fs.readFileSync(new URL('../data/engine-copy.json', import.meta.url), 'utf8'));

const CASES = [
  {
    id: 'A',
    birth: {
      birthDate: '1990-06-15',
      birthTime: '14:30',
      birthPlace: '北京',
      longitude: 116.4,
      gender: '男',
    },
    mbtis: ['INFJ', 'ESTP'],
  },
  {
    id: 'B',
    birth: {
      birthDate: '1995-11-03',
      birthTime: '23:30',
      birthPlace: '上海',
      longitude: 121.5,
      gender: '女',
    },
    mbtis: ['INFP', 'ENTJ'],
  },
  {
    id: 'C',
    birth: {
      birthDate: '1988-02-20',
      birthTime: null,
      birthPlace: '廣州',
      longitude: 113.3,
      gender: '女',
      timeUnknown: true,
    },
    mbtis: ['INFJ', 'ESTP'],
  },
];

const M5_CASES = [
  {
    id: 'P5a-strong-split',
    note: '身強/雙軌分歧',
    birth: {
      birthDate: '1980-01-03',
      birthTime: '02:30',
      birthPlace: '北京',
      longitude: 116.4,
      gender: '男',
    },
    mbti: 'INFJ',
  },
  {
    id: 'P5a-weak-bear',
    note: '身弱財旺',
    birth: {
      birthDate: '1980-05-03',
      birthTime: '02:30',
      birthPlace: '北京',
      longitude: 116.4,
      gender: '男',
    },
    mbti: 'INFJ',
  },
  {
    id: 'P5a-leak',
    note: '比劫旺漏財',
    birth: {
      birthDate: '1980-01-03',
      birthTime: '14:30',
      birthPlace: '北京',
      longitude: 116.4,
      gender: '男',
    },
    mbti: 'INFJ',
  },
  {
    id: 'P5a-empty-career-palace',
    note: '官祿空宮借夫妻宮',
    birth: {
      birthDate: '1980-01-17',
      birthTime: '08:30',
      birthPlace: '北京',
      longitude: 116.4,
      gender: '男',
    },
    mbti: 'INFJ',
  },
  {
    id: 'P5a-degraded',
    note: '時辰未知降級，只用八字軌',
    birth: {
      birthDate: '1988-02-20',
      birthTime: null,
      birthPlace: '廣州',
      longitude: 113.3,
      gender: '女',
      timeUnknown: true,
    },
    mbti: 'INFJ',
  },
];

function firstSentence(fragmentId) {
  const text = copy.fragments[fragmentId];
  if (!text) return '[missing copy]';
  const end = text.indexOf('。');
  return end >= 0 ? text.slice(0, end + 1) : text;
}

function selectedWithCopy(ids) {
  return ids.map((fragmentId) => ({
    fragmentId,
    firstSentence: firstSentence(fragmentId),
  }));
}

function palaceSummary(chart, name) {
  const palace = chart.ziwei?.palaces.find((item) => item.name === name);
  return palace ? { name: palace.name, mainStars: palace.mainStars } : null;
}

function m5SelectedWithCopy(result) {
  return [result.careerId, result.wealthId, result.split ? 'm5.split' : null, result.bearId, result.leakId]
    .filter(Boolean)
    .map((fragmentId) => ({
      fragmentId,
      firstSentence: firstSentence(fragmentId),
    }));
}

for (const testCase of CASES) {
  const chart = computeChart(testCase.birth);
  console.log(`\n===== Case ${testCase.id} =====`);
  console.log(
    JSON.stringify(
      {
        input: chart.input,
        degraded: chart.degraded,
        baziPillars: Object.fromEntries(Object.entries(chart.bazi.pillars).map(([key, pillar]) => [key, pillar.ganzhi])),
        ziwei: chart.ziwei
          ? {
              chartDateUsed: chart.ziwei.chartDateUsed,
              timeIndex: chart.ziwei.timeIndex,
              time: chart.ziwei.time,
              soulPalace: chart.ziwei.soulPalace,
            }
          : null,
      },
      null,
      2,
    ),
  );

  for (const mbti of testCase.mbtis) {
    const axes = computeAxes(chart, mbti);
    const selected = selectFragments(axes);

    console.log(`\n--- MBTI ${mbti} ---`);
    console.log(
      JSON.stringify(
        {
          axes: axes.map((item) => ({
            axis: item.axis,
            name: item.name,
            mbtiPole: item.mbtiPole,
            mingliPole: item.mingliPole,
            strength: item.strength,
            verdict: item.verdict,
            target: item.target,
            fragmentId: item.fragmentId,
            scores: item.scores,
          })),
          selected: {
            m1: selectedWithCopy(selected.m1),
            m2: selectedWithCopy(selected.m2),
            m2Fallback: selected.m2Fallback,
            m3: selectedWithCopy(selected.m3),
            m3Fallback: selected.m3Fallback,
            phase: selectedWithCopy(selected.phase),
          },
        },
        null,
        2,
      ),
    );
  }
}

console.log('\n===== P5a m5 wealth/career verification =====');
for (const testCase of M5_CASES) {
  const chart = computeChart(testCase.birth);
  const result = computeWealthCareer(chart, testCase.mbti);

  console.log(`\n--- ${testCase.id} · ${testCase.note} ---`);
  console.log(
    JSON.stringify(
      {
        input: chart.input,
        degraded: chart.degraded,
        baziPillars: Object.fromEntries(Object.entries(chart.bazi.pillars).map(([key, pillar]) => [key, pillar.ganzhi])),
        baziStrength: chart.bazi.strength.verdict,
        tenGodCounts: chart.bazi.tenGodCounts,
        ziweiPalaces: chart.ziwei
          ? {
              career: palaceSummary(chart, '官祿'),
              spouse: palaceSummary(chart, '夫妻'),
              wealth: palaceSummary(chart, '財帛'),
            }
          : null,
        result,
        selectedCopy: m5SelectedWithCopy(result),
      },
      null,
      2,
    ),
  );
}
