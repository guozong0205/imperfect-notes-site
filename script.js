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
(function () {
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
  const tracks = Array.from(document.querySelectorAll(".player__track"));

  if (!audio || !source || !cover || !tracks.length) return;

  let currentIndex = 0;

  function fmt(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function loadTrack(index, autoplay) {
    const track = tracks[index];

    tracks.forEach((item) => item.classList.remove("is-active"));
    track.classList.add("is-active");
    track.scrollIntoView({ block: "nearest" });

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

  tracks.forEach((track, index) => {
    track.addEventListener("click", () => loadTrack(index, true));
  });

  btnPlay.addEventListener("click", () => {
    if (audio.paused) {
      audio.play();
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
