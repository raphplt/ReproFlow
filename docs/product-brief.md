# ReproFlow

> **Turn recorded bug reproductions into executable regression tests.**

ReproFlow est un outil destiné aux développeurs, équipes QA et équipes support qui transforme une **reproduction réelle d’un bug dans une application web** en un **test automatisé exécutable**, initialement au format Playwright.

L’objectif du produit n’est pas simplement d’enregistrer une session utilisateur ou de générer un résumé avec un LLM.

Le cœur de ReproFlow est la transformation suivante :

```text
manual bug reproduction
        ↓
structured browser trace
        ↓
AI reconstruction
        ↓
executable Playwright test
        ↓
real execution
        ↓
validated reproduction
```

La promesse principale est donc :

> **Réduire le temps passé entre “un bug existe” et “nous avons une reproduction fiable et automatisée de ce bug”.**

---

# 1. Problème

Lorsqu’un utilisateur, un QA ou une personne du support rencontre un bug, le développeur reçoit souvent une information incomplète :

> “Quand je modifie mon adresse puis que je clique sur Checkout, ça ne marche plus.”

Le développeur doit ensuite déterminer :

- quelles actions ont été réalisées ;
- dans quel ordre ;
- sur quelle page ;
- avec quel navigateur ;
- dans quel état applicatif ;
- quelles données étaient présentes ;
- quelles requêtes réseau ont été déclenchées ;
- quelles erreurs JavaScript sont apparues ;
- si le bug est déterministe ;
- comment le reproduire localement.

Ce processus implique souvent plusieurs échanges :

```text
Can you reproduce it again?

Can you send a video?

Which browser are you using?

What did you do before that?

Does it happen every time?

Can you open the console?
```

Même lorsqu’un outil de session replay est disponible, le développeur doit encore :

1. regarder la session ;
2. comprendre ce qui est pertinent ;
3. reproduire le scénario ;
4. écrire manuellement le test.

ReproFlow cherche à automatiser précisément cette transition.

---

# 2. Vision produit

ReproFlow doit devenir la couche entre :

```text
real user behavior
```

et :

```text
automated software testing
```

À terme :

```text
Bug
 ↓
Reproduction
 ↓
Regression test
 ↓
Candidate fix
 ↓
Verification
```

Le produit ne doit cependant pas tenter de résoudre toute cette chaîne dès le MVP.

Le premier objectif est beaucoup plus précis :

> **Transformer une reproduction volontaire et enregistrée d’un bug en test Playwright réellement exécutable.**

---

# 3. Proposition de valeur

Aujourd’hui :

```text
Bug utilisateur
      ↓
Support / QA
      ↓
Ticket
      ↓
Developer investigates
      ↓
Developer tries to reproduce
      ↓
Developer writes test
      ↓
Developer fixes bug
```

Avec ReproFlow :

```text
Bug utilisateur
      ↓
Record reproduction
      ↓
Automatic reconstruction
      ↓
Executable test
      ↓
Developer investigates
      ↓
Fix
```

ReproFlow cherche principalement à réduire :

```text
"Can we reproduce this?"
```

---

# 4. Positionnement

ReproFlow n’est pas un outil de session replay classique.

Des produits existants savent déjà enregistrer :

- clics ;
- navigation ;
- console ;
- erreurs ;
- réseau ;
- DOM ;
- sessions utilisateur.

ReproFlow doit donc éviter le positionnement :

> **AI-powered session replay**

Le positionnement retenu est :

> **Turn recorded bugs into executable regression tests.**

Ou :

> **The missing layer between bug reproduction and automated testing.**

---

# 5. Différenciation

La sortie principale de ReproFlow n’est pas :

```text
The user clicked Checkout and encountered an error.
```

Mais :

```ts
test("checkout fails after editing address", async ({ page }) => {
  await page.goto("/cart")

  await page
    .getByRole("button", { name: "Edit address" })
    .click()

  await page
    .getByLabel("Postal code")
    .fill("75001")

  await page
    .getByRole("button", { name: "Save" })
    .click()

  await page
    .getByRole("button", { name: "Checkout" })
    .click()

  await expect(page).toHaveURL("/checkout")
})
```

Puis ce test est exécuté.

Exemple :

```text
Run result

❌ FAILED

Expected:
/checkout

Received:
/cart

Console:
TypeError: address.postalCode is undefined
```

Le test généré devient ensuite :

- une reproduction ;
- un outil de debug ;
- un test de non-régression.

---

# 6. Principe fondamental

