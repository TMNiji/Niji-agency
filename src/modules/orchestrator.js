// ScrollOrchestrator — one ScrollTrigger per section, with enter/leave/progress hooks.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Creates one ScrollTrigger per section and exposes a callback registry so
 * each section module can subscribe to enter/leave/progress without ever
 * creating its own ScrollTrigger instance — guaranteeing a single, coherent
 * scroll graph that ScrollTrigger.refresh() can manage as a unit.
 *
 * Usage from a section module:
 *   orchestrator.onEnter('about',    ({ section, direction }) => {...})
 *   orchestrator.onLeave('about',    ({ section, direction }) => {...})
 *   orchestrator.onProgress('about', ({ progress, section })  => {...})
 */
export function createOrchestrator({ sections } = {}) {
  const callbacks = new Map(); // id → { enter:[], leave:[], progress:[] }
  const triggers = new Map();

  const ensure = (id) => {
    if (!callbacks.has(id)) {
      callbacks.set(id, { enter: [], leave: [], progress: [] });
    }
    return callbacks.get(id);
  };

  const emit = (id, channel, payload) => {
    const bucket = callbacks.get(id);
    if (!bucket) return;
    for (const fn of bucket[channel]) fn(payload);
  };

  const buildTrigger = (section) => {
    const el = document.querySelector(`[data-section="${section.id}"]`);
    if (!el) {
      console.warn(`[Orchestrator] No DOM node for section "${section.id}"`);
      return null;
    }
    // Per-section trigger override — sticky sections want 'top top' (start when
    // section pins to viewport) instead of the default 'top bottom' which
    // measures section entry from the viewport bottom.
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: section.triggerStart ?? 'top bottom',
      end: section.triggerEnd ?? 'bottom top',
      onEnter: () => emit(section.id, 'enter', { section, direction: 'down' }),
      onLeave: () => emit(section.id, 'leave', { section, direction: 'down' }),
      onEnterBack: () => emit(section.id, 'enter', { section, direction: 'up' }),
      onLeaveBack: () => emit(section.id, 'leave', { section, direction: 'up' }),
      onUpdate: (self) =>
        emit(section.id, 'progress', { progress: self.progress, section }),
    });
    triggers.set(section.id, trigger);
    return trigger;
  };

  for (const section of sections) {
    ensure(section.id);
    buildTrigger(section);
  }

  // Layout may shift after fonts load / images decode — refresh once settled.
  if (document.readyState === 'complete') {
    ScrollTrigger.refresh();
  } else {
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }

  return {
    onEnter(id, fn) { ensure(id).enter.push(fn); },
    onLeave(id, fn) { ensure(id).leave.push(fn); },
    onProgress(id, fn) { ensure(id).progress.push(fn); },
    refresh() { ScrollTrigger.refresh(); },
    getTrigger(id) { return triggers.get(id); },
    destroy() {
      triggers.forEach((t) => t.kill());
      triggers.clear();
      callbacks.clear();
    },
  };
}
