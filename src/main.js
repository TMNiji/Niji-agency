import { gsap }              from 'gsap';
import { initScroll }        from '@modules/scroll.js';
import { initWebGL }         from '@modules/webgl.js';
import { createOrchestrator } from '@modules/orchestrator.js';
import { mountHero }          from './sections/hero/index.js';
import { mountThinking }      from './sections/thinking/index.js';
import { mountVideo, DESIGN_SERVICES, CODE_SERVICES } from './sections/video/index.js';
import { mountClients }       from './sections/clients/index.js';
import { mountAwards }        from './sections/awards/index.js';
import { mountFooter }        from './sections/footer/index.js';
import { fetchHomePage }      from './lib/sanity.js';
import { initNoise }         from '@modules/noise.js';
import { createPreloader }   from '@modules/preloader.js';
import { prefersReducedMotion } from '@modules/motion.js';

// All sections share the same 200vh height so each occupies one full section of
// scroll. The rainbow → DESIGN transition is driven by thinking's last quarter
// (see onProgress below), then the prism drops back to the dark grain as the
// user crosses into video.top.
const SECTION_HEIGHT = '200vh';

const SECTIONS = [
  {
    id: 'hero',
    label: 'VISION',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'thinking',
    label: 'THINKING',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'video',
    label: 'DESIGN',
    // DESIGN scrubs frames 1-160. Height tuned so the ~160-frame slice spreads
    // over enough scroll that scrubbing doesn't feel twitchy.
    triggerHeight: '200vh',
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'code',
    label: 'CODE',
    // CODE scrubs frames 161-end (~337 frames) — taller than DESIGN so the
    // larger slice keeps the same frames-per-pixel feel.
    triggerHeight: '350vh',
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'clients',
    // Taller than the rest so the 8-card river isn't a one-flick blur.
    triggerHeight: '400vh',
    label: 'CLIENTS',
    triggerStart: 'top top',
    // 'bottom top' — progress 0→1 maps over the full clients height so the
    // card cycling has scroll budget to fully sweep every card past the camera
    // (and the trailing exit slot) BEFORE awards starts. Awards previously
    // overlapped via margin-top:-100vh; that's gone now, so the two sections
    // are sequential and the clients→awards handoff is a clean cut.
    triggerEnd: 'bottom top',
  },
  {
    id: 'awards',
    label: 'AWARDS',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    // 'bottom top' so awards stays revealed across its whole region, then hands
    // off to contact (the terminal section) as the user scrolls past. It's a
    // hover list with no scroll-scrubbed progress, so only the enter/leave edges
    // matter. awards.css pulls this section up 100vh to sit over clients'
    // trailing tail (no dark gap between the two).
    triggerEnd: 'bottom top',
  },
  {
    id: 'contact',
    label: 'CONTACT',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    // Terminal section — 'bottom top' puts the trigger end past the document
    // bottom so contact stays revealed while the user rests at the very bottom.
    triggerEnd: 'bottom top',
  },
];

// Fraction of thinking's scroll devoted to the rainbow → DESIGN transition.
// Below this threshold, the cell + dots are shown (hero_grain). Above it, the
// prism shader animates; the colorful peak holds briefly and then drops back
// to the dark grain as the user crosses into DESIGN (video.top).
const PRISM_THRESHOLD = 0.6;

initNoise();

