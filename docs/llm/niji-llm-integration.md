# Niji - Intégration boutons LLM

Document de référence pour intégrer les trois boutons LLM (Claude, ChatGPT, Perplexity) sur le site niji.agency. Auto-détection de la langue système du visiteur. URLs prêtes à copier-coller.

---

## Page de référence

URL hébergée : `https://niji.agency/llm`

À remplacer dans tous les snippets ci-dessous si le chemin diffère lors du déploiement.

---

## Prompt envoyé au LLM

### Version française (auto si `navigator.language` commence par `fr`)

```
J'aimerais comprendre ce qu'est Niji et ce qu'ils font. Selon leur site (https://niji.agency/llm), il semble que ce soit une agence française de product design AI-native qui travaille avec des marques comme Lacoste, Relais & Châteaux, Orange et BNP Paribas. Ils ont remporté des Lovie et Webby Awards. Résume leurs capacités, leurs réalisations notables et ce qui les distingue.
```

### Version anglaise (auto pour toutes les autres langues)

```
I want to understand what Niji is and what they do. According to their site (https://niji.agency/llm), they seem to be a French AI-native product design agency working with brands like Lacoste, Relais & Châteaux, Orange and BNP Paribas. They have won Lovie and Webby Awards. Summarise their capabilities, notable work, and what makes them different.
```

---

## Méthode 1 : Recommandée. Script unique + 3 boutons.

Une seule source de vérité, un seul endroit où modifier le prompt ou la page de référence. À privilégier sur niji.agency.

### Étape 1. HTML des trois boutons

```html
<div class="niji-llm-buttons">
  <p data-niji-i18n="intro">Des questions ? Demandez à</p>
  <button type="button" data-niji-llm="claude">Claude</button>
  <button type="button" data-niji-llm="chatgpt">ChatGPT</button>
  <button type="button" data-niji-llm="perplexity">Perplexity</button>
</div>
```

### Étape 2. Script JS (une seule fois sur la page)

```html
<script>
(function() {
  var PAGE_URL = "https://niji.agency/llm";
  var PROMPTS = {
    fr: "J'aimerais comprendre ce qu'est Niji et ce qu'ils font. Selon leur site (" + PAGE_URL + "), il semble que ce soit une agence française de product design AI-native qui travaille avec des marques comme Lacoste, Relais & Châteaux, Orange et BNP Paribas. Ils ont remporté des Lovie et Webby Awards. Résume leurs capacités, leurs réalisations notables et ce qui les distingue.",
    en: "I want to understand what Niji is and what they do. According to their site (" + PAGE_URL + "), they seem to be a French AI-native product design agency working with brands like Lacoste, Relais & Châteaux, Orange and BNP Paribas. They have won Lovie and Webby Awards. Summarise their capabilities, notable work, and what makes them different."
  };
  var LABELS = {
    fr: { intro: "Des questions ? Demandez à" },
    en: { intro: "Got questions? Ask" }
  };
  var ENDPOINTS = {
    claude:     "https://claude.ai/new?q=",
    chatgpt:    "https://chatgpt.com/?q=",
    perplexity: "https://www.perplexity.ai/search?q="
  };
  var lang = (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";

  document.querySelectorAll("[data-niji-i18n]").forEach(function(el) {
    var key = el.dataset.nijiI18n;
    if (LABELS[lang][key]) el.textContent = LABELS[lang][key];
  });

  document.querySelectorAll("[data-niji-llm]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      var llm = btn.dataset.nijiLlm;
      var endpoint = ENDPOINTS[llm];
      if (!endpoint) return;
      var encoded = encodeURIComponent(PROMPTS[lang]);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(PROMPTS[lang]).catch(function() {});
      }
      window.open(endpoint + encoded, "_blank", "noopener,noreferrer");
    });
  });
})();
</script>
```

Le script détecte la langue, traduit le label intro, attache les handlers de clic. Au clic : copie dans le presse-papier en silence, ouverture du LLM dans un nouvel onglet avec le prompt pré-rempli.

---

## Méthode 2 : URLs statiques en backup

À utiliser si l'auto-détection JS n'est pas possible (CMS limité, intégration sans JS). On force la langue côté code.

### Version française

