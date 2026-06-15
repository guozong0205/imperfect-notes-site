const pageKind = document.body.dataset.page;
const selfScriptBase = new URL("./", document.currentScript.src);
const storeKey = "selfNotesDraft";
const quizStoreKey = "selfNotesQuickQuiz";
const degradedNote = "補上你的出生時間，這份筆記會更貼近你一點。現在這份，先照我們已經知道的你來寫。";
const loadingLines = [
  "正在認識你……",
  "正在寫下你的氣質……",
  "正在為你挑一首曲子……",
  "快好了，再等一下下。"
];

const directions = {
  self: "更瞭解自己",
  relation: "關係模式",
  career: "事業方向",
  resource: "財富與資源",
  phase: "當下階段"
};

const directionCards = [
  ["self", "更瞭解自己", "我想知道我到底是個什麼樣的人"],
  ["relation", "關係模式", "我在親近的人面前，總是那個樣子"],
  ["career", "事業方向", "我不確定現在走的路適不適合我"],
  ["resource", "財富與資源", "我想知道自己和錢、和資源的關係"],
  ["phase", "當下階段", "我說不上來哪裡不對，就是想看看現在的自己"]
];

const mbtiTypes = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP"
];

const reportModuleTitles = {
  m1: "你的核心氣質",
  m2: "你身上的兩股力",
  m3: "你天生擅長的事",
  m4: "你在關係裡的樣子",
  m5: "你和事業、資源的關係",
  m6: "此刻的你，走到了哪裡",
  m6Deep: "順著你選的方向，再看深一點",
  m7: "三件可以試試的小事"
};

const state = loadDraft();
let contentData;
let quizData;
let trackData;
let stringData;
const switchedReportHashes = new Set();
const deepSectionViewEvents = new Set();
let focusDirectionLineAfterRender = false;
let baseModulesExpanded = false;
let engineLoadPromise;
let engineCopyPromise;

function emitEvent(name, data = {}) {
  if (window.gtag) {
    window.gtag("event", name, data);
  }
}

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(storeKey)) || {
      step: 0,
      nickname: null,
      birthDate: "",
      birthTime: "",
      birthPlace: "",
      gender: "na",
      mbti: null,
      mbtiSource: null,
      direction: "self",
      timeUnknown: false,
      editReturnToConfirm: false,
      letters: { energy: "I", world: "N", decision: "F", pace: "J" },
      quizAnswers: []
    };
  } catch {
    return {
      step: 0,
      nickname: null,
      birthDate: "",
      birthTime: "",
      birthPlace: "",
    gender: "na",
    mbti: null,
    mbtiSource: null,
      direction: "self",
      timeUnknown: false,
      editReturnToConfirm: false,
      letters: { energy: "I", world: "N", decision: "F", pace: "J" },
      quizAnswers: []
    };
  }
}

function saveDraft() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

async function loadData() {
  const [content, quiz, tracks, strings] = await Promise.all([
    fetch("../data/content-library.json").then((res) => res.json()),
    fetch("../data/quiz.json").then((res) => res.json()),
    fetch("../data/tracks.json").then((res) => res.json()),
    fetch("../data/strings.json").then((res) => res.json())
  ]);
  contentData = content;
  quizData = quiz;
  trackData = tracks;
  stringData = strings;
}

