import { computeAxes, computeChart, computeWealthCareer, selectFragments } from '../engine/engine.mjs';

const PLACES = [
  { birthPlace: '北京', longitude: 116.4 },
  { birthPlace: '上海', longitude: 121.5 },
  { birthPlace: '廣州', longitude: 113.3 },
  { birthPlace: '大連', longitude: 121.6 },
];
const TIMES = ['00:30', '05:30', '11:30', '14:30', '20:30', '23:30'];
const GENDERS = ['男', '女'];
const MBTIS = ['INFJ', 'ESTP', 'INFP', 'ENTJ'];

const cases = [];
let index = 0;
for (let year = 1960; year <= 2008; year += 1) {
  for (let month = 1; month <= 12; month += 1) {
    for (const day of [3, 15, 27]) {
      const place = PLACES[index % PLACES.length];
      cases.push({
        birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        birthTime: TIMES[index % TIMES.length],
        birthPlace: place.birthPlace,
        longitude: place.longitude,
        gender: GENDERS[index % GENDERS.length],
        mbti: MBTIS[index % MBTIS.length],
      });
      index += 1;
    }
  }
}

const failures = [];
for (const item of cases) {
  try {
    const chart = computeChart(item);
    const axes = computeAxes(chart, item.mbti);
    selectFragments(axes);
    computeWealthCareer(chart, item.mbti);
  } catch (error) {
    failures.push({
      birthDate: item.birthDate,
      birthTime: item.birthTime,
      birthPlace: item.birthPlace,
      gender: item.gender,
      mbti: item.mbti,
      message: error.message,
    });
  }
}

const result = {
  total: cases.length,
  failures: failures.length,
  failureRate: `${((failures.length / cases.length) * 100).toFixed(2)}%`,
  firstFailures: failures.slice(0, 10),
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exit(1);
