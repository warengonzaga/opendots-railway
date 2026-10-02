# OpenDots on Railway

Deploy [OpenDots by CopilotKit](https://github.com/CopilotKit/OpenDots) with an authenticated app, persistent pages and settings, and a private read-only browser service.

This repository packages upstream commit [`b01ac1f`](https://github.com/CopilotKit/OpenDots/tree/b01ac1f6a903e5e56c119d960901353ac0a3d171) with a small Luna compatibility adjustment. It follows the [OpenBot Railway template](https://railway.com/deploy/openbot) approach: pin the application source, generate secrets, persist state, and keep supporting services private. OpenDots already includes owner login, agents, and scheduling, so no separate gateway, Postgres, or cron worker is needed.

**Scope:** chat, Dots, Spaces/pages, recurring work, and read-only public-page browsing. Persistent per-Dot computers, browser logins, terminal access, and computer takeover are **not included**: upstream requires a Docker-socket supervisor and Docker-network endpoints. An external supervisor URL alone does not make that feature work on Railway. See [upstream computer deployment](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/docs/COMPUTERS.md).

Deploy with the [OpenDots Railway template](https://railway.com/deploy/opendots), then provide your CopilotKit Intelligence API key and OpenAI API key. GPT-6 Luna and the standard OpenAI endpoint are preconfigured.

## Recreate the Railway template

In your Railway workspace, open **Templates → New Template** and add two GitHub services, both using `warengonzaga/opendots-railway`. Keep their names exactly `OpenDots` and `Browser` for the variable references below. The root Dockerfile is shared; `OPENDOTS_SERVICE` selects the correct final build stage.

| Setting | OpenDots | Browser |
| --- | --- | --- |
| Source | This GitHub repository, `main` | This GitHub repository, `main` |
| Docker build argument / service variable | `OPENDOTS_SERVICE=app` | `OPENDOTS_SERVICE=browser` |
| Public networking | Generate HTTPS domain, target port `4310` | **Disabled**, no domain or TCP proxy |
| Volume | Mount at `/data` | None |
| Healthcheck | `/` | Leave unset; `/health` requires authentication |
| Replicas | `1` | `1` |
| Serverless/sleep | Disabled | Disabled |
| Start command | Leave unset | Leave unset |

Set these variables in the **template editor**. `secret()` is a template function, not an ordinary project variable generator.

### OpenDots variables

| Variable | Value |
| --- | --- |
| `OPENDOTS_SERVICE` | `app` |
| `NODE_ENV` | `production` |
| `HOST` | `::` |
| `PORT` | `4310` |
| `DATABASE_PATH` | `/data/opendots.sqlite` |
| `APP_ORIGIN` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `OWNER_ID` | `${{RAILWAY_PROJECT_ID}}` |
| `OWNER_TOKEN` | `${{secret(64)}}` |
| `BROWSER_URL` | `http://${{Browser.RAILWAY_PRIVATE_DOMAIN}}:4311` |
| `BROWSER_SECRET` | `${{Browser.BROWSER_SECRET}}` |
| `INTELLIGENCE_API_KEY` | Required input; the user's CopilotKit Intelligence project key |
| `OPENAI_API_KEY` | Required input; the user's model-provider API key |
| `OPENAI_MODEL` | `gpt-6-luna` (preconfigured; change only to use another model) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` |

### Browser variables

| Variable | Value |
| --- | --- |
| `OPENDOTS_SERVICE` | `browser` |
| `BROWSER_HOST` | `::` |
| `BROWSER_PORT` | `4311` |
| `BROWSER_SECRET` | `${{secret(64)}}` |

Use [MARKETPLACE.md](MARKETPLACE.md) for the listing description. Create the template, deploy a fresh test instance, and verify login, page persistence after redeploy, chat with your credentials, and public-page browsing before publishing it. Never save personal API keys or a deployed owner's token as template defaults.

After deployment, open the OpenDots domain and sign in with the generated `OWNER_TOKEN` from that service's Variables tab. Keep it private. Railway terminates HTTPS; `APP_ORIGIN` must match the exact public HTTPS origin without a trailing slash. Update it if you add a custom domain.

GPT-6 Luna uses `reasoning_effort: "none"` for tool calling through the pinned app's Chat Completions integration, as required by [OpenAI](https://developers.openai.com/api/docs/models/gpt-6-luna). The build applies this setting only to `gpt-6-luna` on the standard OpenAI endpoint; other model/provider settings remain unchanged. Luna reasoning with tools would require a Responses API migration.

The model and API URL require no input for OpenAI. To use another OpenAI-compatible provider, change `OPENAI_BASE_URL` and `OPENAI_MODEL` to that provider's endpoint and model name, and supply its API key as `OPENAI_API_KEY`.

## Deploy through infrastructure as code

The supplied `.railway/railway.ts` uses Railway's current TypeScript IaC SDK. It creates the two services and a volume; it does not create or publish a marketplace template.

1. Create a new empty Railway project and link it using the current [Railway CLI](https://docs.railway.com/guides/cli). Use a dedicated project: this configuration owns its resource graph.
2. Create shared variables `OWNER_TOKEN` and `BROWSER_SECRET` with **different**, randomly generated values of at least 24 characters. Also create `INTELLIGENCE_API_KEY` and `OPENAI_API_KEY`. The configuration supplies `OPENAI_MODEL=gpt-6-luna` and `OPENAI_BASE_URL=https://api.openai.com/v1`. Keep all credentials in Railway, not this repository.
3. Run:

   ```sh
   npm ci
   npm test
   railway config plan
   railway config apply
   ```

4. Generate a public domain **only** for OpenDots, targeting port 4310, and redeploy it so `APP_ORIGIN` resolves. Keep Browser private.
5. Verify the deployment, then create a draft template:

   ```sh
   railway templates create --json
   ```

6. Review the generated template in Railway. Replace every copied credential with a required input or the template-generated secret expressions above. Confirm all reference variables, volume, domain, build selector, and sleep settings before publication. Publish with the actual returned template ID:

   ```sh
   railway templates publish TEMPLATE_ID --category AI/ML --description "OpenDots by CopilotKit: persistent AI coworkers, pages, and private browsing" --readme-file MARKETPLACE.md
   ```

## Operations and limitations

- Keep one always-running app replica. It uses SQLite and runs scheduled work inside the process; sleeping suspends scheduled work.
- The `/data` volume contains pages, settings, task state, and conversation bindings. Conversation history lives in CopilotKit Intelligence. Configure Railway volume backups separately and keep `OWNER_ID` stable across redeploys.
- The app initializes a fresh Railway volume, drops supplementary groups and root privileges, and imports upstream as PID 1. Restored databases must already be readable/writable by UID/GID 1000; the startup wrapper only fixes the mount directory's owner.
- The Browser service accepts authenticated requests over the private network. Upstream blocks private targets and redirects and disables JavaScript. It is a read-only page capture service, not an interactive computer or web search engine. Railway's network is not the same isolation boundary as upstream's full Docker Compose network setup; keep this in a dedicated project, without unrelated sensitive services.
- Owner-token access is a single-owner deployment. Do not treat it as multi-tenant isolation.
- Slack and calls are optional: configure managed Channels and explicit Slack allowlists, or the separate voice provider, following [upstream setup](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/docs/SETUP.md). They are not enabled or verified by this package.
- `COPILOTKIT_LICENSE_TOKEN` is not used by this pinned OpenDots version. Chat requires the Intelligence key and model API key; the template supplies the model name and API URL.

## Verification and upgrades

Contributions follow [AGENTS.md](AGENTS.md): start a feature branch from `dev`, squash feature pull requests into `dev`, then promote `dev` to `main` with a regular merge commit. Use Clean Commit messages for commits and squash titles.

With Node 22.16+ and Docker running:

```sh
npm ci
npm test
npm run build:app
npm run build:browser
npm run test:smoke
```

Each image build also runs the upstream agent tests, including Luna request settings, tool execution and continuation, and unchanged custom-provider behavior. These tests mock model responses and do not verify live Luna access or answer quality.

The smoke check uses fresh disposable containers and a volume, verifies authentication/origin rejection, app privilege dropping, page persistence across container replacement, browser authentication, private-target blocking, and a real public-page capture. It needs no model credentials. [Build Flow](https://github.com/wgtechlabs/build-flow-action) runs these checks on pull requests, pushes to `dev`/`main`, manual runs, and published releases. Gitleaks runs on branch, pull request, and manual events; its bundled action does not support release events, so release only commits that passed those checks. CI success does not verify Railway networking, paid model calls, Slack, or voice.

After release checks pass, [Container Build Flow](https://github.com/wgtechlabs/container-build-flow-action) publishes separate `linux/amd64` images to `ghcr.io/warengonzaga/opendots-railway-app` and `ghcr.io/warengonzaga/opendots-railway-browser`. A stable release such as `v0.1.1` publishes version tags including `0.1.1` and `latest`. Pull requests, branch pushes, and manual checks do not publish images or create releases. Docker Hub is not required: GHCR uses the built-in `GITHUB_TOKEN` with `packages: write`.

The Railway configuration above continues to build from GitHub. Before switching a public template to images, publish a release containing this workflow, make both GHCR packages public in their package settings, and verify anonymous pulls of both versioned images. Existing releases are not republished automatically. Container scans report findings to GitHub; the action's default scan policy does not block image publication.

To upgrade, change the full upstream commit in `Dockerfile`, review upstream deployment changes, and rerun both builds and checks before releasing. The Node 24 base receives maintenance updates; application source and npm dependencies remain pinned to the upstream commit and lockfile. Back up the volume before upgrading; rolling code back may not reverse a database migration.

OpenDots is MIT-licensed by its upstream authors. Its license is retained in both images. This deployment wrapper is independently maintained and is not an official CopilotKit or Railway product.
