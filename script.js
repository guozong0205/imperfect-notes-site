const archiveToggle = document.querySelector(".archive-toggle");
const extraEpisodes = document.querySelectorAll(".episode-card.is-extra");
const subscribeForm = document.querySelector(".subscribe-form");
const formNote = document.querySelector(".form-note");
const heroChoice = new URLSearchParams(window.location.search).get("hero");
const siteRootUrl = new URL("./", document.currentScript.src);

if (heroChoice === "a" || heroChoice === "b" || heroChoice === "c" || heroChoice === "d") {
  document.body.classList.remove("hero-bg-a", "hero-bg-b", "hero-bg-c", "hero-bg-d");
  document.body.classList.add(`hero-bg-${heroChoice}`);
}

// 光源鼠标
const glow = document.createElement("div");
glow.id = "cursor-glow";
document.body.appendChild(glow);

let glowTimeout;
document.addEventListener("mousemove", (e) => {
  glow.style.left = e.clientX + "px";
  glow.style.top = e.clientY + "px";
  glow.style.opacity = "1";
  clearTimeout(glowTimeout);
  glowTimeout = setTimeout(() => {
    glow.style.opacity = "0";
  }, 2000);
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");

    if (!href || href === "#") {
      return;
    }

    const target = document.querySelector(href);

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

if (archiveToggle) {
  archiveToggle.addEventListener("click", () => {
    const expanded = archiveToggle.dataset.expanded === "true";

    extraEpisodes.forEach((card) => {
      card.hidden = expanded;
    });

    archiveToggle.dataset.expanded = String(!expanded);
    archiveToggle.innerHTML = expanded
      ? "<span>查看全部 →</span><span>View All →</span>"
      : "<span>收起 ↑</span><span>Close ↑</span>";
  });
}

// Unified Player
(async function () {
  const audio = document.getElementById("player-audio");
  const source = document.getElementById("player-source");
  const cover = document.getElementById("player-cover");
  const epLabel = document.getElementById("player-ep");
  const title = document.getElementById("player-title");
  const desc = document.getElementById("player-desc");
  const btnPlay = document.getElementById("btn-play");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const progress = document.getElementById("player-progress");
  const timeCurrent = document.getElementById("time-current");
  const timeTotal = document.getElementById("time-total");
  const playlist = document.getElementById("player-playlist");
  const wallpaperGrid = document.getElementById("wallpaper-grid");

  if (!audio || !source || !cover || !playlist) return;

  function episodeLabel(ep) {
    return `EP.${String(ep).padStart(2, "0")}`;
  }

  function createTrack(episode) {
    const item = document.createElement("li");
    item.className = "player__track";
    if (episode.active) {
      item.classList.add("is-active");
    }
    item.dataset.ep = String(episode.ep).padStart(2, "0");
    item.dataset.cover = new URL(episode.cover, siteRootUrl).href;
    item.dataset.src = episode.mp3Url;
    item.dataset.youtube = episode.youtubeUrl;
    item.dataset.desc = episode.description || "";

    const label = document.createElement("span");
    label.textContent = episodeLabel(episode.ep);
    const strong = document.createElement("strong");
    strong.textContent = episode.titleEn;
    item.append(label, strong);
    return item;
  }

  function createWallpaper(episode) {
    const link = document.createElement("a");
    link.href = episode.wallpaperUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = "wallpaper-item";
    link.title = `${episodeLabel(episode.ep)} — 下載`;

    const image = document.createElement("img");
    image.src = episode.cover;
    image.alt = `${episodeLabel(episode.ep)} wallpaper`;
    image.loading = "lazy";

    const label = document.createElement("span");
    label.className = "wallpaper-label";
    label.textContent = `${episodeLabel(episode.ep)} ↓`;
    link.append(image, label);
    return link;
  }

  async function loadEpisodes() {
    const response = await fetch("data/episodes.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`episodes.json ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.episodes) ? data.episodes : [];
  }

  function renderEpisodes(episodes) {
    playlist.replaceChildren(...episodes.map(createTrack));
    if (wallpaperGrid) {
      wallpaperGrid.replaceChildren(...episodes.filter((episode) => episode.wallpaperUrl).map(createWallpaper));
    }
  }

  try {
    const episodes = await loadEpisodes();
    renderEpisodes(episodes);
  } catch (error) {
    console.error("Failed to load episodes.", error);
  }

  const tracks = Array.from(document.querySelectorAll(".player__track"));

  if (!tracks.length) return;

  let currentIndex = Math.max(0, tracks.findIndex((track) => track.classList.contains("is-active")));

  function fmt(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function loadTrack(index, autoplay, shouldScroll = true) {
    const track = tracks[index];

    tracks.forEach((item) => item.classList.remove("is-active"));
    track.classList.add("is-active");
    if (shouldScroll) {
      track.scrollIntoView({ block: "nearest" });
    }

    cover.style.opacity = "0";
    cover.src = track.dataset.cover;
    cover.alt = `EP.${track.dataset.ep} cover`;
    setTimeout(() => {
      cover.style.opacity = "1";
    }, 200);

    epLabel.textContent = `EP.${track.dataset.ep}`;
    title.textContent = track.querySelector("strong").textContent;
    desc.textContent = track.dataset.desc || "";
    source.src = track.dataset.src;
    audio.load();
    progress.value = 0;
    timeCurrent.textContent = "0:00";
    timeTotal.textContent = "0:00";
    currentIndex = index;

    document.dispatchEvent(new CustomEvent("imperfectnotes:trackchange"));

    if (autoplay) {
      audio.play().catch(() => {});
    }

    btnPlay.textContent = autoplay ? "❚❚" : "▶";
  }

  loadTrack(currentIndex, false, false);

  tracks.forEach((track, index) => {
    track.addEventListener("click", () => loadTrack(index, true));
  });

  btnPlay.addEventListener("click", () => {
    if (audio.paused) {
      if (audio.readyState === 0) {
        audio.load();
        audio.addEventListener("canplay", () => audio.play().catch(() => {}), { once: true });
      } else {
        audio.play().catch(() => {});
      }
      btnPlay.textContent = "❚❚";
    } else {
      audio.pause();
      btnPlay.textContent = "▶";
    }
  });

  btnPrev.addEventListener("click", () => {
    if (currentIndex > 0) loadTrack(currentIndex - 1, !audio.paused);
  });

  btnNext.addEventListener("click", () => {
    if (currentIndex < tracks.length - 1) loadTrack(currentIndex + 1, !audio.paused);
  });

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    progress.value = (audio.currentTime / audio.duration) * 100;
    timeCurrent.textContent = fmt(audio.currentTime);
  });

  audio.addEventListener("loadedmetadata", () => {
    timeTotal.textContent = fmt(audio.duration);
  });

  progress.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = (progress.value / 100) * audio.duration;
  });

  audio.addEventListener("ended", () => {
    if (currentIndex < tracks.length - 1) {
      loadTrack(currentIndex + 1, true);
    } else {
      btnPlay.textContent = "▶";
    }
  });

  audio.addEventListener("play", () => {
    btnPlay.textContent = "❚❚";
  });

  audio.addEventListener("pause", () => {
    btnPlay.textContent = "▶";
  });
})();

