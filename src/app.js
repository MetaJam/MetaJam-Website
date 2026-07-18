const releaseTrack = document.querySelector("#releaseTrack");
const screenshotsTrack = document.querySelector("#screenshotsTrack");
const galleryDialog = document.querySelector("#galleryDialog");
const dialogImage = document.querySelector("#dialogImage");
const dialogTitle = document.querySelector("#dialogTitle");
const galleryPrevious = document.querySelector("[data-gallery-previous]");
const galleryNext = document.querySelector("[data-gallery-next]");
const citationDialog = document.querySelector("#citationDialog");
const citationOpen = document.querySelector("[data-citation-open]");
const citationClose = document.querySelector("[data-citation-close]");
const citationText = document.querySelector("[data-citation-text]");
const citationDownload = document.querySelector("[data-citation-download]");
const heroMedia = document.querySelector(".hero-media");
const navLinks = document.querySelectorAll(".nav-links a[href^='#']");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeColorMeta = document.querySelector("meta[name='theme-color']");
let galleryItems = [];
let currentGalleryIndex = -1;
const themeStorageKey = "metajam-theme";

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function renderState(track, className, message) {
  if (!track) return;
  track.replaceChildren(createElement("div", className, message));
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme() {
  try {
    return localStorage.getItem(themeStorageKey);
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function applyTheme(theme, shouldStore = false) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = normalizedTheme;
  themeColorMeta?.setAttribute("content", normalizedTheme === "dark" ? "#0b1118" : "#f6f8fb");
  if (themeToggle) {
    const nextTheme = normalizedTheme === "dark" ? "light" : "dark";
    themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    themeToggle.setAttribute("aria-pressed", normalizedTheme === "dark" ? "true" : "false");
  }
  if (shouldStore) storeTheme(normalizedTheme);
}

function initThemeToggle() {
  applyTheme(getStoredTheme() || document.documentElement.dataset.theme || getSystemTheme());
  themeToggle?.addEventListener("click", () => {
    const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    applyTheme(currentTheme === "dark" ? "light" : "dark", true);
  });
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }
  return response.json();
}

function renderReleases(releases) {
  if (!releaseTrack) return;
  if (!releases.length) {
    renderState(releaseTrack, "empty-state", "No release notes were found in NEWS.md.");
    return;
  }

  releaseTrack.replaceChildren(
    ...releases.map((release) => {
      const card = createElement("article", "release-card");
      const title = createElement("h3", "", release.title);
      const content = createElement("div");
      content.innerHTML = release.html || "<p>No details yet.</p>";
      card.append(title, content);
      return card;
    })
  );
}

function showGalleryItem(index) {
  if (!galleryDialog || !dialogImage || !dialogTitle) return;
  if (!galleryItems.length) return;
  currentGalleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[currentGalleryIndex];
  dialogImage.src = item.src;
  dialogImage.alt = item.alt;
  dialogTitle.textContent = `${item.title} (${currentGalleryIndex + 1} of ${galleryItems.length})`;
}

function openGallery(index) {
  if (!galleryDialog || !galleryItems.length) return;
  showGalleryItem(index);
  if (typeof galleryDialog.showModal === "function") {
    galleryDialog.showModal();
    document.querySelector("[data-dialog-close]")?.focus();
  } else {
    window.open(galleryItems[currentGalleryIndex].src, "_blank", "noopener");
  }
}

function renderScreenshots(items) {
  if (!screenshotsTrack) return;
  galleryItems = items;
  if (!items.length) {
    renderState(screenshotsTrack, "empty-state", "Screenshots will appear here after image files are added to the screenshots folder.");
    return;
  }

  screenshotsTrack.replaceChildren(
    ...items.map((item, index) => {
      const card = createElement("article", "screenshot-card");
      const button = createElement("button", "screenshot-button");
      button.type = "button";
      button.addEventListener("click", () => openGallery(index));
      const image = document.createElement("img");
      image.src = item.src;
      image.alt = item.alt;
      image.loading = "lazy";
      const title = createElement("span", "", item.title);
      button.append(image, title);
      card.append(button);
      return card;
    })
  );
}

function initDialog() {
  document.querySelector("[data-dialog-close]")?.addEventListener("click", () => {
    galleryDialog?.close();
  });
  galleryPrevious?.addEventListener("click", () => showGalleryItem(currentGalleryIndex - 1));
  galleryNext?.addEventListener("click", () => showGalleryItem(currentGalleryIndex + 1));
  galleryDialog?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const protectedTarget = target?.closest(".gallery-frame img, .dialog-close, .gallery-nav");
    if (!protectedTarget) galleryDialog.close();
  });
  galleryDialog?.addEventListener("close", () => {
    currentGalleryIndex = -1;
  });
  document.addEventListener("keydown", (event) => {
    if (!galleryDialog?.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      galleryDialog.close();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showGalleryItem(currentGalleryIndex - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showGalleryItem(currentGalleryIndex + 1);
    }
  });
}