Une génération LLM n’est jamais considérée comme correcte uniquement parce qu’elle semble plausible.

ReproFlow doit avoir une boucle de validation réelle :

```text
LLM generates test
        ↓
test executed
        ↓
observed behavior compared
        ↓
reproduction validated or rejected
```

La question centrale est :

> **Does the generated test actually reproduce the observed failure?**

C’est cette validation qui donne de la crédibilité au produit.

---

# 7. Utilisateurs cibles

## Développeurs

Ils veulent obtenir une reproduction exploitable sans perdre du temps à reconstruire les actions manuellement.

---

## QA engineers

Ils reproduisent déjà volontairement de nombreux bugs.

ReproFlow peut transformer directement leur travail manuel en tests automatisés.

---

## Support engineers

Ils peuvent enregistrer le problème pendant qu’ils le reproduisent ou pendant une session avec un utilisateur.

---

## Engineering teams

Typiquement :

```text
SaaS
web application
5–100 developers
active customer support
Playwright or Cypress
CI/CD
```

---

# 8. MVP

Le MVP doit rester volontairement étroit.

## Principe

Un utilisateur clique :

```text
Start recording
```

Il reproduit manuellement un bug.

Puis :

```text
Stop recording
```

ReproFlow :

1. récupère les événements ;
2. reconstruit les étapes ;
3. génère un test Playwright ;
4. exécute ce test ;
5. affiche le résultat.

---

# 9. Fonctionnalités MVP

## 9.1 Recording

Le système doit enregistrer :

- navigation ;
- clics ;
- saisies utilisateur ;
- soumissions de formulaires ;
- changements d’URL ;
- éléments DOM ciblés ;
- console errors ;
- requêtes réseau pertinentes ;
- viewport ;
- user agent ;
- timestamps.

Éventuellement :

- screenshots ;
- DOM snapshots ;
- metadata des réponses HTTP.

Le MVP ne doit pas chercher à reproduire un système complet de session replay vidéo.

---

# 10. Browser Recorder

Le recorder peut initialement être :

- une extension navigateur ;
- un SDK injecté dans l’application ;
- ou un petit outil local pilotant Chromium.

Le premier objectif est la simplicité de développement.

Workflow :

```text
Start recording
       ↓
Perform actions
       ↓
Trigger bug
       ↓
Stop recording
       ↓
Upload trace
```

---

# 11. Modèle d’événements

Chaque interaction doit devenir un événement structuré.

Exemple :

```json
{
  "type": "click",
  "timestamp": 1720000000,
  "pageUrl": "https://example.com/cart",
  "target": {
    "tag": "button",
    "text": "Checkout",
    "role": "button",
    "ariaLabel": null,
    "id": "button_8291",
    "classes": ["btn", "primary"]
  }
}
```

Input :

```json
{
  "type": "input",
  "target": {
    "label": "Postal code",
    "name": "postalCode"
  },
  "value": "75001"
}
```

Les mots de passe et données sensibles ne doivent pas être enregistrés par défaut.

---

# 12. Session Representation

Les événements bruts doivent être regroupés dans une représentation intermédiaire.

Exemple :

```json
{
  "sessionId": "rep_123",
  "environment": {
    "browser": "Chromium",
    "viewport": {
      "width": 1440,
      "height": 900
    }
  },
  "steps": [],
  "console": [],
  "network": []
}
```

Cette représentation sert de frontière entre :

```text
browser capture
```

et :

```text
AI reconstruction
```

---

# 13. Reconstruction Engine

Le recorder peut produire énormément de bruit.

Exemple :

```text
mouse movement
focus
blur
scroll
click
input
click
network
rerender
```

Le Reconstruction Engine doit transformer cela en :

```text
1. Open cart
2. Edit shipping address
3. Change postal code
4. Save address
5. Click Checkout
```

Il doit notamment :

- supprimer les événements inutiles ;
- regrouper plusieurs événements en une action logique ;
- identifier les éléments importants ;
- conserver les changements d’état nécessaires.

---

# 14. Rôle de l’IA

L’IA est une composante centrale de ReproFlow.

Elle peut être utilisée pour :

### Comprendre l’intention d’une action

```text
raw:
click div > button > span
```

devient :

```text
Click "Checkout"
```

---

### Simplifier une trace

Transformer :

```text
47 raw events
```

en :

```text
5 meaningful actions
```

---

### Choisir des selectors robustes

Éviter :

```ts
page.locator(
  "#root > div:nth-child(4) > button"
)
```