// Keep the homepage audio element alive while visitors browse another page.
// Cross-document pages are presented in a same-origin layer; because the parent
// document never unloads, playback remains genuinely continuous.
(function enableContinuousPageNavigation() {
  const homePath = new URL("./", window.location.href).pathname;
  const audio = document.getElementById("player-audio");
  const mainPlayButton = document.getElementById("btn-play");
  const mainPrevButton = document.getElementById("btn-prev");
  const mainNextButton = document.getElementById("btn-next");
  let pageLayer = null;
  let pageFrame = null;
  let miniPlayer = null;
  let miniPlayerDismissed = true;

  function syncMiniPlayer() {
    if (!miniPlayer) return;

    const cover = document.getElementById("player-cover");
    const episode = document.getElementById("player-ep");
    const title = document.getElementById("player-title");
    const miniCover = miniPlayer.querySelector(".mini-player__cover");
    const miniEpisode = miniPlayer.querySelector(".mini-player__episode");
    const miniTitle = miniPlayer.querySelector(".mini-player__title");
    const miniPlay = miniPlayer.querySelector(".mini-player__play");

    miniCover.src = cover.currentSrc || cover.src;
    miniCover.alt = cover.alt;
    miniEpisode.textContent = episode.textContent;
    miniTitle.textContent = title.textContent;
    miniPlay.textContent = audio.paused ? "▶" : "❚❚";
    miniPlay.setAttribute("aria-label", audio.paused ? "繼續播放" : "暫停");
    miniPlayer.hidden = miniPlayerDismissed;
  }

  function createMiniPlayer() {
    if (miniPlayer) return miniPlayer;

    const player = document.createElement("aside");
    player.className = "mini-player";
    player.setAttribute("aria-label", "音樂播放器");
    player.innerHTML = `
      <img class="mini-player__cover" alt="">
      <div class="mini-player__info">
        <span class="mini-player__episode"></span>
        <strong class="mini-player__title"></strong>
      </div>
      <div class="mini-player__controls">
        <button class="mini-player__button mini-player__prev" type="button" aria-label="上一首">◀◀</button>
        <button class="mini-player__button mini-player__play" type="button" aria-label="暫停">❚❚</button>
        <button class="mini-player__button mini-player__next" type="button" aria-label="下一首">▶▶</button>
        <button class="mini-player__close" type="button" aria-label="關閉音樂">×</button>
      </div>
    `;

    player.querySelector(".mini-player__prev").addEventListener("click", () => mainPrevButton.click());
    player.querySelector(".mini-player__play").addEventListener("click", () => mainPlayButton.click());
    player.querySelector(".mini-player__next").addEventListener("click", () => mainNextButton.click());
    player.querySelector(".mini-player__close").addEventListener("click", () => {
      audio.pause();
      miniPlayerDismissed = true;
      player.hidden = true;
    });

    miniPlayer = player;
    document.body.appendChild(player);
    syncMiniPlayer();
    return player;
  }

  function isHome(url) {
    return url.pathname === homePath || url.pathname === `${homePath}index.html`;
  }

  function closePage(updateHistory = true) {
    if (!pageLayer) return;
    pageLayer.remove();
    pageLayer = null;
    pageFrame = null;
    document.body.classList.remove("has-page-layer");
    if (updateHistory && !isHome(new URL(window.location.href))) {
      history.pushState({ continuousPage: false }, "", homePath);
    }
  }

  function openPage(url, updateHistory = true) {
    if (isHome(url)) {
      closePage(updateHistory);
      return;
    }

    if (!pageLayer) {
      pageLayer = document.createElement("div");
      pageLayer.className = "page-layer";
      pageLayer.setAttribute("role", "dialog");
      pageLayer.setAttribute("aria-label", "站內頁面");

      pageFrame = document.createElement("iframe");
      pageFrame.className = "page-layer__frame";
      pageFrame.title = "Imperfect Notes 站內頁面";
      pageLayer.appendChild(pageFrame);
      document.body.appendChild(pageLayer);
      document.body.classList.add("has-page-layer");

      pageFrame.addEventListener("load", () => {
        let frameUrl;
        try {
          frameUrl = new URL(pageFrame.contentWindow.location.href);
        } catch {
          return;
        }

        if (frameUrl.origin !== window.location.origin) return;
        if (isHome(frameUrl)) {
          closePage(true);
          return;
        }

        const nextPath = `${frameUrl.pathname}${frameUrl.search}${frameUrl.hash}`;
        const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (nextPath !== currentPath) {
          history.replaceState({ continuousPage: true }, "", nextPath);
        }
      });
    }

    pageFrame.src = url.href;
    if (updateHistory) {
      history.pushState({ continuousPage: true }, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || link.target || link.hasAttribute("download")) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.hash && url.pathname === homePath) return;
    if (isHome(url) && !pageLayer) return;

    event.preventDefault();
    openPage(url);
  });

  window.addEventListener("popstate", () => {
    const url = new URL(window.location.href);
    if (isHome(url)) {
      closePage(false);
    } else {
      openPage(url, false);
    }
  });

  if (audio) {
    audio.addEventListener("play", () => {
      miniPlayerDismissed = false;
      createMiniPlayer();
      syncMiniPlayer();
    });
    audio.addEventListener("pause", syncMiniPlayer);
    document.addEventListener("imperfectnotes:trackchange", syncMiniPlayer);
  }
})();

if (subscribeForm) {
  subscribeForm.addEventListener("submit", (event) => {
    if (!subscribeForm.getAttribute("action")) {
      event.preventDefault();
      formNote.textContent = "暫時還不能送出。";
    }
  });
}
