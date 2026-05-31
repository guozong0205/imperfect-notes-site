const archiveToggle = document.querySelector(".archive-toggle");
const extraEpisodes = document.querySelectorAll(".episode-card.is-extra");
const subscribeForm = document.querySelector(".subscribe-form");
const formNote = document.querySelector(".form-note");
const listenPlayer = document.querySelector(".listen-player");
const listenItems = document.querySelectorAll(".listen-player__item");
const listenAudio = document.querySelector(".listen-audio");
const listenYoutubeLink = document.querySelector(".listen-youtube-link");
const listenToggle = document.querySelector(".listen-player__mobile-toggle");
const listenCurrent = document.querySelector(".listen-player__current");
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

if (listenPlayer && listenAudio) {
  const activateListenItem = (item, shouldPlay = true) => {
    const src = item.dataset.src;
    const youtube = item.dataset.youtube;
    const label = item.querySelector("strong").textContent.trim();
    const ep = item.querySelector("span").textContent.trim();

    if (!src) return;

    listenItems.forEach((button) => {
      button.classList.remove("is-active");
      button.removeAttribute("aria-current");
    });

    item.classList.add("is-active");
    item.setAttribute("aria-current", "true");

    listenAudio.src = src;

    if (shouldPlay) {
      listenAudio.play().catch(() => {});
    }

    if (listenYoutubeLink && youtube) {
      listenYoutubeLink.href = youtube;
    }

    if (listenCurrent) {
      listenCurrent.textContent = `${ep} ${label}`;
    }

    listenPlayer.classList.remove("is-open");

    if (listenToggle) {
      listenToggle.setAttribute("aria-expanded", "false");
    }
  };

  listenItems.forEach((item) => {
    item.addEventListener("click", () => {
      activateListenItem(item);
    });
  });

  listenAudio.addEventListener("ended", () => {
    const currentIndex = Array.from(listenItems).findIndex((item) =>
      item.classList.contains("is-active")
    );
    const nextItem = listenItems[currentIndex + 1];

    if (nextItem) {
      activateListenItem(nextItem);
    }
  });
}

if (listenToggle && listenPlayer) {
  listenToggle.addEventListener("click", () => {
    const isOpen = listenPlayer.classList.toggle("is-open");
    listenToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

if (subscribeForm) {
  subscribeForm.addEventListener("submit", (event) => {
    if (!subscribeForm.getAttribute("action")) {
      event.preventDefault();
      formNote.textContent = "暫時還不能送出。";
    }
  });
}
