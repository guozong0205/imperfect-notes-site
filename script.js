const archiveToggle = document.querySelector(".archive-toggle");
const extraEpisodes = document.querySelectorAll(".episode-card.is-extra");
const subscribeForm = document.querySelector(".subscribe-form");
const formNote = document.querySelector(".form-note");
const heroChoice = new URLSearchParams(window.location.search).get("hero");

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
  const ytLink = document.getElementById("player-yt");
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
    item.dataset.cover = episode.cover;
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
    setTimeout(() => {
      cover.src = track.dataset.cover;
      cover.alt = `EP.${track.dataset.ep} cover`;
      cover.style.opacity = "1";
    }, 200);

    epLabel.textContent = `EP.${track.dataset.ep}`;
    title.textContent = track.querySelector("strong").textContent;
    desc.textContent = track.dataset.desc || "";
    ytLink.href = track.dataset.youtube || "#";
    source.src = track.dataset.src;
    audio.load();
    progress.value = 0;
    timeCurrent.textContent = "0:00";
    timeTotal.textContent = "0:00";
    currentIndex = index;

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

if (subscribeForm) {
  subscribeForm.addEventListener("submit", (event) => {
    if (!subscribeForm.getAttribute("action")) {
      event.preventDefault();
      formNote.textContent = "暫時還不能送出。";
    }
  });
}