Préférer :

```ts
page.getByRole("button", {
  name: "Checkout"
})
```

---

### Identifier le comportement attendu

Exemple :

Observation :

```text
click Checkout
URL remains /cart
console error appears
```

Hypothèse :

```text
Expected:
navigation to /checkout
```

Lorsque cette information est ambiguë, ReproFlow doit être capable de demander confirmation au développeur plutôt que d’inventer un oracle.

---

### Générer Playwright

À partir de la représentation structurée.

---

### Réparer un test généré

Si le premier test échoue pour une mauvaise raison :

```text
selector not found
```

l’IA peut analyser le run et proposer une version corrigée.

Cette boucle doit avoir une limite stricte.

---

# 15. Selector Engine

C’est un composant important.

Pour chaque élément, ReproFlow doit collecter suffisamment de metadata pour reconstruire un selector stable.

Ordre de préférence potentiel :

```text
data-testid
↓
accessible role + name
↓
label
↓
placeholder
↓
semantic text
↓
stable attributes
↓
CSS fallback
```

Exemple :

HTML :

```html
<button id="btn_829184">
  Checkout
</button>
```

Ne pas utiliser :

```ts
#btn_829184
```

si l’ID est dynamique.

Préférer :

```ts
page.getByRole("button", {
  name: "Checkout"
})
```

---

# 16. Playwright Generator

Input :

```text
structured reproduction
```

Output :

```text
reproduction.spec.ts
```

Le test doit contenir :

- setup ;
- navigation ;
- interactions ;
- assertions ;
- commentaires minimaux si nécessaires.

Il doit rester lisible humainement.

Le développeur doit pouvoir modifier le fichier généré.

---

# 17. Assertions

La génération d’actions est relativement simple comparée au problème suivant :

> **Comment déterminer ce qui constitue réellement le bug ?**

Le recorder doit donc permettre au minimum une indication explicite de fin.

Exemple :

```text
Mark current state as broken
```

Le système capture alors :

- URL ;
- erreurs console ;
- réponses HTTP échouées ;
- DOM visible ;
- screenshot.

Le MVP peut également demander :

```text
What should have happened?
```

Exemple :

```text
Expected URL:
/checkout
```

Cela évite de demander au LLM d’inférer systématiquement l’oracle.

---

# 18. Runner

Le test généré doit être exécuté dans un environnement isolé.

Conceptuellement :

```text
Playwright test
      ↓
Runner
      ↓
Browser
      ↓
Target app
```

Le runner collecte :

- exit status ;
- assertions ;
- console ;
- network failures ;
- screenshots ;
- trace Playwright.

---

# 19. Validation de reproduction

Un run unique ne suffit pas nécessairement.

Le MVP peut exécuter plusieurs fois le test.

Exemple :

```text
Run #1     reproduced
Run #2     reproduced
Run #3     reproduced
```

Puis :

```text
Reproduction result

3 / 3 runs reproduced the issue
```

Ou :

```text
1 / 3 runs reproduced the issue

Status:
FLAKY
```

Éviter de présenter un faux score de confiance scientifique.

Afficher plutôt les résultats observés.

---

# 20. Rapport

Une reproduction doit produire une page synthétique.

Exemple :

```text
Checkout fails after address update

Status
REPRODUCED

Runs
3 / 3

Environment
Chromium
1440 × 900

Steps
1. Open cart
2. Edit address
3. Change postal code
4. Save
5. Checkout

Observed
Remains on /cart

Expected
Navigate to /checkout

Console
TypeError:
address.postalCode is undefined

Network
POST /api/checkout
500

Generated test
reproduction.spec.ts
```

---

# 21. Workflow global MVP

```text
┌─────────────────┐
│ Browser Recorder│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Raw Event Trace │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Reconstruction      │
│ Engine              │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ AI Test Generator   │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Playwright Runner   │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Reproduction Report │
└─────────────────────┘
```

---

# 22. Architecture logique

Le produit peut être découpé en plusieurs services/modules.

```text
Recorder
   │
   ▼
API
   │
   ▼
Trace Store
   │
   ▼
Reconstruction Worker
   │
   ▼
AI Worker
   │
   ▼
Playwright Runner
   │
   ▼
Report API
   │
   ▼
Web Dashboard
```

---

# 23. Monorepo

Structure possible :