```
Claude     : https://claude.ai/new?q=J%27aimerais%20comprendre%20ce%20qu%27est%20Niji%20et%20ce%20qu%27ils%20font.%20Selon%20leur%20site%20%28https%3A//niji.agency/llm%29%2C%20il%20semble%20que%20ce%20soit%20une%20agence%20fran%C3%A7aise%20de%20product%20design%20AI-native%20qui%20travaille%20avec%20des%20marques%20comme%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20et%20BNP%20Paribas.%20Ils%20ont%20remport%C3%A9%20des%20Lovie%20et%20Webby%20Awards.%20R%C3%A9sume%20leurs%20capacit%C3%A9s%2C%20leurs%20r%C3%A9alisations%20notables%20et%20ce%20qui%20les%20distingue.

ChatGPT    : https://chatgpt.com/?q=J%27aimerais%20comprendre%20ce%20qu%27est%20Niji%20et%20ce%20qu%27ils%20font.%20Selon%20leur%20site%20%28https%3A//niji.agency/llm%29%2C%20il%20semble%20que%20ce%20soit%20une%20agence%20fran%C3%A7aise%20de%20product%20design%20AI-native%20qui%20travaille%20avec%20des%20marques%20comme%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20et%20BNP%20Paribas.%20Ils%20ont%20remport%C3%A9%20des%20Lovie%20et%20Webby%20Awards.%20R%C3%A9sume%20leurs%20capacit%C3%A9s%2C%20leurs%20r%C3%A9alisations%20notables%20et%20ce%20qui%20les%20distingue.

Perplexity : https://www.perplexity.ai/search?q=J%27aimerais%20comprendre%20ce%20qu%27est%20Niji%20et%20ce%20qu%27ils%20font.%20Selon%20leur%20site%20%28https%3A//niji.agency/llm%29%2C%20il%20semble%20que%20ce%20soit%20une%20agence%20fran%C3%A7aise%20de%20product%20design%20AI-native%20qui%20travaille%20avec%20des%20marques%20comme%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20et%20BNP%20Paribas.%20Ils%20ont%20remport%C3%A9%20des%20Lovie%20et%20Webby%20Awards.%20R%C3%A9sume%20leurs%20capacit%C3%A9s%2C%20leurs%20r%C3%A9alisations%20notables%20et%20ce%20qui%20les%20distingue.
```

### Version anglaise

```
Claude     : https://claude.ai/new?q=I%20want%20to%20understand%20what%20Niji%20is%20and%20what%20they%20do.%20According%20to%20their%20site%20%28https%3A//niji.agency/llm%29%2C%20they%20seem%20to%20be%20a%20French%20AI-native%20product%20design%20agency%20working%20with%20brands%20like%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20and%20BNP%20Paribas.%20They%20have%20won%20Lovie%20and%20Webby%20Awards.%20Summarise%20their%20capabilities%2C%20notable%20work%2C%20and%20what%20makes%20them%20different.

ChatGPT    : https://chatgpt.com/?q=I%20want%20to%20understand%20what%20Niji%20is%20and%20what%20they%20do.%20According%20to%20their%20site%20%28https%3A//niji.agency/llm%29%2C%20they%20seem%20to%20be%20a%20French%20AI-native%20product%20design%20agency%20working%20with%20brands%20like%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20and%20BNP%20Paribas.%20They%20have%20won%20Lovie%20and%20Webby%20Awards.%20Summarise%20their%20capabilities%2C%20notable%20work%2C%20and%20what%20makes%20them%20different.

Perplexity : https://www.perplexity.ai/search?q=I%20want%20to%20understand%20what%20Niji%20is%20and%20what%20they%20do.%20According%20to%20their%20site%20%28https%3A//niji.agency/llm%29%2C%20they%20seem%20to%20be%20a%20French%20AI-native%20product%20design%20agency%20working%20with%20brands%20like%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20and%20BNP%20Paribas.%20They%20have%20won%20Lovie%20and%20Webby%20Awards.%20Summarise%20their%20capabilities%2C%20notable%20work%2C%20and%20what%20makes%20them%20different.
```

### Code HTML correspondant

#### Boutons FR