function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(hash) {
  const normalized = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function formatDate(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function firstParagraph(text) {
  return text.split(/\n\n/)[0] || text;
}

function firstTwoSentences(text) {
  const paragraph = firstParagraph(text);
  const matches = paragraph.match(/[^。]+。/g);
  return matches ? matches.slice(0, 2).join("") : paragraph;
}

function loadEngine() {
  if (!engineLoadPromise) {
    engineLoadPromise = import(new URL("engine/engine.mjs", selfScriptBase).href);
  }
  return engineLoadPromise;
}

function loadEngineCopy() {
  if (!engineCopyPromise) {
    engineCopyPromise = fetch(new URL("data/engine-copy.json", selfScriptBase).href).then((res) => res.json());
  }
  return engineCopyPromise;
}

function longitudeForPlace(place) {
  const normalized = (place || "").trim();
  const known = [
    ["北京", 116.4],
    ["上海", 121.5],
    ["廣州", 113.3],
    ["广州", 113.3],
    ["大連", 121.6],
    ["大连", 121.6]
  ];
  const match = known.find(([name]) => normalized.includes(name));
  return match ? match[1] : 120;
}

function fragmentBody(ids, copyData) {
  return (ids || [])
    .map((id) => copyData.fragments[id])
    .filter(Boolean)
    .join("\n\n");
}

function buildModuleFive(selection, copyData, fallback) {
  if (!selection || !copyData) return fallback;
  const ids = [
    selection.careerId,
    selection.wealthId,
    selection.split ? "m5.split" : null,
    selection.bearId,
    selection.leakId
  ].filter(Boolean);
  return fragmentBody(ids, copyData) || fallback;
}

function buildModuleSix(phaseBody = "") {
  return {
    title: reportModuleTitles.m6,
    body: phaseBody
  };
}

function buildDirectionDeepModule(profile, direction, directionKey) {
  const body = [direction.m6_phase, profile.m6_deepen[directionKey]].filter(Boolean).join("\n\n");
  const module = {
    title: reportModuleTitles.m6Deep,
    body
  };
  if (directionKey === "career" && profile.career_fit && profile.career_avoid) {
    module.deepSection = {
      type: "career",
      framework: contentData.frameworks.career,
      fit: profile.career_fit,
      avoid: profile.career_avoid
    };
  }
  if (directionKey === "resource" && profile.money_from && profile.money_leak && profile.money_rule) {
    module.deepSection = {
      type: "resource",
      framework: contentData.frameworks.resource,
      from: profile.money_from,
      leak: profile.money_leak,
      rule: profile.money_rule
    };
  }
  if (directionKey === "relation" && profile.relation_fit && profile.relation_hurt && profile.relation_word) {
    module.deepSection = {
      type: "relation",
      framework: contentData.frameworks.relation,
      fit: profile.relation_fit,
      hurt: profile.relation_hurt,
      word: profile.relation_word
    };
  }
  if (directionKey === "phase" && profile.phase_do && profile.phase_avoid && profile.phase_word) {
    module.deepSection = {
      type: "phase",
      framework: contentData.frameworks.phase,
      do: profile.phase_do,
      avoid: profile.phase_avoid,
      word: profile.phase_word
    };
  }
  return module;
}

function buildModules(profile, direction, directionKey, engineSelection = null, copyData = null, wealthCareer = null) {
  const m1Body = engineSelection && copyData ? fragmentBody(engineSelection.m1, copyData) || profile.m1_core : profile.m1_core;
  const m2Body = engineSelection && copyData && engineSelection.m2.length ? fragmentBody(engineSelection.m2, copyData) : profile.m2_forces;
  const m5Body = buildModuleFive(wealthCareer, copyData, profile.m5_career);
  const phaseBody = engineSelection && copyData ? fragmentBody(engineSelection.phase, copyData) : "";

  return [
    { title: reportModuleTitles.m1, body: m1Body },
    { title: reportModuleTitles.m2, body: m2Body },
    { title: reportModuleTitles.m3, body: profile.m3_gifts },
    { title: reportModuleTitles.m4, body: profile.m4_relation },
    { title: reportModuleTitles.m5, body: m5Body },
    buildModuleSix(phaseBody),
    buildDirectionDeepModule(profile, direction, directionKey),
    { title: reportModuleTitles.m7, body: direction.m7_actions.join("\n") }
  ];
}

async function buildPayload() {
  const profile = contentData.types[state.mbti];
  const direction = contentData.directions[state.direction];
  if (!profile || !direction) {
    throw new Error("Report content not found.");
  }
  const [engine, copyData] = await Promise.all([loadEngine(), loadEngineCopy()]);
  const chart = engine.computeChart({
    birthDate: state.birthDate,
    birthTime: state.timeUnknown ? null : state.birthTime || null,
    birthPlace: state.birthPlace || null,
    longitude: longitudeForPlace(state.birthPlace),
    gender: state.gender || "na",
    timeUnknown: state.timeUnknown
  });
  const axes = engine.computeAxes(chart, state.mbti);
  const selected = engine.selectFragments(axes);
  const wealthCareer = engine.computeWealthCareer(chart, state.mbti);
  const phaseText = fragmentBody(selected.phase, copyData);
  const track = trackData[state.direction] || trackData.self;
  return {
    nickname: state.nickname || null,
    birthDate: state.birthDate,
    birthTime: state.timeUnknown ? null : state.birthTime || null,
    birthPlace: state.birthPlace || null,
    gender: state.gender || "na",
    mbti: state.mbti,
    mbtiSource: state.mbtiSource,
    direction: state.direction,
    createdAt: new Date().toISOString(),
    degraded: chart.degraded,
    phaseText,
    m5Selection: wealthCareer,
    keywords: profile.keywords,
    summary: profile.summary,
    modules: buildModules(profile, direction, state.direction, selected, copyData, wealthCareer),
    track
  };
}

function buildPayloadForDirection(payload, nextDirection) {
  const profile = contentData.types[payload.mbti];
  const direction = contentData.directions[nextDirection];
  if (!profile || !direction) {
    throw new Error("Report content not found.");
  }
  const fixedModules = payload.modules.slice(0, 6);
  return {
    ...payload,
    direction: nextDirection,
    createdAt: new Date().toISOString(),
    keywords: profile.keywords,
    summary: profile.summary,
    phaseText: payload.phaseText || "",
    modules: [
      ...fixedModules,
      buildDirectionDeepModule(profile, direction, nextDirection),
      { title: reportModuleTitles.m7, body: direction.m7_actions.join("\n") }
    ],
    track: trackData[nextDirection] || trackData.self
  };
}

function publicPayload(payload) {
  return {
    public: true,
    createdAt: payload.createdAt,
    direction: payload.direction,
    keywords: payload.keywords,
    summary: payload.summary,
    modules: [
      {
        title: payload.modules[0].title,
        body: firstTwoSentences(payload.modules[0].body)
      }
    ],
    track: payload.track
  };
}

function renderStep() {
  const root = document.getElementById("step-root");
  if (!root) return;
  const step = state.step || 0;
  root.innerHTML = step === 0 ? stepZero() : stepFrame(step);
  bindStep(root);
}

function progressText(step) {
  return `第 ${step} 頁 / 共 5 頁 · 慢慢來`;
}

function returnAfterEdit(nextStep) {
  if (state.editReturnToConfirm) {
    state.editReturnToConfirm = false;
    return 5;
  }
  return nextStep;
}

function stepFrame(step) {
  const pages = {
    1: stepOne,
    2: stepTwo,
    3: stepThree,
    4: stepFour,
    5: stepFive
  };
  return `
    <p class="step-progress">${progressText(step)}</p>
    ${pages[step]()}
    <div class="step-actions">
      <button class="text-button" type="button" data-back>← 上一頁</button>
    </div>
  `;
}

function stepZero() {
  return `
    <p class="step-question">Self Notes · 自我筆記</p>
    <p>接下來的幾頁，我會問你幾件小事。<br>沒有對錯，不用想太久，憑感覺就好。</p>
    <div class="step-actions">
      <button class="self-button" type="button" data-next="1">好，開始吧</button>
    </div>
  `;
}

function stepOne() {
  return `
    <p class="step-question">我們該怎麼稱呼你？</p>
    <div class="step-fields">
      <label class="field">
        <input id="nickname" type="text" value="${state.nickname || ""}" placeholder="一個名字、暱稱，或者隨便一個代號">
      </label>
      <p class="step-help">這個稱呼會出現在你的筆記裡。不想留也沒關係，我們會叫你「你」。</p>
    </div>
    <div class="step-actions">
      <button class="text-button" type="button" data-skip-name>先不說 →</button>
      <button class="self-button" type="button" data-save-name>下一頁</button>
    </div>
  `;
}

function stepTwo() {
  return `
    <p class="step-question">你是什麼時候、在哪裡出生的？</p>
    <div class="step-fields">
      <label class="field">出生日期<input id="birthDate" type="date" value="${state.birthDate || ""}"></label>
      <label class="field" id="timeField">出生時間<input id="birthTime" type="time" value="${state.birthTime || ""}"></label>
      <label><input id="timeUnknown" type="checkbox" ${state.timeUnknown ? "checked" : ""}> 我不記得了</label>
      <label class="field">出生地點<input id="birthPlace" type="text" value="${state.birthPlace || ""}" placeholder="城市名，搜不到就直接寫"></label>
      <p class="step-help">沒找到這個地方？直接寫下來也可以。</p>
      <label class="field">性別<select id="gender">
        <option value="f" ${state.gender === "f" ? "selected" : ""}>女</option>
        <option value="m" ${state.gender === "m" ? "selected" : ""}>男</option>
        <option value="na" ${state.gender === "na" ? "selected" : ""}>不想說</option>
      </select></label>
      <p class="step-help">出生的時間和地點，能讓筆記更貼近你。時間不記得也完全沒關係——很多人都不記得，筆記會換一種方式來寫你。</p>
      <p class="step-help privacy-inline">你的出生信息不會上傳——它只在你的瀏覽器裡，用來寫這份筆記。〔<a href="/privacy/">瞭解更多 →</a>〕</p>
      <p class="error-text" id="dateError" hidden>需要一個出生日期，筆記才知道從哪裡開始寫你。</p>
    </div>
    <div class="step-actions">
      <button class="self-button" type="button" data-save-birth>下一頁</button>
    </div>
  `;
}

function stepThree() {
  if (!state.mbtiSource) {
    return modePicker();
  }

  if (state.mbtiSource === "quick") {
    return quickQuiz();
  }

  if (state.mbtiSource === "known") {
    return knownPicker();
  }

  return modePicker();
}

function modePicker() {
  return `
    <p class="step-question">關於你的性格，你想從哪裡開始？</p>
    <div class="choice-list">
      <button class="choice-button" type="button" data-mode="known"><strong>我知道我的 MBTI</strong><span>直接告訴我們就好</span></button>
      <button class="choice-button" type="button" data-mode="quick"><strong>幫我快速看看</strong><span>8 個小問題，大約 2 分鐘</span></button>
      <button class="choice-button" type="button" disabled><strong>我想認真一點</strong><span>24 個問題，大約 6 分鐘（即將開放）</span></button>
    </div>
    <p class="step-help">不管哪條路，得到的筆記是同一份——只是認識你的方式不同。</p>
  `;
}

function knownPicker() {
  return `
    <p class="step-question">你的 MBTI 是哪一型？</p>
    <div class="step-fields">
      <div class="mbti-grid">
        ${mbtiTypes
        .map(
          (type) =>
            `<button class="choice-button mbti-type-button ${state.mbti === type ? "is-selected" : ""}" type="button" data-mbti-type="${type}">${type}</button>`
        )
        .join("")}
      </div>
      <p class="step-help">直接選就好，我們不會重新測你。你的類型，會讓筆記裡的方向、提醒和建議，都更貼近你。</p>
      <p class="error-text" id="mbtiError" hidden>選一個類型，或讓我們幫你快速看看。</p>
      <button class="text-button" type="button" data-mode="quick">不太確定？讓我們幫你快速看看 →</button>
    </div>
    <div class="step-actions">
      <button class="self-button" type="button" data-save-mbti>下一頁</button>
    </div>
  `;
}

function quickQuiz() {
  const answers = state.quizAnswers || [];
  const index = answers.length;

  if (index >= quizData.questions.length) {
    const result = calculateQuiz();
    if (result.tie) {
      return tiePicker(result.tie, result.letters);
    }
    state.mbti = result.mbti;
    saveDraft();
    return `
      <p class="step-question">關於你的性格，你想從哪裡開始？</p>
      <p>憑第一感覺選，別糾結。</p>
      <div class="step-actions">
        <button class="self-button" type="button" data-next="4">下一頁</button>
      </div>
    `;
  }

  const item = quizData.questions[index];
  return `
    <p class="step-progress">${index + 1} / 8</p>
    <p class="step-help">憑第一感覺選，別糾結。</p>
    <p class="step-question">${item.question}</p>
    <div class="quiz-options">
      <button class="quiz-button" type="button" data-quiz="${item.aValue}">${item.a}</button>
      <button class="quiz-button" type="button" data-quiz="${item.bValue}">${item.b}</button>
    </div>
    <p class="step-help">答到一半也可以離開，下次回來從這裡繼續。</p>
  `;
}

function tiePicker(key, letters) {
  state.letters = letters;
  const map = {
    energy: ["你獲得能量的方向", ["E", "E · 和人在一起時充電"], ["I", "I · 獨處時充電"]],
    world: ["你接收世界的方式", ["S", "S · 關注具體與當下"], ["N", "N · 關注可能與未來"]],
    decision: ["你做決定的依據", ["T", "T · 先講道理"], ["F", "F · 先顧感受"]],
    pace: ["你和生活的節奏", ["J", "J · 安排好才安心"], ["P", "P · 留點空白更自在"]]
  };
  const [title, left, right] = map[key];
  return `
    <p class="step-question">這一組有點難分，你自己感覺更像哪邊？</p>
    <p class="step-help">${title}</p>
    <div class="choice-list">
      <button class="choice-button" type="button" data-tie="${key}:${left[0]}">${left[1]}</button>
      <button class="choice-button" type="button" data-tie="${key}:${right[0]}">${right[1]}</button>
    </div>
  `;
}

function stepFour() {
  return `
    <p class="step-question">這一份筆記，你最想用它看清什麼？</p>
    <div class="choice-list">
      ${directionCards
        .map(
          ([value, title, desc]) =>
            `<button class="choice-button ${state.direction === value ? "is-selected" : ""}" type="button" data-direction="${value}"><strong>${title}</strong><span>${desc}</span></button>`
        )
        .join("")}
    </div>
    <p class="step-help">選一個最貼近此刻的。其他方向，筆記裡也都會寫到，只是這個會寫得更深。</p>
    <div class="step-actions">
      <button class="self-button" type="button" data-next="5">就這個</button>
    </div>
  `;
}

function stepFive() {
  const timeText = state.timeUnknown ? "時間：不記得，沒關係" : `時間：${state.birthTime || ""}`;
  return `
    <p class="step-question">都對嗎？確認之後，我們就開始為你寫這份筆記。</p>
    <div class="confirm-list">
      <div class="confirm-item"><strong>稱呼</strong><span>${state.nickname || "你"}</span><button class="text-button" type="button" data-jump="1">改一下</button></div>
      <div class="confirm-item"><strong>出生日期</strong><span>${state.birthDate}</span><button class="text-button" type="button" data-jump="2">改一下</button></div>
      <div class="confirm-item"><strong>${timeText}</strong><span>${state.birthPlace || ""}</span><button class="text-button" type="button" data-jump="2">改一下</button></div>
      <div class="confirm-item"><strong>MBTI</strong><span>${state.mbti || ""}</span><button class="text-button" type="button" data-jump="3">改一下</button></div>
      <div class="confirm-item"><strong>${directions[state.direction]}</strong><span></span><button class="text-button" type="button" data-jump="4">改一下</button></div>
    </div>
    <div class="step-actions">
      <button class="self-button" type="button" data-generate>開始寫吧</button>
    </div>
  `;
}

function bindStep(root) {
  root.querySelector("[data-back]")?.addEventListener("click", () => {
    state.step = Math.max(0, (state.step || 0) - 1);
    saveDraft();
    renderStep();
  });

  root.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => {
      state.step = returnAfterEdit(Number(button.dataset.next));
      saveDraft();
      renderStep();
    });
  });

  root.querySelector("[data-save-name]")?.addEventListener("click", () => {
    state.nickname = document.getElementById("nickname").value.trim() || null;
    state.step = returnAfterEdit(2);
    saveDraft();
    renderStep();
  });

  root.querySelector("[data-skip-name]")?.addEventListener("click", () => {
    state.nickname = null;
    state.step = returnAfterEdit(2);
    saveDraft();
    renderStep();
  });

  const timeUnknown = root.querySelector("#timeUnknown");
  if (timeUnknown) {
    const timeField = root.querySelector("#timeField");
    timeField.hidden = timeUnknown.checked;
    timeUnknown.addEventListener("change", () => {
      timeField.hidden = timeUnknown.checked;
    });
  }

  root.querySelector("[data-save-birth]")?.addEventListener("click", () => {
    const date = document.getElementById("birthDate").value;
    const error = document.getElementById("dateError");
    if (!date) {
      error.hidden = false;
      return;
    }
    state.birthDate = date;
    state.timeUnknown = document.getElementById("timeUnknown").checked;
    state.birthTime = state.timeUnknown ? "" : document.getElementById("birthTime").value;
    state.birthPlace = document.getElementById("birthPlace").value.trim();
    state.gender = document.getElementById("gender").value;
    state.step = returnAfterEdit(3);
    saveDraft();
    renderStep();
  });

  root.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mbtiSource = button.dataset.mode;
      state.quizAnswers = [];
      localStorage.setItem(quizStoreKey, JSON.stringify([]));
      saveDraft();
      renderStep();
    });
  });

  root.querySelectorAll("[data-mbti-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mbti = button.dataset.mbtiType;
      state.letters = {
        energy: state.mbti[0],
        world: state.mbti[1],
        decision: state.mbti[2],
        pace: state.mbti[3]
      };
      saveDraft();
      renderStep();
    });
  });

  root.querySelectorAll("[data-letter]").forEach((button) => {
    button.addEventListener("click", () => {
      const [key, value] = button.dataset.letter.split(":");
      state.letters[key] = value;
      saveDraft();
      renderStep();
    });
  });

  root.querySelector("[data-save-mbti]")?.addEventListener("click", () => {
    const error = document.getElementById("mbtiError");
    if (!state.mbti) {
      error.hidden = false;
      return;
    }
    state.mbtiSource = "known";
    state.step = returnAfterEdit(4);
    saveDraft();
    renderStep();
  });

  root.querySelectorAll("[data-quiz]").forEach((button) => {
    button.addEventListener("click", () => {
      state.quizAnswers.push(button.dataset.quiz);
      localStorage.setItem(quizStoreKey, JSON.stringify(state.quizAnswers));
      saveDraft();
      renderStep();
    });
  });

  root.querySelectorAll("[data-tie]").forEach((button) => {
    button.addEventListener("click", () => {
      const [key, value] = button.dataset.tie.split(":");
      state.letters[key] = value;
      state.mbti = `${state.letters.energy}${state.letters.world}${state.letters.decision}${state.letters.pace}`;
      state.step = returnAfterEdit(4);
      saveDraft();
      renderStep();
    });
  });

  root.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      state.direction = button.dataset.direction;
      saveDraft();
      renderStep();
    });
  });

  root.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      state.step = Number(button.dataset.jump);
      state.editReturnToConfirm = true;
      if (state.step === 3 && state.mbtiSource === "quick") {
        state.mbtiSource = null;
        state.quizAnswers = [];
        localStorage.setItem(quizStoreKey, JSON.stringify([]));
      }
      saveDraft();
      renderStep();
    });
  });

  root.querySelector("[data-generate]")?.addEventListener("click", () => {
    generateReport(root);
  });
}