```text
reproflow/
│
├── apps/
│   ├── web/
│   ├── api/
│   └── recorder-extension/
│
├── packages/
│   ├── event-schema/
│   ├── recorder-core/
│   ├── reconstruction/
│   ├── ai/
│   ├── playwright-generator/
│   ├── shared/
│   └── ui/
│
├── workers/
│   └── runner/
│
├── examples/
│   └── demo-shop/
│
├── docs/
│
└── README.md
```

La structure exacte peut évoluer.

---

# 24. Stack proposée

Le choix doit privilégier la vitesse de développement et la lisibilité.

## Web

```text
Next.js
TypeScript
React
Tailwind CSS
shadcn/ui
```

---

## API

Deux options cohérentes :

```text
Node.js / TypeScript
```

ou :

```text
NestJS
```

Un backend TypeScript simplifie le partage de schemas avec le recorder.

---

## Database

```text
PostgreSQL
```

Pour :

- users ;
- projects ;
- recordings ;
- reproductions ;
- test runs ;
- integrations.

---

## Queue

Pour les traitements :

```text
Redis
+
BullMQ
```

ou équivalent.

---

## Storage

Object storage compatible S3.

Pour :

- screenshots ;
- traces ;
- logs ;
- artifacts Playwright.

---

## Browser automation

```text
Playwright
```

---

## Validation

```text
Zod
```

pour partager les schemas TypeScript.

---

## Monorepo

```text
pnpm
+
Turborepo
```

---

# 25. AI Provider Abstraction

Le code ne doit pas être totalement couplé à un fournisseur.

Interface conceptuelle :

```ts
interface AIProvider {
  reconstructSession(...)
  generateTest(...)
  repairTest(...)
}
```

Une implémentation peut être utilisée au départ.

Le système n’a pas besoin de supporter plusieurs providers dès le MVP.

---

# 26. Données principales

## Project

```text
id
name
baseUrl
createdAt
```

---

## Recording

```text
id
projectId
status
startedAt
endedAt
environment
```

---

## BrowserEvent

```text
id
recordingId
type
timestamp
payload
```

---

## Reproduction

```text
id
recordingId
title
summary
expectedBehavior
observedBehavior
generatedTest
status
```

---

## TestRun

```text
id
reproductionId
status
startedAt
duration
logs
artifacts
```

---

# 27. États possibles

Recording :

```text
recording
uploaded
processing
completed
failed
```

Reproduction :

```text
draft
generated
running
reproduced
flaky
not_reproduced
failed
```

---

# 28. Sécurité et confidentialité

ReproFlow manipule potentiellement des données extrêmement sensibles.

Le recorder doit donc intégrer dès le départ :

### Password masking

Ne jamais enregistrer :

```text
input[type=password]
```

---

### Field masking

Possibilité de configurer :

```text
credit card
email
phone
address
custom selectors
```

---

### Header sanitization

Ne pas stocker en clair :

```text
Authorization
Cookie
Set-Cookie
API keys
```

---

### Request body filtering

Éviter d’enregistrer aveuglément toutes les payloads réseau.

---

### Project-level rules

Exemple :

```yaml
mask:
  selectors:
    - "[data-sensitive]"
  headers:
    - authorization
  fields:
    - password
    - creditCard
```

---

# 29. Authentication

Pour le MVP :

```text
email / OAuth
```

Pas besoin de :

```text
SSO
SCIM
enterprise RBAC
```

au départ.

---

# 30. Demo Application

Le repo doit inclure une petite application volontairement buggée.

Exemple :

```text
examples/demo-shop
```

Fonctionnalités :

```text
login
cart
address editing
checkout
```

Bug volontaire :

```text
editing postal code
+
checkout
=
application error
```

Cette app permet :

- tests end-to-end ;
- développement local ;
- démo publique ;
- CI reproductible.

---

# 31. Première killer demo

Workflow :

```text
1. Launch demo-shop

2. Start ReproFlow recording

3. Open cart

4. Edit address

5. Change postal code

6. Save

7. Click checkout

8. Observe bug

9. Mark reproduction

10. Stop recording
```

ReproFlow produit :

```text
checkout-after-address-update.spec.ts
```

Le test est lancé :

```text
❌ FAILED
```

Puis le bug dans `demo-shop` est corrigé.

Le même test est relancé :

```text
✓ PASSED
```

C’est la démo de référence du projet.

---

# 32. Intégration GitHub — V1.5

Une fois le MVP fiable, ajouter GitHub.

Bouton :

```text
Create GitHub Issue
```

Issue :

```text
Checkout fails after address update

Environment
Chromium 1440×900

Steps
...

Expected
...

Observed
...

Console
...

Generated test
...
```