async function boot() {
  // Glitchy boot overlay — already painted from index.html. Drive its real
  // progress as each heavy step lands, and lock scroll until it's dismissed so
  // the visitor always starts at the top once the page is ready.
  const preloader = createPreloader();

  // Fetch CMS content and init scroll concurrently — neither blocks the other.
  const [sanityContent, lenis] = await Promise.all([
    fetchHomePage(),
    Promise.resolve(initScroll()),
  ]);
  lenis.stop();
  preloader.to(0.4);

  const webgl = initWebGL({
    canvas: document.querySelector('#webgl-canvas'),
    initialShader: 'hero_grain',
  });
  preloader.to(0.6);

  const root = document.querySelector('#app');
  root.innerHTML = SECTIONS.map((s) => {
    const h = s.triggerHeight ? ` style="min-height:${s.triggerHeight}"` : '';
    return `<section id="${s.id}" data-section="${s.id}"${h}></section>`;
  }).join('');

  const orchestrator = createOrchestrator({ sections: SECTIONS });

  // Hero — ensure correct shader is set. uProgress is driven continuously by
  // onProgress('hero') in hero/index.js so the cell emerges as the face explodes.
  orchestrator.onEnter('hero', () => {
    webgl.shaderPlane.setShader('hero_grain');
  });

  // Thinking — safety net: if the page loads mid-scroll inside thinking,
  // hero's onProgress never ran, so seed the cell at default size here.
  orchestrator.onEnter('thinking', () => {
    webgl.shaderPlane.setCellGrow(1);
  });

  // CMS section labels override the hardcoded defaults when present (kept
  // index-aligned with SECTIONS so the timeline order stays intact).
  const cmsLabels = sanityContent?.sectionLabels;
  const sectionLabels = SECTIONS.map((s, i) => cmsLabels?.[i] ?? s.label);
  const hero     = mountHero({
    container: root, orchestrator, webgl, sectionLabels, content: sanityContent,
  });
  const thinking = mountThinking({ container: root, orchestrator, webgl, content: sanityContent });
  // DESIGN + CODE sections — one scroll-scrubbed image sequence (496 frames)
  // split at frame 160. Each mount preloads + scrubs only its own slice.
  const FRAME_BASE = { base: '/video/frames/frame_', pad: 4, ext: 'webp' };
  const video    = mountVideo({
    container: root,
    orchestrator,
    sectionId: 'video',
    frames: { ...FRAME_BASE, start: 1, end: 160 },
    title: sanityContent?.design?.title ?? 'Du chaos naît le produit',
    subtitle: sanityContent?.design?.subtitle ?? 'On juge une idée à ce qu\'elle transforme',
    services: sanityContent?.design?.services?.length ? sanityContent.design.services : DESIGN_SERVICES,
  });
  const code     = mountVideo({
    container: root,
    orchestrator,
    sectionId: 'code',
    frames: { ...FRAME_BASE, start: 161, end: 496 },
    title: sanityContent?.code?.title ?? 'Le produit prend vie.',
    subtitle: sanityContent?.code?.subtitle ?? 'Le go-live n\'est que le début.',
    services: sanityContent?.code?.services?.length ? sanityContent.code.services : CODE_SERVICES,
  });
  const clients  = mountClients({ container: root, orchestrator, content: sanityContent?.clients });
  const awards   = mountAwards({ container: root, webgl, content: sanityContent?.awards });
  const footer   = mountFooter({ container: root, content: sanityContent });
  preloader.to(0.8);

  // ── Lazy frame prefetch ──────────────────────────────────────────────────
  // The DESIGN + CODE image sequences total ~500 WebP frames. Loading them all
  // at boot is the dominant cause of slow first paint, so each slice only starts
  // downloading when the user is one section away: DESIGN's 160 frames on
  // entering THINKING, CODE's 336 frames on entering DESIGN. By the time either
  // scrubbed section is reached, its frames have had a full section of scroll to
  // arrive (and pick() degrades gracefully to the nearest loaded frame meanwhile).
  orchestrator.onEnter('thinking', () => video?.startPreload?.());
  orchestrator.onEnter('video',    () => code?.startPreload?.());

  // Section-label clicks navigate the page. Use a smooth, eased scroll (not an
  // instant jump) so the user sees the sections animate on the way there.
  hero?.timeline?.setScrollHandler((y) =>
    lenis.scrollTo(y, { duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3) }));

  // The timeline's active index is derived from scroll position below (single
  // source of truth) rather than from bouncy ScrollTrigger enter/leave edges.

  // ── Rainbow transition — driven by thinking's last quarter ─────────────────
  // Below PRISM_THRESHOLD: hero_grain @ uProgress=1 (cell + dots).
  // Above PRISM_THRESHOLD: prism shader animates so the colorful bg peaks just
  // before the user crosses into DESIGN (video.top), where it drops back to
  // the dark grain so the video plays over a clean backdrop.
  let prismActive = false;
  // Fade the orbital + service panel during the prism cross-fade. Each module
  // owns its own inline styles via these setters — no cross-module DOM poking.
  const setUIVisible = (visible) => {
    thinking?.orbital?.setOpacity(visible);
    thinking?.setServicesOpacity?.(visible);
  };

  // ── Explore-with-AI bar — visible on every section except hero and contact.
  // Shares the bottom-right panel with the service dropdowns but carries its own
  // `ai-on` class, so it persists across the middle sections while the dropdowns
  // stay BUILD-only. Each section's onEnter (fired in both scroll directions)
  // sets the state, so no separate onLeave bookkeeping is needed.
  const setAiVisible = (on) => thinking?.rightPanel?.classList.toggle('ai-on', on);
  ['thinking', 'video', 'code', 'clients', 'awards'].forEach((id) =>
    orchestrator.onEnter(id, () => setAiVisible(true)));
  ['hero', 'contact'].forEach((id) =>
    orchestrator.onEnter(id, () => setAiVisible(false)));

  orchestrator.onProgress('thinking', ({ progress }) => {
    if (progress >= PRISM_THRESHOLD) {
      const p = Math.min(1, (progress - PRISM_THRESHOLD) / (1 - PRISM_THRESHOLD));
      if (!prismActive) {
        webgl.shaderPlane.setShader('prism');
        prismActive = true;
      }
      // uProgress now drives ONLY the prism phase timeline; the cell's size is
      // owned by uCellGrow (continuous across the shader swap) so the cell
      // doesn't snap back to default when the bolt fires.
      webgl.shaderPlane.setProgress(p);
      setUIVisible(1 - p);
    } else if (prismActive) {
      webgl.shaderPlane.setShader('hero_grain');
      webgl.shaderPlane.setProgress(0);
      setUIVisible(1);
      prismActive = false;
    }
  });

  // ── Video — rainbow hand-off ───────────────────────────────────────────────
  // DESIGN is left transparent on top of the prism: thinking's onProgress takes
  // the prism to its peak (p=1) just before crossing into DESIGN, and that state
  // is intentionally not reset here so the colourful backdrop carries through
  // the section. Clients' onEnter takes over the next handoff to the awards
  // backdrop, so DESIGN itself has no shader handler.

  // ── Video + Clients — reveal stage when active ──────────────────────────
  const setActive = (id, on) => {
    const el = document.querySelector(`[data-section="${id}"]`);
    if (el) el.classList.toggle('is-visible', on);
  };

  // Video (DESIGN/CODE) inherits the prism backdrop from BUILD's tail. Coming
  // back up from clients, that handoff hasn't happened, so the shader is still
  // hero_grain — restore the rainbow here so the sections look the same in
  // either scroll direction.
  // DESIGN + CODE dropdowns share the thinking right-panel so they stack above
  // the persistent AI-links bar. Insert above the (now-idle) thinking services
  // so the active block always sits directly over the AI links. Only one block
  // carries `is-on` at a time (toggled per section enter/leave below).
  if (thinking?.rightPanel) {
    [code?.designServices, video?.designServices].forEach((el) => {
      if (el) thinking.rightPanel.insertBefore(el, thinking.rightPanel.firstChild);
    });
  }

  // DESIGN (frames 1-160) — prism backdrop, own title + dropdowns. No clients
  // preview here; that's handed off in CODE, the last frame-scrub section.
  orchestrator.onEnter('video', () => {
    setActive('video', true);
    video?.designServices?.classList.add('is-on');
    video?.titleHandle?.glitchIn(0.7);
    webgl.shaderPlane.setShader('prism');
    webgl.shaderPlane.setProgress(1);
    prismActive = true;
    setUIVisible(0);
  });
  orchestrator.onLeave('video', () => {
    setActive('video', false);
    video?.designServices?.classList.remove('is-on');
    video?.titleHandle?.glitchOut(0.4);
  });

  // CODE (frames 161-end) — keeps the prism backdrop, swaps in its own title +
  // dropdowns, and runs the clients far-preview so the CODE → clients boundary
  // reads as one continuous motion.
  orchestrator.onEnter('code', () => {
    setActive('code', true);
    code?.designServices?.classList.add('is-on');
    code?.titleHandle?.glitchIn(0.7);
    clients?.setPreview(true);
    webgl.shaderPlane.setShader('prism');
    webgl.shaderPlane.setProgress(1);
    prismActive = true;
    setUIVisible(0);
  });
  orchestrator.onLeave('code', ({ direction }) => {
    setActive('code', false);
    code?.designServices?.classList.remove('is-on');
    code?.titleHandle?.glitchOut(0.4);
    // Leaving UP (back toward DESIGN): tear down the clients preview. Leaving
    // DOWN (into clients): keep it — clients.onEnter takes over the same visible
    // stack at scrollProgress 0, so the handoff stays seamless.
    if (direction === 'up') clients?.setPreview(false);
  });
  // Across the LAST THIRD of the CODE scroll, glide the clients stack from its
  // parked pre-roll position down into frame. CODE progress 1.0 coincides with
  // clients' onEnter at scrollProgress 0, so the cards land exactly where the
  // clients scroll begins — the section boundary reads as one continuous motion.
  orchestrator.onProgress('code', ({ progress }) => {
    clients?.setPreviewProgress((progress - 0.88) / 0.12);
  });

  // Frame-44 magnet — softly settle the DESIGN scrub onto a key frame when the
  // user stops scrolling near it (from either direction). The DESIGN trigger's
  // progress 0→1 maps to frame index 0→159 (frames 1-160), so frame 44 lives at
  // (44-1)/(160-1). We only snap on scroll-settle (a short quiet window after
  // the last scroll event), never mid-scroll, so it reads as a gentle magnet
  // rather than a sticky wall. Skipped under reduced-motion.
  if (!prefersReducedMotion()) {
    const MAGNET_PROGRESS = (44 - 1) / (160 - 1); // ≈ 0.270
    const MAGNET_WINDOW   = 22 / (160 - 1);       // ± ~22 frames of capture range
    const SETTLE_MS       = 140;                  // quiet time that counts as "stopped"
    let settleTimer = 0;
    let snapping = false;

    const tryMagnet = () => {
      const st = orchestrator.getTrigger('video');
      if (!st) return;
      if (Math.abs(st.progress - MAGNET_PROGRESS) > MAGNET_WINDOW) return;
      const targetY = st.start + (st.end - st.start) * MAGNET_PROGRESS;
      if (Math.abs(window.scrollY - targetY) < 2) return;
      snapping = true;
      lenis.scrollTo(targetY, {
        duration: 0.6,
        easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic
        onComplete: () => { snapping = false; },
      });
      // Fallback release in case the glide is interrupted before completing.
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { snapping = false; }, 800);
    };

    lenis.on('scroll', () => {
      if (snapping) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(tryMagnet, SETTLE_MS);
    });
  }

  // Clients enter: drop the rainbow prism (carried over from DESIGN) back to
  // the dark hero_grain so the cards read crisp on a calm backdrop. This is the
  // first half of the clients→awards transition; the second half is the card
  // glow warming to gold across the last quarter of the clients scroll (see
  // clients/index.js — driven by scrollProgress via --clients-warmth).
  orchestrator.onEnter('clients', () => {
    clients?.setActive(true);
    // Park the awards trophy cloud far in the background so it reads as distant
    // specks behind the cards — the clients → awards reveal then plays as the
    // cloud flying in from depth instead of popping into being.
    awards?.setFarPreview(true);
    webgl.shaderPlane.setShader('hero_grain');
    webgl.shaderPlane.setProgress(0);
    // Cell is invisible on the clients backdrop — uCellGrow=0 collapses it.
    webgl.shaderPlane.setCellGrow(0);
    prismActive = false;
  });
  orchestrator.onLeave('clients', ({ direction }) => {
    clients?.setActive(false);
    // Leaving UP (back toward video): tear down the far preview. Leaving DOWN
    // (into awards): keep the cloud — awards.onEnter takes over the same visible
    // cloud and glides it in, so the handoff stays seamless.
    if (direction === 'up') awards?.setFarPreview(false);
  });
  // Across the LAST THIRD of the clients scroll, glide the awards cloud forward
  // from its deep preview depth to FAR_Z so the trophies are already visibly
  // approaching as clients ends. clients progress 1.0 coincides with awards'
  // onEnter, so the cloud lands at FAR_Z exactly where the awards scroll-approach
  // begins — the section boundary reads as one continuous motion, no jump.
  orchestrator.onProgress('clients', ({ progress }) => {
    awards?.setPreviewApproach((progress - 0.66) / 0.34);
  });

  // Awards — swap to the `awards` shader: the exact same charcoal backdrop as
  // the clients section (awardsBackdrop, cell hidden, plus the body-level
  // #noise overlay which stays visible here too), with one addition — a soft
  // gold halo that follows the cursor. The backdrop base is identical to
  // hero_grain, so the swap is invisible aside from the halo.
  const haloFade = { v: 0 };
  orchestrator.onEnter('awards', ({ direction }) => {
    awards?.setActive(true, direction);
    // Fresh downward entry: reset scroll-driven depth so the cloud always
    // enters from FAR_Z and zooms in across the section's first half. On
    // reverse entry (scrolling back up from contact) skip the reset so the
    // trophies glide back from where they exited instead of snapping far.
    if (direction === 'down') awards?.setScrollProgress(0);
    webgl.shaderPlane.setShader('awards');
    webgl.shaderPlane.setCellGrow(0);
    document.body.classList.add('is-awards');
    // Gold cursor halo (awards.glsl multiplies it by uProgress): fade it in on
    // desktop, but keep it off on touch devices — there's no cursor to track,
    // so the glow would just sit frozen wherever the last tap landed.
    gsap.killTweensOf(haloFade);
    if (window.matchMedia('(hover: none)').matches) {
      haloFade.v = 0;
      webgl.shaderPlane.setProgress(0);
    } else {
      haloFade.v = 0;
      webgl.shaderPlane.setProgress(0);
      gsap.to(haloFade, {
        v: 1,
        duration: 0.9,
        ease: 'power2.out',
        onUpdate: () => webgl.shaderPlane.setProgress(haloFade.v),
      });
    }
  });
  orchestrator.onProgress('awards', ({ progress }) => {
    awards?.setScrollProgress(progress);
  });
  // Restore the plain hero_grain backdrop on leave so neither clients (up) nor
  // contact (down) inherits the awards gold halo. Clients.onEnter also sets
  // hero_grain, but contact has no shader handler and relies on this reset.
  orchestrator.onLeave('awards', () => {
    awards?.setActive(false);
    gsap.killTweensOf(haloFade);
    webgl.shaderPlane.setShader('hero_grain');
    webgl.shaderPlane.setProgress(0);
    document.body.classList.remove('is-awards');
  });

  // Contact — terminal section. Reveal the stage and run the title's font-glitch
  // once on first enter. The WebGL backdrop is left to awards' leave handoff (it
  // settles on the dark hero_grain), so the white email reads over the kept bg.
  // Clearing `is-leaving` on enter resets any exit transform left over from the
  // seamless loop (see scroll handler below) so the email/AI bar fade back in.
  //
  // `body.is-contact` neutralises the awards stage for the whole contact
  // section: awards's `top top → bottom top` trigger ends ~1500px AFTER contact
  // begins, so its body-level stage (z 9995, pointer-events:auto when visible)
  // would stay on top through the overlap and swallow clicks on the contact
  // AI bar. The CSS rule pins awards opacity 0 / pointer-events none across
  // the entire contact range — including the awkward upward path where
  // awards.onEnterBack would otherwise re-activate it while contact is still
  // the visible section. Cleared on leave.
  orchestrator.onEnter('contact', () => {
    document.querySelector('.footer__stage')?.classList.remove('is-leaving');
    setActive('contact', true);
    footer?.setActive(true);
    document.body.classList.add('is-contact');
    document.body.classList.remove('is-awards');
  });
  orchestrator.onLeave('contact', () => {
    setActive('contact', false);
    footer?.setActive(false);
    document.body.classList.remove('is-contact');
  });

  // ── Pause offscreen per-frame work ───────────────────────────────────────
  // The face pack only matters while hero is on screen; stop ticking it once
  // it has exploded away (re-arms when scrolling back up into hero).
  orchestrator.onEnter('hero', () => hero?.facePack?.setActive(true));
  // Only deactivate when leaving DOWNWARD (past the bottom of hero) — setActive
  // (false) snaps the pack to its post-dive (off-screen) pose so it doesn't
  // cover the next section. Leaving BACK UP happens at the very top (scroll 0)
  // where the pack should stay at rest and visible, so skip the snap there.
  orchestrator.onLeave('hero', ({ direction }) => {
    if (direction === 'down') hero?.facePack?.setActive(false);
  });

  orchestrator.refresh();

  // Render last on the shared gsap.ticker — after every section's transform
  // callback above has updated its meshes for this frame.
  webgl.startRenderLoop();

  // ── Dismiss the boot overlay ───────────────────────────────────────────────
  // Wait for the webfonts (so the hero title doesn't pop in after reveal) and a
  // couple of frames (so the first WebGL render lands behind the overlay), then
  // glitch the preloader out and hand scroll control back. document.fonts.ready
  // is raced with a timeout so a stalled font load can't trap the visitor here.
  const fontsReady = Promise.race([
    document.fonts?.ready ?? Promise.resolve(),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
  fontsReady.then(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      preloader.finish(() => lenis.start());
    }));
  });

  // Drive the timeline ruler with Lenis's smoothed scroll position. The ruler
  // derives its own current/prev/next labels from this scroll value, so no
  // separate active-index tracking is needed here.
  //
  // Seamless loop: once the user scrolls past the bottom of the contact section,
  // glitch the contact email out, jump scroll back to the top, reform the
  // facepack and glitch the hero title back in. Reads as one continuous loop.
  //
  // Sequence:
  //   1. add `.is-leaving` → email lifts up + AI bar drops down, both fade out
  //      (footer.css, ~700ms). Also fire a one-shot all-letter glitch burst on
  //      the email so it visibly *glitches out* before the fade completes.
  //   2. instantly reset Lenis to scroll=0 (no smoothing — the user mustn't see
  //      the scroll position rewind)
  //   3. fire facePack.playEntry() so the fragments re-converge into the resting
  //      face, and replay hero?.title?.replay() so the intro flicker fires again
  //   4. `.is-leaving` is cleared by contact's onEnter handler the next time
  //      the user scrolls into contact
  //
  // Calling lenis.scrollTo synchronously from inside a scroll handler re-enters
  // Lenis's internal state machine and locks the rAF loop, so the reset runs
  // from setTimeout after the current event has drained.
  const LOOP_EXIT_MS = 720;
  let loopGuard = false;
  lenis.on('scroll', ({ scroll, limit }) => {
    hero?.timeline?.update(scroll);

    if (loopGuard || !(limit > 0)) return;
    if (scroll >= limit - 1) {
      loopGuard = true;
      const stage = document.querySelector('.footer__stage');
      stage?.classList.add('is-leaving');
      // Same exit-glitch as the section's leave path so the loop wrap reads
      // as "title shatters → page resets" instead of a one-frame burst.
      footer?.title?.glitchOut?.(0.45);
      setTimeout(() => {
        lenis.scrollTo(0, { immediate: true, force: true, lock: false });
        // Reform the facepack from a mid-explosion state and re-fire the hero
        // title intro flicker. Use replay() not play() — the initial mount call
        // sets running=true for ~5s and play() is a no-op while running.
        // setActive(true) explicitly — ScrollTrigger's enter event for hero
        // can miss the instant scroll reset, leaving the per-frame transform
        // loop off so the pack stays frozen at its post-explosion state
        // (invisible) until the user's first wheel tick fires hero.onEnter.
        hero?.facePack?.setActive?.(true);
        hero?.facePack?.playEntry?.();
        // Reset the cell to the start of hero so the entry tween + emerging
        // cell read like the page is being booted fresh.
        webgl.shaderPlane.setShader('hero_grain');
        webgl.shaderPlane.setProgress(0);
        webgl.shaderPlane.setCellGrow(0);
        hero?.title?.replay();
        requestAnimationFrame(() => { loopGuard = false; });
      }, LOOP_EXIT_MS);
    }
  });

  window.__niji = { lenis, webgl, orchestrator, hero, thinking, video, code, clients, awards, footer };
}

boot();
