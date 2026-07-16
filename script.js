// Shared helpers -------------------------------------------------------------
const PORTFOLIO_STATE = {
  page: "teerapat-work-page",
  filter: "teerapat-work-filter",
  scroll: "teerapat-work-scroll",
  returnPending: "teerapat-return-pending"
};

const revealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 })
  : null;

function registerRevealElements(root = document) {
  root.querySelectorAll(".reveal:not([data-reveal-registered])").forEach((element) => {
    element.dataset.revealRegistered = "true";
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add("in-view");
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeText(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function escapeHtml(value) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Work grid + category filters + pagination + hover video --------------------
const projectGrid = document.querySelector("#project-grid");
const projectPagination = document.querySelector("#project-pagination");
const projectFilters = document.querySelector("#project-filters");
const projectFilterCount = document.querySelector("#project-filter-count");

if (projectGrid && typeof PROJECTS !== "undefined") {
  const projectsPerPage = 6;
  const workFilters = [
    { key: "all", label: "ทั้งหมด", categories: null },
    { key: "short-film", label: "หนังสั้น", categories: ["SHORT FILM"] },
    { key: "music-video", label: "MV", categories: ["MUSIC VIDEO", "MV"] },
    { key: "commercial", label: "โฆษณา", categories: ["COMMERCIAL", "ADVERTISEMENT", "โฆษณา"] },
    { key: "short-content", label: "คลิปสั้น", categories: ["SOCIAL CONTENT", "SHORT CONTENT", "REELS", "TIKTOK", "คลิปสั้น"] }
  ];
  const params = new URLSearchParams(window.location.search);
  const urlPage = Number(params.get("workPage"));
  const urlFilter = params.get("workCategory");
  const storedPage = Number(sessionStorage.getItem(PORTFOLIO_STATE.page));
  const storedFilter = sessionStorage.getItem(PORTFOLIO_STATE.filter);
  const validFilterKeys = new Set(workFilters.map((filter) => filter.key));
  let activeFilter = validFilterKeys.has(urlFilter)
    ? urlFilter
    : (validFilterKeys.has(storedFilter) ? storedFilter : "all");
  let projectPage = Number.isFinite(urlPage) && urlPage > 0
    ? urlPage - 1
    : (Number.isFinite(storedPage) ? storedPage : 0);
  let hasRenderedProjects = false;

  function getActiveFilter() {
    return workFilters.find((filter) => filter.key === activeFilter) || workFilters[0];
  }

  function getFilteredProjects() {
    const filter = getActiveFilter();
    if (!filter.categories) return PROJECTS;
    return PROJECTS.filter((project) => filter.categories.includes(safeText(project.category).trim().toUpperCase()));
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(getFilteredProjects().length / projectsPerPage));
  }

  function saveWorkState() {
    sessionStorage.setItem(PORTFOLIO_STATE.page, String(projectPage));
    sessionStorage.setItem(PORTFOLIO_STATE.filter, activeFilter);
    sessionStorage.setItem(PORTFOLIO_STATE.scroll, String(window.scrollY));
    sessionStorage.setItem(PORTFOLIO_STATE.returnPending, "1");
  }

  function updatePageInUrl() {
    const url = new URL(window.location.href);
    if (projectPage === 0) url.searchParams.delete("workPage");
    else url.searchParams.set("workPage", String(projectPage + 1));
    if (activeFilter === "all") url.searchParams.delete("workCategory");
    else url.searchParams.set("workCategory", activeFilter);
    history.replaceState(
      { workPage: projectPage + 1, workCategory: activeFilter },
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  function renderFilterControls() {
    if (projectFilters) {
      projectFilters.querySelectorAll("[data-filter]").forEach((button) => {
        const isActive = button.dataset.filter === activeFilter;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    }

    if (projectFilterCount) {
      const filteredProjects = getFilteredProjects();
      const activeLabel = getActiveFilter().label;
      projectFilterCount.textContent = activeFilter === "all"
        ? `${filteredProjects.length} ผลงาน`
        : `${activeLabel} · ${filteredProjects.length} ผลงาน`;
    }
  }

  function setupCardPreviewVideos() {
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    projectGrid.querySelectorAll(".project-card").forEach((card) => {
      const video = card.querySelector(".project-preview-video");
      if (!video) return;

      video.addEventListener("error", () => card.classList.add("preview-unavailable"), { once: true });
      if (!supportsHover) return;

      card.addEventListener("mouseenter", () => {
        video.currentTime = 0;
        const promise = video.play();
        if (promise) promise.catch(() => card.classList.add("preview-unavailable"));
      });
      card.addEventListener("mouseleave", () => {
        video.pause();
        video.currentTime = 0;
      });
    });
  }

  function renderPagination() {
    if (!projectPagination) return;
    const totalPages = getTotalPages();
    if (totalPages <= 1) {
      projectPagination.hidden = true;
      projectPagination.innerHTML = "";
      return;
    }

    projectPagination.hidden = false;
    projectPagination.innerHTML = `
      <button type="button" class="page-arrow" ${projectPage === 0 ? "disabled" : ""} aria-label="หน้าก่อน">←</button>
      ${Array.from({ length: totalPages }, (_, index) => `
        <button type="button" class="page-dot ${index === projectPage ? "active" : ""}"
          data-page="${index}" aria-label="หน้า ${index + 1}" aria-current="${index === projectPage ? "page" : "false"}"></button>
      `).join("")}
      <button type="button" class="page-arrow" ${projectPage === totalPages - 1 ? "disabled" : ""} aria-label="หน้าถัดไป">→</button>
    `;

    const goToPage = (page) => {
      projectPage = clamp(page, 0, totalPages - 1);
      sessionStorage.setItem(PORTFOLIO_STATE.page, String(projectPage));
      updatePageInUrl();
      renderProjects();
      // Intentionally keep the current viewport position. This prevents the
      // portfolio from jumping back to its heading on small screens.
    };

    projectPagination.querySelector(".page-arrow:first-child")?.addEventListener("click", () => goToPage(projectPage - 1));
    projectPagination.querySelector(".page-arrow:last-child")?.addEventListener("click", () => goToPage(projectPage + 1));
    projectPagination.querySelectorAll(".page-dot").forEach((button) => {
      button.addEventListener("click", () => goToPage(Number(button.dataset.page)));
    });
  }

  function renderProjects() {
    const filteredProjects = getFilteredProjects();
    const totalPages = getTotalPages();
    projectPage = clamp(projectPage, 0, totalPages - 1);
    const start = projectPage * projectsPerPage;
    const currentProjects = filteredProjects.slice(start, start + projectsPerPage);

    if (!currentProjects.length) {
      projectGrid.innerHTML = `
        <div class="project-empty" role="status">
          <h3>ยังไม่มีผลงานในหมวดนี้</h3>
          <p>เพิ่มหรือแก้ค่า category ของผลงานได้ในไฟล์ projects.js</p>
        </div>
      `;
    } else {
      projectGrid.innerHTML = currentProjects.map((project) => {
        const detailParams = new URLSearchParams({
          id: safeText(project.id),
          workPage: String(projectPage + 1)
        });
        if (activeFilter !== "all") detailParams.set("workCategory", activeFilter);
        const detailHref = `project.html?${detailParams.toString()}`;
        const preview = project.previewVideo
          ? `<video class="project-preview-video" muted loop playsinline preload="metadata" poster="${project.cover}" aria-hidden="true">
               <source src="${project.previewVideo}" type="video/mp4">
             </video>`
          : "";

        return `
          <article class="project-card reveal">
            <a href="${detailHref}" data-project-link aria-label="ดูรายละเอียด ${safeText(project.title)}">
              <div class="project-image">
                <img src="${project.cover}" alt="ภาพหน้าปก ${safeText(project.title)}" loading="lazy">
                ${preview}
                <span class="project-arrow">↗</span>
                ${project.previewVideo ? '<span class="preview-label">HOVER TO PLAY</span>' : ""}
              </div>
              <div class="project-meta">
                <span class="project-number">${project.number}</span>
                <div><h3>${safeText(project.title)}</h3><p>${project.category} · ${project.role}</p></div>
                <span class="project-year">${project.year}</span>
              </div>
            </a>
          </article>
        `;
      }).join("");
    }

    projectGrid.querySelectorAll("[data-project-link]").forEach((link) => link.addEventListener("click", saveWorkState));
    registerRevealElements(projectGrid);
    setupCardPreviewVideos();
    renderFilterControls();
    renderPagination();

    if (hasRenderedProjects) {
      requestAnimationFrame(() => projectGrid.querySelectorAll(".project-card").forEach((card) => card.classList.add("in-view")));
    }
    hasRenderedProjects = true;
  }

  projectFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button || !projectFilters.contains(button)) return;
    const nextFilter = button.dataset.filter;
    if (!validFilterKeys.has(nextFilter) || nextFilter === activeFilter) return;

    activeFilter = nextFilter;
    projectPage = 0;
    sessionStorage.setItem(PORTFOLIO_STATE.filter, activeFilter);
    sessionStorage.setItem(PORTFOLIO_STATE.page, "0");
    updatePageInUrl();
    renderProjects();
  });

  updatePageInUrl();
  renderProjects();

  // Restore the exact page, category and scroll position after leaving a project.
  if (sessionStorage.getItem(PORTFOLIO_STATE.returnPending) === "1") {
    const savedScroll = Number(sessionStorage.getItem(PORTFOLIO_STATE.scroll));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (Number.isFinite(savedScroll)) window.scrollTo({ top: savedScroll, behavior: "auto" });
      sessionStorage.removeItem(PORTFOLIO_STATE.returnPending);
    }));
  }
}

// Seamless collaborative-work cover rail on the home page -------------------
const collabWorkRail = document.querySelector("#collab-work-rail");
if (collabWorkRail && typeof ADDITIONAL_WORKS !== "undefined" && Array.isArray(ADDITIONAL_WORKS)) {
  const collabViewport = collabWorkRail.querySelector(".collab-marquee");
  const collabTrack = collabWorkRail.querySelector(".collab-marquee-track");
  const validWorks = ADDITIONAL_WORKS.filter((item) => item && item.poster).slice(0, 6);
  let collabAnimationFrame = 0;
  let collabOffset = 0;
  let collabGroupWidth = 0;
  let collabViewportWidth = 0;
  let collabLastTime = 0;
  let collabPaused = false;
  let collabPointerId = null;
  let collabPointerStartX = 0;
  let collabPointerStartY = 0;
  let collabPointerStartOffset = 0;
  let collabPointerAxis = "";
  let collabPointerMoved = false;
  let collabBlockClick = false;
  let collabResumeTimer = 0;

  function renderCollabGroup(groupIndex = 0) {
    return `
      <div class="collab-marquee-group" ${groupIndex ? 'aria-hidden="true"' : ""}>
        ${validWorks.map((item, index) => {
          const destination = safeText(item.url || item.video).trim();
          const title = safeText(item.title, `ผลงาน ${index + 1}`);
          const poster = safeText(item.poster);
          const picture = `<img src="${poster}" alt="" draggable="false">`;

          if (!destination) {
            return `<span class="collab-cover is-disabled" aria-label="${title}">${picture}</span>`;
          }

          return `<a class="collab-cover" href="${destination}" target="_blank" rel="noopener noreferrer" ${groupIndex ? 'tabindex="-1"' : ""} aria-label="เปิดผลงานต้นทาง ${title}">${picture}</a>`;
        }).join("")}
      </div>
    `;
  }

  function normalizeCollabOffset(value) {
    if (!collabGroupWidth) return 0;
    return ((value % collabGroupWidth) + collabGroupWidth) % collabGroupWidth;
  }

  function paintCollabMarquee() {
    if (!collabTrack) return;
    collabTrack.style.transform = `translate3d(${-collabOffset}px, 0, 0)`;
  }

  function stopCollabMarquee() {
    if (collabAnimationFrame) cancelAnimationFrame(collabAnimationFrame);
    collabAnimationFrame = 0;
  }

  function animateCollabMarquee(time) {
    if (!collabLastTime) collabLastTime = time;
    const elapsed = Math.min(40, time - collabLastTime);
    collabLastTime = time;

    if (!collabPaused && collabPointerId === null && collabGroupWidth > 0) {
      collabOffset = normalizeCollabOffset(collabOffset + elapsed * 0.028);
      paintCollabMarquee();
    }

    collabAnimationFrame = requestAnimationFrame(animateCollabMarquee);
  }

  function setupCollabMarquee({ preservePosition = true } = {}) {
    if (!collabTrack || !collabViewport || !validWorks.length) return;

    const oldProgress = preservePosition && collabGroupWidth > 0
      ? normalizeCollabOffset(collabOffset) / collabGroupWidth
      : 0;

    stopCollabMarquee();
    collabLastTime = 0;
    collabTrack.innerHTML = renderCollabGroup(0);
    collabTrack.style.transform = "translate3d(0, 0, 0)";

    const firstGroup = collabTrack.querySelector(".collab-marquee-group");
    if (!firstGroup) return;
    collabGroupWidth = firstGroup.getBoundingClientRect().width;
    if (!collabGroupWidth) return;

    collabViewportWidth = Math.round(collabViewport.clientWidth);
    const groupCount = Math.max(3, Math.ceil(collabViewportWidth / collabGroupWidth) + 2);
    collabTrack.innerHTML = Array.from({ length: groupCount }, (_, index) => renderCollabGroup(index)).join("");

    collabOffset = normalizeCollabOffset(oldProgress * collabGroupWidth);
    paintCollabMarquee();

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      collabAnimationFrame = requestAnimationFrame(animateCollabMarquee);
    }
  }

  function finishCollabDrag(event) {
    if (collabPointerId === null || (event && event.pointerId !== collabPointerId)) return;

    if (event && collabViewport.hasPointerCapture?.(collabPointerId)) {
      try { collabViewport.releasePointerCapture(collabPointerId); } catch (_) {}
    }

    if (collabPointerAxis === "x" && collabPointerMoved) {
      collabBlockClick = true;
      window.setTimeout(() => { collabBlockClick = false; }, 320);
    }

    collabPointerId = null;
    collabPointerAxis = "";
    collabPointerMoved = false;
    collabViewport.classList.remove("is-dragging");
    collabLastTime = 0;

    window.clearTimeout(collabResumeTimer);
    collabResumeTimer = window.setTimeout(() => {
      // Touch/pen interaction resumes from the exact dragged position.
      // Mouse hover and keyboard focus are handled by their own listeners.
      collabPaused = false;
      collabLastTime = 0;
    }, 180);
  }

  if (collabTrack && validWorks.length) {
    collabWorkRail.hidden = false;
    setupCollabMarquee({ preservePosition: false });
    window.addEventListener("load", () => setupCollabMarquee({ preservePosition: true }), { once: true });

    let collabResizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(collabResizeTimer);
      collabResizeTimer = window.setTimeout(() => {
        const nextWidth = Math.round(collabViewport.clientWidth);
        // Mobile browser toolbars often change only the viewport height while scrolling.
        // Rebuild only when the rail's actual width changed, and keep its current progress.
        if (Math.abs(nextWidth - collabViewportWidth) > 2) {
          setupCollabMarquee({ preservePosition: true });
        }
      }, 160);
    });

    collabViewport.addEventListener("mouseenter", () => { collabPaused = true; });
    collabViewport.addEventListener("mouseleave", () => {
      if (collabPointerId === null) {
        collabPaused = false;
        collabLastTime = 0;
      }
    });
    collabViewport.addEventListener("focusin", () => { collabPaused = true; });
    collabViewport.addEventListener("focusout", () => {
      if (collabPointerId === null) {
        collabPaused = false;
        collabLastTime = 0;
      }
    });

    collabViewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || collabGroupWidth <= 0) return;
      window.clearTimeout(collabResumeTimer);
      collabPointerId = event.pointerId;
      collabPointerStartX = event.clientX;
      collabPointerStartY = event.clientY;
      collabPointerStartOffset = collabOffset;
      collabPointerAxis = "";
      collabPointerMoved = false;
      collabPaused = true;
      collabLastTime = 0;
      try { collabViewport.setPointerCapture(event.pointerId); } catch (_) {}
    });

    collabViewport.addEventListener("pointermove", (event) => {
      if (event.pointerId !== collabPointerId) return;

      const deltaX = event.clientX - collabPointerStartX;
      const deltaY = event.clientY - collabPointerStartY;

      if (!collabPointerAxis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 7) {
        collabPointerAxis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      }

      if (collabPointerAxis === "y") {
        finishCollabDrag(event);
        return;
      }

      if (collabPointerAxis !== "x") return;
      event.preventDefault();
      collabPointerMoved = true;
      collabViewport.classList.add("is-dragging");
      collabOffset = normalizeCollabOffset(collabPointerStartOffset - deltaX);
      paintCollabMarquee();
    }, { passive: false });

    collabViewport.addEventListener("pointerup", finishCollabDrag);
    collabViewport.addEventListener("pointercancel", finishCollabDrag);
    collabViewport.addEventListener("lostpointercapture", finishCollabDrag);
    collabViewport.addEventListener("click", (event) => {
      if (!collabBlockClick) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    registerRevealElements(collabWorkRail.parentElement || document);
  }
}

