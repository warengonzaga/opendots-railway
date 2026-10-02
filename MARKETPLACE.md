# Deploy and Host OpenDots by CopilotKit on Railway

Run your own OpenDots workspace with AI coworkers, persistent Spaces and pages, chat, scheduled work, and read-only public-page browsing.

## About Hosting OpenDots

This template builds CopilotKit's OpenDots application and its browser service from the public [deployment repository](https://github.com/warengonzaga/opendots-railway). Its Dockerfile pins the upstream application to a specific commit. It generates the owner login token and private browser secret, connects the services over Railway's private network, and stores local application data on a persistent volume. Only the authenticated application receives a public URL.

OpenDots already runs its agents and scheduler in the application, and uses SQLite for local state. This template therefore needs two services and one volume; it does not need Postgres or a separate cron worker. Keep the app at one replica with serverless sleeping disabled.

## Dependencies for OpenDots Hosting

### Deployment Dependencies

At deployment, provide your CopilotKit Intelligence API key, model-provider API key, and a model name available to that key. OpenAI is the default endpoint; compatible providers can use `OPENAI_BASE_URL`.

Open the OpenDots URL and sign in using the generated `OWNER_TOKEN` from the OpenDots service's Variables tab. Keep that token private. Pages and settings persist on the volume; conversation history is stored by your CopilotKit Intelligence project.

## Common Use Cases

- Organize personal projects using Dots, Spaces, and persistent pages.
- Chat with AI coworkers using your own model credentials.
- Run recurring work and capture text from public webpages.

## Included and optional features

- Included: Spaces/pages, configurable Dots, chat, recurring work, and private read-only public-page capture.
- Optional separate setup: Slack through managed CopilotKit Channels, and voice through a speech provider.
- **Not included: persistent per-Dot computers, interactive browser logins, terminal access, or computer takeover.** Upstream implements those with a Docker-socket supervisor that this Railway deployment does not provide. A remote supervisor URL alone is insufficient.

This is a single-owner deployment, not a multi-tenant service. Use a dedicated Railway project and configure volume backups. Public-page browsing does not include a search provider and rejects redirects and private network targets.

## Why Deploy OpenDots on Railway?

Railway builds both services from the deployment repository, provides HTTPS for OpenDots, connects Browser over private networking, and attaches persistent storage. You can manage the deployment in one project without a separate Postgres database or cron worker.

## Documentation

- [OpenDots by CopilotKit](https://github.com/CopilotKit/OpenDots)
- [Deployment source and configuration](https://github.com/warengonzaga/opendots-railway)
- [CopilotKit Intelligence](https://intelligence.copilotkit.ai)
- [Upstream setup](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/docs/SETUP.md)

This independently maintained package keeps upstream application code unchanged. Review the deployment repository's verification results and limitations when upgrading.
