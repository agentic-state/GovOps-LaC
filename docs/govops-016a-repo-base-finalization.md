# GovOps Spec — REPO_BASE finalization + canonical home link
<!-- type: edit, priority: p1, depends_on: [govops-016] -->
type: edit
priority: p1
depends_on: [govops-016]
spec_id: govops-016a

## Intent

The About page (govops-016) renders §10 References with in-repo links built
from a `REPO_BASE` constant that was a scaffolding placeholder
(`https://github.com/your-org/61-GovOps/blob/main`). The repo is published at
[github.com/eva-foundry/61-GovOps](https://github.com/eva-foundry/61-GovOps)
and the canonical landing page is the GitHub Pages site at
[eva-foundry.github.io/61-GovOps](https://eva-foundry.github.io/61-GovOps/).

Until both are wired in, every §10 in-repo link is a 404 and the canonical
home is invisible to anyone reading the About page. The fix is small,
isolated, and unblocks the page being shared as a peer-grade artefact.

## Acceptance criteria

### Constants

- [ ] In `src/routes/about.tsx` (currently around line 20), the `REPO_BASE`
      constant defaults to the canonical repo URL, with the existing env-var
      override preserved:
      ```ts
      const REPO_BASE =
        import.meta.env.VITE_REPO_BASE_URL ??
        "https://github.com/eva-foundry/61-GovOps/blob/main";
      ```
- [ ] A new `PROJECT_HOME` constant is added beside `REPO_BASE`, also
      env-overridable:
      ```ts
      const PROJECT_HOME =
        import.meta.env.VITE_PROJECT_HOME_URL ??
        "https://eva-foundry.github.io/61-GovOps/";
      ```

### §10 References — Project home row

- [ ] A new `ReferenceCard` is **prepended** to the §10 list (above the
      existing in-repo links). Card uses `ExternalAnchor` (not
      `InRepoAnchor`), `target="_blank"`, target = `PROJECT_HOME`.
- [ ] Title via new i18n key `about.references.project_home`:
  - EN: `Project home`
  - FR: `Page d'accueil du projet`
- [ ] Description via new i18n key `about.references.project_home_desc`:
  - EN: `Canonical GitHub Pages landing page for the GovOps prototype.`
  - FR: `Page de présentation officielle du prototype GovOps sur GitHub Pages.`

### §1 Masthead — secondary CTA

- [ ] In §1 (Hero + Disclaimer card), a secondary `ExternalAnchor` button is
      added next to the existing "View on GitHub" CTA. Same row, same
      visual weight as the existing buttons. Target = `PROJECT_HOME`.
- [ ] Label via new i18n key `about.cta.project_home`:
  - EN: `GitHub Pages`
  - FR: `GitHub Pages`
- [ ] The existing GitHub repo button is **kept** — both buttons visible.

### i18n parity

- [ ] All three new keys (`about.references.project_home`,
      `about.references.project_home_desc`, `about.cta.project_home`) are
      added to all 6 locales: `en`, `fr`, `pt-BR`, `es-MX`, `de`, `uk`.
- [ ] EN + FR translated as above; pt-BR / es-MX / de / uk machine-translated
      and flagged with the same convention used in govops-016.

### Out of scope (DO NOT change in this PR)

- Don't reorder, restyle, or modify any other §10 row.
- Don't touch any constant other than `REPO_BASE` and `PROJECT_HOME`.
- Don't add env vars beyond `VITE_REPO_BASE_URL` (already exists) and the
  new `VITE_PROJECT_HOME_URL`.
- Don't change `ReferenceCard`, `ExternalAnchor`, or `InRepoAnchor`
  components.

### Verification

- [ ] With no env overrides, every §10 in-repo link in the rendered About
      page resolves to a real file in `eva-foundry/61-GovOps@main`.
- [ ] The "Project home" row renders as the first row of §10 and opens in a
      new tab.
- [ ] The masthead exposes a "GitHub Pages" CTA next to the existing GitHub
      repo CTA in all 6 locales.
- [ ] `npm run check:i18n` passes (parity across all 6 locales).
- [ ] `npm run lint` clean.