```html
<a href="https://claude.ai/new?q=J%27aimerais%20comprendre%20ce%20qu%27est%20Niji%20et%20ce%20qu%27ils%20font.%20Selon%20leur%20site%20%28https%3A//niji.agency/llm%29%2C%20il%20semble%20que%20ce%20soit%20une%20agence%20fran%C3%A7aise%20de%20product%20design%20AI-native%20qui%20travaille%20avec%20des%20marques%20comme%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20et%20BNP%20Paribas.%20Ils%20ont%20remport%C3%A9%20des%20Lovie%20et%20Webby%20Awards.%20R%C3%A9sume%20leurs%20capacit%C3%A9s%2C%20leurs%20r%C3%A9alisations%20notables%20et%20ce%20qui%20les%20distingue." target="_blank" rel="noopener noreferrer">Demander à Claude</a>
<a href="https://chatgpt.com/?q=J%27aimerais%20comprendre%20ce%20qu%27est%20Niji%20et%20ce%20qu%27ils%20font.%20Selon%20leur%20site%20%28https%3A//niji.agency/llm%29%2C%20il%20semble%20que%20ce%20soit%20une%20agence%20fran%C3%A7aise%20de%20product%20design%20AI-native%20qui%20travaille%20avec%20des%20marques%20comme%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20et%20BNP%20Paribas.%20Ils%20ont%20remport%C3%A9%20des%20Lovie%20et%20Webby%20Awards.%20R%C3%A9sume%20leurs%20capacit%C3%A9s%2C%20leurs%20r%C3%A9alisations%20notables%20et%20ce%20qui%20les%20distingue." target="_blank" rel="noopener noreferrer">Demander à ChatGPT</a>
<a href="https://www.perplexity.ai/search?q=J%27aimerais%20comprendre%20ce%20qu%27est%20Niji%20et%20ce%20qu%27ils%20font.%20Selon%20leur%20site%20%28https%3A//niji.agency/llm%29%2C%20il%20semble%20que%20ce%20soit%20une%20agence%20fran%C3%A7aise%20de%20product%20design%20AI-native%20qui%20travaille%20avec%20des%20marques%20comme%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20et%20BNP%20Paribas.%20Ils%20ont%20remport%C3%A9%20des%20Lovie%20et%20Webby%20Awards.%20R%C3%A9sume%20leurs%20capacit%C3%A9s%2C%20leurs%20r%C3%A9alisations%20notables%20et%20ce%20qui%20les%20distingue." target="_blank" rel="noopener noreferrer">Demander à Perplexity</a>
```

#### Boutons EN

```html
<a href="https://claude.ai/new?q=I%20want%20to%20understand%20what%20Niji%20is%20and%20what%20they%20do.%20According%20to%20their%20site%20%28https%3A//niji.agency/llm%29%2C%20they%20seem%20to%20be%20a%20French%20AI-native%20product%20design%20agency%20working%20with%20brands%20like%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20and%20BNP%20Paribas.%20They%20have%20won%20Lovie%20and%20Webby%20Awards.%20Summarise%20their%20capabilities%2C%20notable%20work%2C%20and%20what%20makes%20them%20different." target="_blank" rel="noopener noreferrer">Ask Claude</a>
<a href="https://chatgpt.com/?q=I%20want%20to%20understand%20what%20Niji%20is%20and%20what%20they%20do.%20According%20to%20their%20site%20%28https%3A//niji.agency/llm%29%2C%20they%20seem%20to%20be%20a%20French%20AI-native%20product%20design%20agency%20working%20with%20brands%20like%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20and%20BNP%20Paribas.%20They%20have%20won%20Lovie%20and%20Webby%20Awards.%20Summarise%20their%20capabilities%2C%20notable%20work%2C%20and%20what%20makes%20them%20different." target="_blank" rel="noopener noreferrer">Ask ChatGPT</a>
<a href="https://www.perplexity.ai/search?q=I%20want%20to%20understand%20what%20Niji%20is%20and%20what%20they%20do.%20According%20to%20their%20site%20%28https%3A//niji.agency/llm%29%2C%20they%20seem%20to%20be%20a%20French%20AI-native%20product%20design%20agency%20working%20with%20brands%20like%20Lacoste%2C%20Relais%20%26%20Ch%C3%A2teaux%2C%20Orange%20and%20BNP%20Paribas.%20They%20have%20won%20Lovie%20and%20Webby%20Awards.%20Summarise%20their%20capabilities%2C%20notable%20work%2C%20and%20what%20makes%20them%20different." target="_blank" rel="noopener noreferrer">Ask Perplexity</a>
```

---

## Notes techniques

- `navigator.language` peut renvoyer `fr`, `fr-FR`, `fr-CA`, `fr-BE`, etc. Le test `.startsWith("fr")` couvre toutes les variantes francophones.
- Le paramètre `?q=` est interprété comme prompt initial sur les trois plateformes. À tester après chaque mise à jour majeure des éditeurs (Anthropic, OpenAI, Perplexity) car ce comportement n'est pas garanti contractuellement.
- Le presse-papier (`navigator.clipboard.writeText`) ne fonctionne qu'en contexte sécurisé (HTTPS ou localhost). Sur HTTP, la copie échoue silencieusement, mais l'ouverture du LLM avec pré-remplissage URL reste opérationnelle.
- Pour le déploiement final, vérifier que les URLs encodées passent intactes à travers le CMS ou le framework utilisé (Next.js, Webflow, WordPress, etc.). Certains systèmes ré-encodent automatiquement, ce qui peut casser les liens.
