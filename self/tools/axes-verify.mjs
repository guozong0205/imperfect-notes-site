import fs from 'node:fs';
import { computeAxes, computeChart, selectFragments } from '../engine/engine.mjs';

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
