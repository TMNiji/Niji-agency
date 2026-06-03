# Prompt Niji LLM

Texte envoyé aux trois plateformes (Claude, ChatGPT, Perplexity) au clic sur les boutons du site.

---

## Version française (défaut)

```
J'aimerais comprendre ce qu'est Niji et ce qu'ils font. Il semble que ce soit une agence française de product design AI-native qui travaille avec des marques comme Lacoste, Relais & Châteaux, Orange et BNP Paribas. Ils ont remporté des Lovie et Webby Awards. Résume leurs capacités, leurs réalisations notables et ce qui les distingue : https://niji.fr/llm
```

---

## Version anglaise

```
I want to understand what Niji is and what they do. They seem to be a French AI-native product design agency working with brands like Lacoste, Relais & Châteaux, Orange and BNP Paribas. They have won Lovie and Webby Awards. Summarise their capabilities, notable work, and what makes them different: https://niji.fr/llm
```

---

## Variable à remplacer

`https://niji.fr/llm` : URL réelle où sera hébergée la page de référence Niji. À substituer dans les deux versions au moment du déploiement.

---

## Notes sur le ton

Le prompt est construit pour donner l'impression d'une question naturelle d'un utilisateur curieux, pas d'une instruction technique. Trois choix éditoriaux :

1. **Hypothèses formulées** ("il semble que...") plutôt qu'affirmations. L'utilisateur a l'air de chercher confirmation.
2. **Marqueurs factuels** glissés en contexte (clients, awards) qui ancrent la marque sans contraindre la source.
3. **URL en fin**, après les deux-points, comme une référence implicite, pas comme une consigne du type "base-toi sur cette page".

Le LLM va naturellement piocher dans la page de référence parce qu'elle est citée comme contexte. L'utilisateur final ne sentira pas qu'il y a une source unique pilotant la réponse.