function renderCitation(citation) {
  if (!citationText) return;
  citationText.textContent = citation.formatted || "Citation details could not be compiled.";
  if (citationDownload && citation.download) {
    citationDownload.href = citation.download;
  }
}

function initCitationDialog() {
  citationOpen?.addEventListener("click", () => {
    if (typeof citationDialog?.showModal === "function") {
      citationDialog.showModal();
      citationClose?.focus();
    }
  });
  citationClose?.addEventListener("click", () => citationDialog?.close());
  citationDialog?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const protectedTarget = target?.closest(".citation-dialog-panel");
    if (!protectedTarget) citationDialog.close();
  });
}

function initReveal() {
  document.body.classList.add("js");
  const sections = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );
  sections.forEach((section) => observer.observe(section));
}

function initHeroScrollFloat() {
  if (!heroMedia) return;
  if (window.matchMedia("(any-pointer: coarse)").matches) return;
  let ticking = false;

  function updateLogoFloat() {
    const rect = heroMedia.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    const centerDistance = rect.top + rect.height / 2 - viewport / 2;
    const normalized = Math.max(-1, Math.min(1, centerDistance / Math.max(1, viewport / 2)));
    const float = normalized * -18;
    const scale = 1 + (1 - Math.abs(normalized)) * 0.035;

    heroMedia.style.setProperty("--logo-float", `${float.toFixed(2)}px`);
    heroMedia.style.setProperty("--logo-scale", scale.toFixed(3));
    ticking = false;
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateLogoFloat);
  }

  updateLogoFloat();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
}

function setActiveNavigation(id) {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function initActiveNavigation() {
  if (!navLinks.length) return;
  const sections = [...navLinks]
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (!("IntersectionObserver" in window)) {
    setActiveNavigation(sections[0]?.id || "metajam");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveNavigation(visible.target.id);
    },
    {
      rootMargin: "-32% 0px -48% 0px",
      threshold: [0.08, 0.2, 0.42, 0.7]
    }
  );

  sections.forEach((section) => observer.observe(section));
}

async function hydrateGeneratedContent() {
  try {
    const releases = await loadJson("./assets/generated/releases.json");
    renderReleases(releases);
  } catch {
    renderState(releaseTrack, "error-state", "Release notes could not be loaded.");
  }

  try {
    const screenshots = await loadJson("./assets/generated/screenshots.json");
    renderScreenshots(screenshots);
  } catch {
    renderState(screenshotsTrack, "error-state", "Screenshots could not be loaded.");
  }

  try {
    const citation = await loadJson("./assets/generated/citation.json");
    renderCitation(citation);
  } catch {
    if (citationText) citationText.textContent = "Citation details could not be loaded.";
  }
}

initThemeToggle();
initReveal();
initHeroScrollFloat();
initActiveNavigation();
initDialog();
initCitationDialog();
hydrateGeneratedContent();
