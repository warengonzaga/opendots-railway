# Repository guidance

This repository packages CopilotKit OpenDots for Railway. Follow Clean Coding,
Clean Commit, and Clean Flow as defined below.

## Clean Coding

- Read the affected code, current branch, and working-tree changes before editing.
  Preserve unrelated work and resolve material uncertainties before implementation.
- Use the smallest complete change: reuse existing code, standard libraries,
  native capabilities, and installed dependencies before adding new machinery.
- Fix root causes, preserve validation and security, and avoid speculative
  abstractions or unrelated refactoring.
- Verify changed behavior with the existing checks. Add a small runnable regression
  check for nontrivial logic when needed, then review the final diff for correctness
  and maintainability. Report passed checks and verification gaps separately.

## Clean Commit

Use one of these exact subject formats:

```text
<emoji> <type>: <description>
<emoji> <type> (<scope>): <description>
<emoji> <type>!: <description>
<emoji> <type>! (<scope>): <description>
```

| Emoji | Type | Use |
| --- | --- | --- |
| 📦 | `new` | New features, files, or capabilities |
| 🔧 | `update` | Existing-code changes and bug fixes |
| 🗑️ | `remove` | Removing code, features, or dependencies |
| 🔒 | `security` | Security fixes and hardening |
| ⚙️ | `setup` | Configuration, CI/CD, and tooling |
| ☕ | `chore` | Maintenance and housekeeping |
| 🧪 | `test` | Tests and test fixes |
| 📖 | `docs` | Documentation changes |
| 🚀 | `release` | Releases and release preparation |

Use present tense, start the description in lowercase, omit a final period, and
keep the subject under 72 characters when practical. Apply this format to new
commits and squash-merge subjects. Preserve existing published commits, tags, and
releases; do not rewrite history merely to fix formatting without explicit
authorization.

## Clean Flow

- Create short-lived branches from `dev` with lowercase descriptive names and a
  suitable prefix: `feature/`, `fix/`, `docs/`, `chore/`, `test/`, or `refactor/`.
- Target feature pull requests at `dev` and squash merge them. Avoid direct commits
  to `dev` or `main`; update the feature branch against `dev` when needed.
- Promote stable `dev` to `main` with a regular merge commit, never a squash or
  rebase merge. Use a meaningful `🚀 release:` title for that pull request.
- Keep `main` stable and delete merged feature branches when appropriate.

## Deployment invariants

- Keep upstream application source pinned to a full commit SHA in `Dockerfile`.
  The only application adjustment is `prepare-upstream.mjs`, which enables Luna
  tool calling on the standard OpenAI endpoint and adds upstream regression cases.
  Keep it narrowly scoped and fail on source drift; review upstream changes and
  rebuild both images when updating the pin.
- Preserve both Docker targets, `app` and `browser`, selected by
  `OPENDOTS_SERVICE`. Leave Railway start commands unset so image commands run.
- Expose only OpenDots publicly. Keep Browser private and authenticated; preserve
  owner-token authentication, exact `APP_ORIGIN`, and private-target blocking.
- Mount persistent storage at `/data`, keep `OWNER_ID` stable, and retain the app's
  privilege drop to UID/GID 1000. Keep one replica per service and sleeping disabled;
  the app uses SQLite and runs scheduled work in-process.
- Keep credentials outside the repository. Use generated secrets and required
  credential inputs in the template, never personal values as defaults.
- Per-Dot Docker computers are outside this package's scope. The public template is
  [OpenDots on Railway](https://railway.com/deploy/opendots). Verify marketplace
  publication separately from GitHub releases.

## Verification

Use Node 22.16+ for repository checks and a running Docker engine for image checks:

```sh
npm ci
npm test
npm run build:app
npm run build:browser
npm run test:smoke
```

Run the checks relevant to the change. Deployment or image changes require both
builds and the smoke check, which exercises authentication, privilege dropping,
volume persistence, and browser behavior. Documentation-only changes need a diff
and consistency review. CI success does not verify Railway networking or paid
model calls: validate a fresh Railway deployment before marketplace publication.