function calculateQuiz() {
  const letters = { energy: "I", world: "N", decision: "F", pace: "J" };
  const groups = {
    energy: ["E", "I"],
    world: ["S", "N"],
    decision: ["T", "F"],
    pace: ["J", "P"]
  };
  const pairs = {
    energy: state.quizAnswers.slice(0, 2),
    world: state.quizAnswers.slice(2, 4),
    decision: state.quizAnswers.slice(4, 6),
    pace: state.quizAnswers.slice(6, 8)
  };

  for (const [key, values] of Object.entries(pairs)) {
    const [left, right] = groups[key];
    const leftCount = values.filter((item) => item === left).length;
    const rightCount = values.filter((item) => item === right).length;
    if (leftCount === rightCount) {
      return { tie: key, letters };
    }
    letters[key] = leftCount > rightCount ? left : right;
  }

  return {
    letters,
    mbti: `${letters.energy}${letters.world}${letters.decision}${letters.pace}`
  };
}

function generateReport(root) {
  emitEvent("self_generate_complete");
  const stopLoading = renderGenerating(root);
  const payloadPromise = buildPayload();

  Promise.all([payloadPromise, new Promise((resolve) => setTimeout(resolve, 4100))]).then(([payload]) => {
    stopLoading();
    const encoded = encodePayload(payload);
    localStorage.setItem("selfNotesLastReport", encoded);
    window.location.href = `../r/#${encoded}`;
  }).catch(() => {
    stopLoading();
    root.innerHTML = `
      <p class="step-question">這一頁沒寫好，再試一次可以嗎？你填的內容都還在。</p>
      <button class="self-button" type="button" data-generate>重新生成</button>
    `;
    bindStep(root);
  });
}

