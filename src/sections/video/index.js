// Video section — fullscreen transparent video, scrubbed by scroll progress.
//
// Placeholder until a real alpha-channel video is dropped in: the <video>
// element is created without a src; once setSrc(url) is called from outside
// (or src is set in the markup), scroll-driven currentTime kicks in.
//
// The WebGL gradient behind remains visible — the video element is transparent
// where the source has alpha, and CSS background is transparent.

export function mountVideo({ container, orchestrator } = {}) {
  const section = container.querySelector('[data-section="video"]');
  if (!section) return null;
  section.classList.add('video');

  // Sticky/fixed stage pinned to viewport while the user scrolls through.
  const stage = document.createElement('div');
  stage.className = 'video__stage';
  section.appendChild(stage);

  const video = document.createElement('video');
  video.className = 'video__el';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  // No src yet — placeholder. Drop a transparent .webm/.mov when ready.
  stage.appendChild(video);

  // Visible placeholder so the section is recognizable without a real source.
  const placeholder = document.createElement('div');
  placeholder.className = 'video__placeholder';
  placeholder.innerHTML = `
    <div class="video__placeholder-frame">
      <div class="video__placeholder-icon" aria-hidden="true">▶</div>
      <div class="video__placeholder-label">Video Placeholder</div>
      <div class="video__placeholder-hint">Scroll to scrub</div>
    </div>
  `;
  stage.appendChild(placeholder);

  let duration = 0;
  video.addEventListener('loadedmetadata', () => {
    duration = Number.isFinite(video.duration) ? video.duration : 0;
    placeholder.classList.add('is-hidden');
  });
  video.addEventListener('error', () => { duration = 0; });

  // Scroll → video time. Only effective once a real video is loaded.
  orchestrator?.onProgress('video', ({ progress }) => {
    if (duration > 0) {
      video.currentTime = Math.max(0, Math.min(duration, progress * duration));
    }
  });

  return {
    section,
    video,
    /** Swap in a real video source at runtime. */
    setSrc(url) {
      if (!url) return;
      video.src = url;
      video.load();
    },
  };
}