Possibilité d’ajouter le test au repository dans une étape ultérieure.

---

# 33. Intégrations futures

Potentielles :

```text
GitHub
GitLab
Linear
Jira
Slack
```

Session replay :

```text
PostHog
Sentry
LogRocket
Jam
```

Test frameworks :

```text
Playwright
Cypress
```

Playwright reste le seul framework supporté au départ.

---

# 34. V2 — Import de sessions existantes

Une évolution majeure serait :

```text
PostHog / Sentry replay
        ↓
ReproFlow importer
        ↓
normalized trace
        ↓
reconstruction
        ↓
test
```

Cela permettrait de passer :

```text
intentional recording
```

à :

```text
production session
```

C’est beaucoup plus difficile et ne fait pas partie du MVP.

---

# 35. V3 — AI coding workflow

Une fois une reproduction fiable obtenue :

```text
Bug
↓
Generated failing test
↓
Coding agent
↓
Candidate patch
↓
Run generated test
↓
Pass / Fail
```

ReproFlow pourrait alors produire une proposition de correction.

La décision de merge reste humaine.

---

# 36. Limites connues

ReproFlow ne pourra pas garantir la reproduction de tous les bugs.

Cas difficiles :

```text
authentication state
server-side state
randomized data
timing bugs
race conditions
A/B experiments
third-party APIs
CAPTCHAs
iframes
payments
emails
background jobs
WebSockets
multi-user scenarios
```

Le produit doit être transparent lorsque la reproduction est impossible.

---

# 37. Problème d’état

Un test peut reproduire exactement les actions sans reproduire le même état serveur.

Exemple :

```text
Order #128 exists during recording
```

mais pas au prochain run.

Il faudra progressivement supporter :

```text
fixtures
seed scripts
setup hooks
API mocks
environment variables
test accounts
```

Le MVP peut fonctionner sur des environnements préparés.

---

# 38. Réparation de test

Si le test généré échoue avec :

```text
element not found
```

ce n’est pas nécessairement le bug.

Le système peut faire :

```text
generate
↓
execute
↓
technical failure
↓
inspect trace
↓
repair selector
↓
retry
```

Limiter par exemple à :

```text
2 or 3 attempts
```

afin d’éviter les boucles infinies.

---

# 39. Types d’échec

Le runner doit distinguer :

### Bug reproduced

Le comportement observé correspond au bug enregistré.

---

### Test generation failure

Le test ne peut pas reproduire les actions.

---

### Infrastructure failure

Exemple :

```text
browser crashed
target unreachable
runner failed
```

---

### Flaky reproduction

Le problème apparaît seulement sur certains runs.

---

### No reproduction

Le scénario fonctionne normalement.

---

# 40. Observabilité

Chaque pipeline doit être inspectable.

```text
recording
↓
reconstruction
↓
generation
↓
execution
↓
validation
```

Afficher les logs utiles permet également de debugger ReproFlow lui-même.

---

# 41. Dashboard MVP

Pages principales :

```text
Projects
Recordings
Reproductions
Settings
```

Projet :

```text
Project
├── recent recordings
├── reproduced bugs
├── failed generations
└── flaky reproductions
```

---

# 42. Reproduction Detail

Page principale du produit.

Elle affiche :

```text
title
status
recording
steps
expected behavior
observed behavior
console errors
network failures
generated Playwright
runs
artifacts
```

---

# 43. UX

ReproFlow doit rester très developer-oriented.

Inspirations :

```text
Linear
Sentry
PostHog
Vercel
GitHub
```

Principes :

- interface dense mais lisible ;
- peu de décoration inutile ;
- logs et code bien présentés ;
- états clairement visibles ;
- actions importantes accessibles rapidement.

---

# 44. CLI — futur

Le projet pourrait ensuite fournir :

```bash
reproflow login
```

```bash
reproflow run reproduction_128
```

```bash
reproflow pull reproduction_128
```

ou :

```bash
reproflow export reproduction_128 \
  --format playwright
```

Pas indispensable au premier MVP.

---

# 45. CI — futur

Exemple :

```yaml
- name: Run ReproFlow regression
  run: npx playwright test reproflow/
```

Ou synchronisation automatique des tests validés vers le repo.

---

# 46. Business model potentiel

## Free

```text
1 project
limited recordings
limited generations
local / basic runs
```

---

## Developer

Hypothèse :

```text
€15–25 / month
```

avec :

- davantage de reproductions ;
- historique ;
- GitHub integration.