function renderGenerating(root) {
  let index = 0;
  root.innerHTML = `
    <div class="generating">
      <div>
        <div class="breath"></div>
        <p id="loadingLine">${loadingLines[0]}</p>
      </div>
    </div>
  `;
  const line = root.querySelector("#loadingLine");
  const timer = setInterval(() => {
    index = (index + 1) % loadingLines.length;
    line.textContent = loadingLines[index];
  }, 900);
  return () => clearInterval(timer);
}

function renderReport() {
  const root = document.getElementById("report-root");
  if (!root) return;
  let payload;

  if (pageKind === "sample") {
    payload = samplePayload();
  } else {
    try {
      payload = decodePayload(window.location.hash);
    } catch {
      const stored = localStorage.getItem("selfNotesLastReport");
      payload = stored ? decodePayload(stored) : samplePayload();
    }
  }

  const isSwitchedReport = switchedReportHashes.has(window.location.hash);
  root.innerHTML = payload.public ? publicReport(payload) : fullReport(payload, { isSwitchedReport, baseModulesExpanded, isSample: pageKind === "sample" });
  bindReport(root, payload);
  if (focusDirectionLineAfterRender) {
    focusDirectionLineAfterRender = false;
    requestAnimationFrame(() => {
      root.querySelector(".direction-line")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
}

function samplePayload() {
  const sample = contentData.sample;
  return {
    nickname: "小滿",
    direction: "self",
    createdAt: new Date().toISOString(),
    keywords: sample.keywords,
    summary: sample.summary,
    modules: sample.modules,
    track: trackData.self
  };
}

function fullReport(payload, options = {}) {
  const title = payload.nickname ? `寫給${payload.nickname}的自我筆記` : "寫給你的自我筆記";
  const completion = options.isSwitchedReport ? "換好了。這一次，從新的方向開始讀。" : "你的筆記寫好了。<br>找個安靜的地方，慢慢讀。不著急。";
  const moduleHtml = reportModules(payload.modules, options);
  const switchHtml = options.isSample ? "" : directionSwitchModule(payload);
  const degradedHtml = payload.degraded ? `<p class="step-help">${degradedNote}</p>` : "";
  const shareHtml = options.isSample
    ? ""
    : `<div class="step-actions">
      <button class="self-button" type="button" data-share>分享這份筆記</button>
      <span class="step-help" id="shareStatus"></span>
    </div>`;
  return `
    <header class="report-head">
      <p class="self-en">找自己 · Self Notes</p>
      <h1 class="note-title">${title}</h1>
      <p class="date-line">寫於 ${formatDate(payload.createdAt)}</p>
      <p class="direction-line">這一份，想幫你看清：${directions[payload.direction]}</p>
      <p class="completion">${completion}</p>
      <div class="keyword-row">${payload.keywords.map((item) => `<span>${item}</span>`).join("")}</div>
      <p>${payload.summary}</p>
      ${degradedHtml}
    </header>
    ${moduleHtml}
    ${trackModule(payload.track)}
    ${switchHtml}
    ${shareHtml}
    <footer class="self-footer"><p>${stringData.disclaimerHtml}</p><a class="self-back" href="/privacy/">隱私與你的信息</a></footer>
  `;
}

function reportModules(modules, options) {
  if (!options.isSwitchedReport) {
    return modules.map((module) => noteModule(module)).join("");
  }
  const baseModules = modules.slice(0, 5).map((module) => noteModule(module)).join("");
  const currentModules = modules.slice(5).map((module) => noteModule(module)).join("");
  return `
    ${baseModulesToggle(options.baseModulesExpanded)}
    ${options.baseModulesExpanded ? baseModules : ""}
    ${currentModules}
  `;
}

function baseModulesToggle(isExpanded) {
  return `
    <section class="base-modules-toggle">
      <p>前五章寫的是你本身，每個方向都相同。</p>
      <button class="text-button" type="button" data-toggle-base-modules>${isExpanded ? "收起 ↑" : "展開重讀 ↓"}</button>
    </section>
  `;
}

function directionSwitchModule(payload) {
  if (!payload.mbti || !directions[payload.direction]) {
    return "";
  }
  return `
    <section class="note-module direction-switch">
      <h2>想換個方向，再看一次自己嗎？</h2>
      <p>同一個你，換一個角度——筆記會為你重寫這個方向的解讀和那三件小事，再換一首曲子。</p>
      <div class="direction-switch__grid">
        ${Object.entries(directions)
          .map(([value, label]) => {
            const isCurrent = payload.direction === value;
            return `
              <button class="choice-button ${isCurrent ? "is-selected" : ""}" type="button" data-switch-direction="${value}" ${isCurrent ? "disabled" : ""}>
                <strong>${label}</strong>
                ${isCurrent ? "<span>這一份就是</span>" : ""}
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function publicReport(payload) {
  const module = payload.modules[0];
  return `
    <header class="report-head">
      <p class="self-en">找自己 · 公開摘錄</p>
      <h1 class="note-title">一份自我筆記</h1>
      <div class="keyword-row">${payload.keywords.map((item) => `<span>${item}</span>`).join("")}</div>
      <p>${payload.summary}</p>
    </header>
    ${noteModule(module)}
    ${trackModule(payload.track)}
    <section class="note-module">
      <p class="public-note">這是一份 Self Notes 的公開摘錄。完整的筆記，只屬於寫下它的人。</p>
      <a class="self-button" href="../">我也想寫一份 →</a>
    </section>
    <footer class="self-footer"><a class="self-back" href="/privacy/">隱私與你的信息</a></footer>
  `;
}

function noteModule(module) {
  return `
    <section class="note-module">
      <h2>${module.title}</h2>
      <div class="note-body">${module.body
        .split(/\n\n/)
        .map((paragraph) => `<p>${paragraph}</p>`)
        .join("")}</div>
      ${deepSectionModule(module.deepSection)}
    </section>
  `;
}

function deepSectionModule(section) {
  if (!section) return "";
  if (section.type === "career") return careerDeepSection(section);
  if (section.type === "resource") return resourceDeepSection(section);
  if (section.type === "relation") return relationDeepSection(section);
  if (section.type === "phase") return phaseDeepSection(section);
  return "";
}

function pairedDeepList(items) {
  return `
    <ul class="deep-list deep-list--paired">
      ${items.map(([label, reason]) => `<li><strong>${label}</strong><span>—— ${reason}</span></li>`).join("")}
    </ul>
  `;
}

function simpleDeepList(items) {
  return `
    <ul class="deep-list">
      ${items.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function careerDeepSection(section) {
  return `
    <div class="deep-section career-paths-section">
      <h3>${section.framework.title}</h3>
      <p>${section.framework.intro}</p>
      <h4>${section.framework.fitTitle}</h4>
      ${pairedDeepList(section.fit)}
      <h4>${section.framework.avoidTitle}</h4>
      ${simpleDeepList(section.avoid)}
      <p class="deep-section__foot">${section.framework.footer}</p>
    </div>
  `;
}

function resourceDeepSection(section) {
  return `
    <div class="deep-section money-ways-section">
      <h3>${section.framework.title}</h3>
      <p>${section.framework.intro}</p>
      <h4>${section.framework.fromTitle}</h4>
      ${pairedDeepList(section.from)}
      <h4>${section.framework.leakTitle}</h4>
      ${simpleDeepList(section.leak)}
      <h4>${section.framework.ruleTitle}</h4>
      <p class="deep-rule">${section.rule}</p>
      <p class="deep-section__foot">${section.framework.footer}</p>
    </div>
  `;
}

function relationDeepSection(section) {
  return `
    <div class="deep-section relation-people-section">
      <h3>${section.framework.title}</h3>
      <p>${section.framework.intro}</p>
      <h4>${section.framework.fitTitle}</h4>
      ${pairedDeepList(section.fit)}
      <h4>${section.framework.hurtTitle}</h4>
      ${simpleDeepList(section.hurt)}
      <h4>${section.framework.wordTitle}</h4>
      <p class="deep-rule">${section.word}</p>
      <p class="deep-section__foot">${section.framework.footer}</p>
    </div>
  `;
}

function phaseDeepSection(section) {
  return `
    <div class="deep-section phase-company-section">
      <h3>${section.framework.title}</h3>
      <p>${section.framework.intro}</p>
      <h4>${section.framework.doTitle}</h4>
      ${pairedDeepList(section.do)}
      <h4>${section.framework.avoidTitle}</h4>
      ${simpleDeepList(section.avoid)}
      <h4>${section.framework.wordTitle}</h4>
      <p class="deep-rule">${section.word}</p>
      <p class="deep-section__foot">${section.framework.footer}</p>
    </div>
  `;
}

function trackModule(track) {
  return `
    <section class="note-module">
      <h2>給今天的你的一首曲子</h2>
      <p>讀到這裡，剩下的交給音樂——按下播放，坐一會兒再走。</p>
      <div class="track-card">
        <img src="${track.cover}" alt="EP${track.epId}">
        <div>
          <p class="self-en">EP${track.epId}</p>
          <h3>${track.title}</h3>
          <p>${track.reason}</p>
          <audio controls preload="none" src="${track.src}"></audio>
        </div>
      </div>
      <p><a class="self-back" href="../../">更多這樣的曲子 → Imperfect Notes 主頁</a></p>
    </section>
  `;
}

function bindReport(root, payload) {
  emitDeepSectionView(root, payload);

  root.querySelector("[data-toggle-base-modules]")?.addEventListener("click", () => {
    baseModulesExpanded = !baseModulesExpanded;
    if (baseModulesExpanded) {
      emitEvent("reread_base_modules");
    }
    renderReport();
  });

  root.querySelectorAll("[data-switch-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      switchReportDirection(root, payload, button.dataset.switchDirection);
    });
  });

  root.querySelector("[data-share]")?.addEventListener("click", async () => {
    const nextPayload = publicPayload(payload);
    const encoded = encodePayload(nextPayload);
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    const [k1, k2, k3] = payload.keywords;
    const text = stringData.shareText
      .replace("{k1}", k1)
      .replace("{k2}", k2)
      .replace("{k3}", k3);
    await navigator.clipboard.writeText(`${text}\n${url}`);
    document.getElementById("shareStatus").textContent = "鏈接已複製。分享出去的，是不含你個人信息的公開版。";
    emitEvent("self_share");
  });

  root.querySelectorAll("audio").forEach((audio) => {
    audio.addEventListener("play", () => emitEvent("self_track_play", { ep: payload.track.epId }));
  });
}

function emitDeepSectionView(root, payload) {
  const hashKey = window.location.hash || `${payload.mbti || "sample"}-${payload.direction}-${payload.createdAt}`;
  if (root.querySelector(".career-paths-section")) {
    const key = `${hashKey}:career`;
    if (!deepSectionViewEvents.has(key)) {
      deepSectionViewEvents.add(key);
      emitEvent("career_paths_view", { direction: payload.direction });
    }
  }
  if (root.querySelector(".money-ways-section")) {
    const key = `${hashKey}:resource`;
    if (!deepSectionViewEvents.has(key)) {
      deepSectionViewEvents.add(key);
      emitEvent("money_ways_view", { direction: payload.direction });
    }
  }
  if (root.querySelector(".relation-people-section")) {
    const key = `${hashKey}:relation`;
    if (!deepSectionViewEvents.has(key)) {
      deepSectionViewEvents.add(key);
      emitEvent("relation_people_view", { direction: payload.direction });
    }
  }
  if (root.querySelector(".phase-company-section")) {
    const key = `${hashKey}:phase`;
    if (!deepSectionViewEvents.has(key)) {
      deepSectionViewEvents.add(key);
      emitEvent("phase_company_view", { direction: payload.direction });
    }
  }
}

function switchReportDirection(root, payload, nextDirection) {
  emitEvent("direction_switch", { direction: nextDirection });
  const stopLoading = renderGenerating(root);
  setTimeout(() => {
    stopLoading();
    const nextPayload = buildPayloadForDirection(payload, nextDirection);
    const encoded = encodePayload(nextPayload);
    localStorage.setItem("selfNotesLastReport", encoded);
    baseModulesExpanded = false;
    focusDirectionLineAfterRender = true;
    switchedReportHashes.add(`#${encoded}`);
    window.location.hash = encoded;
  }, 4100);
}

async function init() {
  await loadData();
  if (pageKind === "start") {
    emitEvent("self_start_begin");
    renderStep();
  }
  if (pageKind === "report" || pageKind === "sample") {
    renderReport();
    window.addEventListener("hashchange", renderReport);
  }
}

init();