// Project detail -------------------------------------------------------------
const detailRoot = document.querySelector("#project-content");
if (detailRoot && typeof PROJECTS !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const requestedPage = Math.max(1, Number(params.get("workPage")) || 1);
  const requestedFilter = params.get("workCategory");
  const project = PROJECTS.find((item) => item.id === id) || PROJECTS[0];
  const gallery = Array.isArray(project.gallery) ? project.gallery : [];

  document.title = `${project.title} — Teerapat Kharachom`;

  const fullProjectButton = project.fullVideoUrl
    ? `<a class="full-project-link" href="${project.fullVideoUrl}" target="_blank" rel="noopener noreferrer">
         <span>ดูผลงานเต็ม</span><b>↗</b>
       </a>`
    : `<span class="full-project-link is-disabled" title="ใส่ fullVideoUrl ใน projects.js เพื่อเปิดใช้งาน">
         <span>ดูผลงานเต็ม</span><b>↗</b>
       </span>`;

  const detailVideo = safeText(project.detailVideo || project.previewVideo).trim();
  const projectMedia = detailVideo
    ? `<video class="project-main-video" controls autoplay muted loop playsinline preload="auto" aria-label="วิดีโอผลงาน ${safeText(project.title)}">
         <source src="${detailVideo}" type="video/mp4">
         เบราว์เซอร์นี้ไม่รองรับการเล่นวิดีโอ
       </video>`
    : `<img src="${project.cover}" alt="ภาพหน้าปก ${safeText(project.title)}">`;

  detailRoot.innerHTML = `
    <section class="project-hero section-pad">
      <div class="project-detail-inner">
        <div class="project-kicker"><span>PROJECT ${project.number}</span><span>${project.category} / ${project.year}</span></div>
        <h1>${project.title}</h1>
        <div class="project-role"><p>${project.intro}</p><div class="project-role-actions"><strong>${project.role}</strong>${fullProjectButton}</div></div>
      </div>
    </section>
    <div class="project-cover section-pad">
      <div class="project-detail-inner">${projectMedia}</div>
    </div>
    <section class="project-info section-pad">
      <div class="project-info-inner project-detail-inner">
        <aside class="project-facts">
          <div><span>CATEGORY</span><p>${project.category}</p></div>
          <div><span>YEAR</span><p>${project.year}</p></div>
          <div><span>MY ROLE</span><p>${project.role}</p></div>
        </aside>
        <div class="project-story">
          <div><h2>ภาพรวมโปรเจกต์</h2><p>${project.overview}</p></div>
          <div><h2>กระบวนการทำงาน</h2><p>${project.process}</p></div>
          <div><h2>สิ่งที่ฉันรับผิดชอบ</h2><p>${project.contribution}</p></div>
        </div>
      </div>
    </section>
    <section class="gallery section-pad">
      <div class="gallery-inner project-detail-inner">
        <div class="gallery-head"><div><p class="eyebrow light">PROJECT GALLERY</p><h2>BEHIND<br>THE FRAME</h2></div><span>${String(gallery.length).padStart(2, "0")} IMAGES</span></div>
        <div class="gallery-grid">
          ${gallery.map((src, index) => `<figure><img src="${src}" alt="ภาพผลงาน ${project.title} ลำดับที่ ${index + 1}" loading="lazy"></figure>`).join("")}
        </div>
      </div>
    </section>
  `;

  // Start the main project video immediately when autoplay is permitted.
  // It remains muted so mobile and desktop browsers can autoplay it.
  const mainProjectVideo = detailRoot.querySelector(".project-main-video");
  if (mainProjectVideo) {
    mainProjectVideo.muted = true;
    const playPromise = mainProjectVideo.play();
    if (playPromise && typeof playPromise.catch === "function") playPromise.catch(() => {});
  }

  // Back button: use browser history when possible, otherwise return to the
  // correct work page. The header stays sticky, so this control is always visible.
  const backLink = document.querySelector(".back-link");
  if (backLink) {
    const backParams = new URLSearchParams({ workPage: String(requestedPage) });
    if (requestedFilter) backParams.set("workCategory", requestedFilter);
    backLink.href = `index.html?${backParams.toString()}#work`;
    backLink.addEventListener("click", (event) => {
      let cameFromPortfolio = false;
      try {
        if (document.referrer) {
          const referrer = new URL(document.referrer);
          cameFromPortfolio = referrer.origin === window.location.origin && (referrer.pathname.endsWith("/") || referrer.pathname.endsWith("index.html"));
        }
      } catch (_) {}
      if (cameFromPortfolio && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    });
  }

}

function initInternshipCarousel() {
  const carousel = document.querySelector("[data-carousel]");
  if (!carousel) return;
  const track = carousel.querySelector(".internship-track");
  const slides = Array.from(carousel.querySelectorAll(".internship-slide"));
  const dots = Array.from(carousel.querySelectorAll(".carousel-dot"));
  const prev = carousel.querySelector(".carousel-prev");
  const next = carousel.querySelector(".carousel-next");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeIndex = 0;
  let timer = null;

  function playActiveVideo() {
    slides.forEach((slide, index) => {
      const video = slide.querySelector("video");
      slide.setAttribute("aria-hidden", String(index !== activeIndex));
      if (!video) return;
      if (index === activeIndex) {
        const promise = video.play();
        if (promise) promise.catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }

  function showSlide(index, manual = false) {
    activeIndex = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${activeIndex * 100}%)`;
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === activeIndex);
      dot.setAttribute("aria-current", dotIndex === activeIndex ? "true" : "false");
    });
    playActiveVideo();
    if (manual) restartAuto();
  }

  function stopAuto() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function startAuto() {
    stopAuto();
    if (!reduceMotion && slides.length > 1) timer = window.setInterval(() => showSlide(activeIndex + 1), 6000);
  }

  function restartAuto() {
    stopAuto();
    startAuto();
  }

  prev?.addEventListener("click", () => showSlide(activeIndex - 1, true));
  next?.addEventListener("click", () => showSlide(activeIndex + 1, true));
  dots.forEach((dot) => dot.addEventListener("click", () => showSlide(Number(dot.dataset.slide), true)));
  carousel.addEventListener("mouseenter", stopAuto);
  carousel.addEventListener("mouseleave", startAuto);
  carousel.addEventListener("focusin", stopAuto);
  carousel.addEventListener("focusout", startAuto);
  document.addEventListener("visibilitychange", () => document.hidden ? stopAuto() : startAuto());

  showSlide(0);
  startAuto();
}

// Activity gallery page ------------------------------------------------------
const activityList = document.querySelector("#activity-list");

if (activityList && typeof ACTIVITIES !== "undefined") {
  const activities = Array.isArray(ACTIVITIES) ? ACTIVITIES : [];

  activityList.innerHTML = activities.map((activity, activityIndex) => {
    const images = Array.isArray(activity.images) ? activity.images.slice(0, 3) : [];
    while (images.length < 3) images.push("");
    const details = Array.isArray(activity.details) ? activity.details : [];
    const title = escapeHtml(activity.title || `กิจกรรม ${activityIndex + 1}`);
    const number = escapeHtml(activity.number || String(activityIndex + 1).padStart(2, "0"));

    return `
      <article class="activity-entry reveal">
        <div class="activity-photo-grid" aria-label="รูปภาพ ${title}">
          ${images.map((src, imageIndex) => `
            <button class="activity-photo activity-photo-${imageIndex + 1}" type="button"
              data-activity-image="${escapeHtml(src)}"
              data-activity-caption="${title} · ภาพที่ ${imageIndex + 1}"
              aria-label="เปิด ${title} ภาพที่ ${imageIndex + 1}">
              <img src="${escapeHtml(src)}" alt="${title} ภาพที่ ${imageIndex + 1}" loading="lazy">
              <span class="activity-photo-placeholder" aria-hidden="true">เพิ่มรูป<br>${escapeHtml(src || `activity-${activityIndex + 1}-${imageIndex + 1}.jpg`)}</span>
            </button>
          `).join("")}
        </div>
        <div class="activity-copy">
          <div class="activity-copy-head">
            <span>${number}</span>
            <p>${escapeHtml(activity.period || "[ช่วงเวลาที่เข้าร่วม]")}</p>
          </div>
          <h2>${title}</h2>
          <p class="activity-summary">${escapeHtml(activity.summary || "เพิ่มรายละเอียดภาพรวมของกิจกรรมนี้")}</p>
          ${details.length ? `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}
        </div>
      </article>
    `;
  }).join("");

  activityList.querySelectorAll(".activity-photo img").forEach((image) => {
    const markMissing = () => image.closest(".activity-photo")?.classList.add("is-missing");
    image.addEventListener("error", markMissing, { once: true });
    if (!image.getAttribute("src") || (image.complete && image.naturalWidth === 0)) markMissing();
  });

  const lightbox = document.querySelector("#activity-lightbox");
  const lightboxImage = lightbox?.querySelector("img");
  const lightboxCaption = lightbox?.querySelector("p");
  const lightboxClose = lightbox?.querySelector(".activity-lightbox-close");

  activityList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-activity-image]");
    if (!button || button.classList.contains("is-missing")) return;
    const source = button.dataset.activityImage;
    if (!source || !lightbox || !lightboxImage) return;
    lightboxImage.src = source;
    lightboxImage.alt = button.dataset.activityCaption || "ภาพกิจกรรม";
    if (lightboxCaption) lightboxCaption.textContent = button.dataset.activityCaption || "";
    if (typeof lightbox.showModal === "function") lightbox.showModal();
  });

  const closeLightbox = () => {
    if (!lightbox?.open) return;
    lightbox.close();
    if (lightboxImage) lightboxImage.src = "";
  };

  lightboxClose?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
}

registerRevealElements();

// Custom cursor --------------------------------------------------------------
const cursor = document.querySelector(".cursor");
if (cursor && window.matchMedia("(pointer: fine)").matches) {
  window.addEventListener("mousemove", (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });
}

// Mobile navigation ----------------------------------------------------------
const menuToggle = document.querySelector(".mobile-menu-toggle");
const primaryNav = document.querySelector("#primary-nav");
if (menuToggle && primaryNav) {
  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "เปิดเมนู");
    document.body.classList.remove("menu-open");
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "เปิดเมนู" : "ปิดเมนู");
    document.body.classList.toggle("menu-open", !isOpen);
  });

  primaryNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
  window.addEventListener("resize", () => { if (window.innerWidth > 900) closeMenu(); });
}