---

## Team

Hypothèse :

```text
€60–150 / month
```

avec :

- team workspace ;
- CI ;
- collaboration ;
- shared reproductions.

---

## Enterprise

Potentiellement :

- private runners ;
- SSO ;
- retention policies ;
- private environments ;
- security controls.

Le business model n’est pas prioritaire pour le MVP.

---

# 47. Open source ou SaaS

Le cœur technique peut éventuellement devenir partiellement open source.

Exemple :

```text
Recorder
Event schema
Playwright generator
```

Mais aucune décision n’est nécessaire immédiatement.

Le premier objectif est :

> **prouver que le workflow fonctionne.**

---

# 48. Ce que ReproFlow ne doit PAS devenir au MVP

Ne pas construire :

```text
full session replay platform
video replay engine
mobile support
desktop support
Cypress support
GitLab + Jira + Linear
AI automatic fixing
enterprise RBAC
SSO
multi-region infra
advanced billing
PostHog replacement
Sentry replacement
```

Chaque fonctionnalité doit contribuer directement à :

```text
record bug
→ generate test
→ run test
```

---

# 49. Critères de réussite du MVP

Le MVP est réussi si cette démo fonctionne réellement :

```text
A developer records a bug
        ↓
ReproFlow generates a readable Playwright test
        ↓
the generated test reproduces the bug
        ↓
the developer fixes the app
        ↓
the exact same test passes
```

Le reste est secondaire.

---

# 50. Milestones

## Milestone 1 — Capture

Créer :

```text
demo-shop
+
recorder
+
event schema
```

Objectif :

> enregistrer correctement une reproduction.

---

## Milestone 2 — Reconstruction

Transformer les événements bruts en étapes propres.

```text
raw events
→ meaningful actions
```

---

## Milestone 3 — Generation

Produire un fichier Playwright valide.

```text
trace
→ reproduction.spec.ts
```

---

## Milestone 4 — Execution

Lancer automatiquement le test.

```text
test
→ browser
→ result
```

---

## Milestone 5 — Validation

Déterminer :

```text
reproduced
not reproduced
generation failure
```

---

## Milestone 6 — Product UI

Créer :

```text
projects
recordings
reproductions
reports
```

---

## Milestone 7 — GitHub

Créer automatiquement une issue avec la reproduction.

---

# 51. Première version technique recommandée

Pour éviter de surarchitecturer :

```text
Monorepo
pnpm
Turborepo

Next.js
TypeScript

PostgreSQL

Redis / BullMQ

Playwright

S3-compatible storage

Zod
```

Un seul provider LLM.

Une seule application démo.

Un seul navigateur principal.

Playwright uniquement.

---

# 52. Principes de développement

## Keep the deterministic core deterministic

Utiliser des règles classiques quand elles suffisent.

Exemple :

```text
password detection
event filtering
selector metadata collection
```

ne nécessitent pas forcément de LLM.

---

## Use AI for ambiguity

Utiliser l’IA principalement pour :

```text
semantic reconstruction
step simplification
selector choice
test generation
failure interpretation
```

---

## Validate AI output

Toute sortie critique doit être testée.

---

## Never hide uncertainty

Si ReproFlow n’est pas sûr :

```text
Needs developer input
```

est préférable à une fausse certitude.

---

# 53. README pitch

```text
ReproFlow turns recorded browser bug reproductions
into executable Playwright regression tests.

Record the bug.
Generate the test.
Reproduce it automatically.
Fix it.
Keep the regression test.
```

---

# 54. Pitch court

> **ReproFlow transforme une reproduction manuelle de bug en test Playwright automatiquement exécutable.**

---

# 55. Pitch anglais

> **ReproFlow turns recorded browser bugs into executable regression tests. It captures the reproduction, reconstructs the meaningful user actions with AI, generates a Playwright test, and actually runs it to verify that the bug can be reproduced.**

---

# 56. Vision finale

ReproFlow commence avec :

```text
Record bug
↓
Generate test
↓
Run test
```

Puis peut progressivement devenir :

```text
Real-world bug
        ↓
Automatic reproduction
        ↓
Regression test
        ↓
Issue
        ↓
Coding agent
        ↓
Candidate fix
        ↓
Automatic verification
        ↓
Human review
```

Mais le produit doit toujours conserver son principe fondamental :

> **Une explication générée par l’IA n’est pas une reproduction.**

La valeur de ReproFlow vient du fait que le résultat peut être **exécuté, observé et vérifié**.