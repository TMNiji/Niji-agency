// Shared "Explore with AI" bar — used by the thinking right-panel and by the
// contact section. createAiLinks() builds the DOM; the LOGOS map + defaults are
// shared so adding/renaming a provider in one place updates every consumer.

import { getLang } from '@/lib/lang.js';

const LOGOS = {
  claude: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>`,
  gpt:    `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>`,
  perplexity: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z"/></svg>`,
};

// Map button label (lowercase) → logo key.
const LOGO_MAP = {
  claude: 'claude',
  gpt: 'gpt',
  chatgpt: 'gpt',
  perplexity: 'perplexity',
};

// Reference page hosted on this site (see public/llm/index.html). The prompt
// cites it as context so the LLM pulls from it without an explicit "use this
// source" instruction — see docs/llm/niji-llm-prompt.md for the editorial notes.
const PAGE_URL = 'https://niji.agency/llm';

// FR / EN prompt. The SITE language (the URL opened) picks the variant, so the
// prompt always matches the page the visitor is reading.
const PROMPTS = {
  fr: `J'aimerais comprendre ce qu'est Niji et ce qu'ils font. Selon leur site (${PAGE_URL}), il semble que ce soit une agence française de product design AI-native qui travaille avec des marques comme Lacoste, Relais & Châteaux, Orange et BNP Paribas. Ils ont remporté des Lovie et Webby Awards. Résume leurs capacités, leurs réalisations notables et ce qui les distingue.`,
  en: `I want to understand what Niji is and what they do. According to their site (${PAGE_URL}), they seem to be a French AI-native product design agency working with brands like Lacoste, Relais & Châteaux, Orange and BNP Paribas. They have won Lovie and Webby Awards. Summarise their capabilities, notable work, and what makes them different.`,
  es: `Me gustaría entender qué es Niji y qué hacen. Según su sitio (${PAGE_URL}), parece ser una agencia francesa de product design IA-nativa que trabaja con marcas como Lacoste, Relais & Châteaux, Orange y BNP Paribas. Han ganado premios Lovie y Webby. Resume sus capacidades, sus trabajos destacados y lo que los diferencia.`,
};

const ACTIVE_LANG = getLang();
const NIJI_PROMPT = PROMPTS[ACTIVE_LANG];

// On touch devices (iOS/Android) we navigate in the same tab rather than
// target=_blank: a clean top-level navigation lets the OS hand off the https
// link to the installed Claude/GPT/Perplexity app via Universal Links / App
// Links (which carry the ?q= prompt). A new tab can break that hand-off.
const IS_TOUCH =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// Per-provider chat endpoints — the URL-encoded prompt is appended as ?q=.
const ENDPOINTS = {
  Claude:     'https://claude.ai/new?q=',
  GPT:        'https://chatgpt.com/?q=',
  Perplexity: 'https://www.perplexity.ai/search?q=',
};

const LABELS = { fr: 'Des questions ?', en: 'Any questions?', es: '¿Preguntas?' };

// Toast copy follows the visitor's language, like the bar label + prompt above.
const TOASTS = {
  fr: {
    copied:   (name) => `Prompt copié — ouverture de ${name}. Si le chat est vide, collez avec ⌘V / Ctrl+V.`,
    opening:  (name) => `Ouverture de ${name} avec le prompt pré-rempli.`,
  },
  en: {
    copied:   (name) => `Prompt copied — opening ${name}. If the chat is empty, paste with ⌘V / Ctrl+V.`,
    opening:  (name) => `Opening ${name} with the prompt pre-filled.`,
  },
  es: {
    copied:   (name) => `Prompt copiado — abriendo ${name}. Si el chat está vacío, pega con ⌘V / Ctrl+V.`,
    opening:  (name) => `Abriendo ${name} con el prompt rellenado.`,
  },
};
const TOAST = TOASTS[ACTIVE_LANG];

export const DEFAULT_AI_LINKS = {
  label: LABELS[ACTIVE_LANG],
  buttons: Object.entries(ENDPOINTS).map(([label, endpoint]) => ({
    label,
    url: `${endpoint}${encodeURIComponent(NIJI_PROMPT)}`,
  })),
};

// Copy the prompt to the clipboard as a fallback: the anchor's ?q= param
// pre-fills the chat, but some platforms ignore it — a clipboard copy lets the
// user paste manually. Returns true on success.
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) { /* fall through to legacy path */ }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

let toastTimer = null;
function showToast(message) {
  let toast = document.querySelector('.niji-ai-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'niji-ai-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  // Force reflow so the transition runs even when re-using the element.
  void toast.offsetWidth;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4000);
}

// The prompt to copy lives in the anchor's ?q= param, so this works for both
// the default buttons and any Sanity-driven ones.
function promptFromHref(href) {
  try {
    return new URL(href).searchParams.get('q') ?? NIJI_PROMPT;
  } catch (_) {
    return NIJI_PROMPT;
  }
}

function safeExternalUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch (_) {
    return null;
  }
}

/**
 * Build the "Explore with AI" bar (label + provider icon buttons).
 *
 * The container uses `baseClass` so layout/opacity can be themed per consumer
 * (right-panel vs contact stage). Individual buttons always use the
 * `thinking__ai-btn` style primitive so the icon chrome is shared everywhere.
 *
 * @param {Object} opts
 * @param {{label:string, buttons:Array<{label:string,url:string}>}} [opts.data]
 *   AI-links payload. Falls back to DEFAULT_AI_LINKS.
 * @param {string} [opts.baseClass='thinking__ai-links'] BEM block for the
 *   container. Label/buttons containers derive from it (suffix -label / -buttons).
 * @param {boolean} [opts.showLabel=true] Render the text label above the
 *   buttons. The contact section hides it (the headline already asks the question).
 * @returns {{ el: HTMLElement }}
 */
export function createAiLinks({ data = DEFAULT_AI_LINKS, baseClass = 'thinking__ai-links', showLabel = true } = {}) {
  const root = document.createElement('div');
  root.className = baseClass;

  if (showLabel) {
    const label = document.createElement('span');
    label.className = `${baseClass}-label`;
    label.textContent = data.label;
    root.appendChild(label);
  }

  const buttons = document.createElement('div');
  buttons.className = `${baseClass}-buttons`;
  root.appendChild(buttons);

  (data.buttons ?? []).forEach((b) => {
    const href = safeExternalUrl(b?.url);
    if (!href) return;

    const text = b.label ?? 'AI link';
    const btn  = document.createElement('a');
    btn.className = 'thinking__ai-btn';
    btn.href = href;
    // Desktop: new tab so the Niji page stays open. Touch: same-tab navigation
    // so the OS can hand the link off to the installed app (see IS_TOUCH).
    if (!IS_TOUCH) {
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
    }
    btn.setAttribute('aria-label', text);

    const key = LOGO_MAP[text.toLowerCase()] ?? null;
    if (key && LOGOS[key]) {
      btn.innerHTML = LOGOS[key];
    } else {
      const t = document.createElement('span');
      t.className = 'thinking__ai-btn-text';
      t.textContent = text;
      btn.appendChild(t);
    }

    // Let the anchor open the chat (target=_blank); on top of that, copy the
    // prompt to the clipboard and confirm with a toast so the user can paste if
    // the platform drops the ?q= param.
    btn.addEventListener('click', async () => {
      const copied = await copyToClipboard(promptFromHref(href));
      showToast(copied ? TOAST.copied(text) : TOAST.opening(text));
    });

    buttons.appendChild(btn);
  });

  return { el: root };
}
