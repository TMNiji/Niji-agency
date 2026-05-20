// Lenis smooth scroll bridged to GSAP ticker — the single source of scroll truth.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance = null;

export function initScroll() {
  if (lenisInstance) return lenisInstance;

  lenisInstance = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 1,
    touchMultiplier: 1.5,
  });

  // Lenis writes to window.scroll → ScrollTrigger reads native scroll.
  // The bridge below ensures both run on the SAME rAF tick → no jank, no
  // double-scroll artifacts, no dual frame loops fighting each other.
  lenisInstance.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    // GSAP ticker time is in seconds; Lenis.raf expects milliseconds.
    lenisInstance.raf(time * 1000);
  });

  // Disable GSAP's lag smoothing — we manage frame timing through Lenis.
  gsap.ticker.lagSmoothing(0);

  return lenisInstance;
}

export function getLenis() {
  return lenisInstance;
}

export function scrollTo(target, options = {}) {
  if (!lenisInstance) return;
  lenisInstance.scrollTo(target, options);
}

export function stopScroll() {
  lenisInstance?.stop();
}

export function startScroll() {
  lenisInstance?.start();
}
