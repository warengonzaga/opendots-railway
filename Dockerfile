# syntax=docker/dockerfile:1
ARG OPENDOTS_SERVICE=app

# Application source stays pinned; this repository only packages deployment.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ADD https://github.com/CopilotKit/OpenDots.git#b01ac1f6a903e5e56c119d960901353ac0a3d171 /app
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS app
ENV NODE_ENV=production HOST=:: PORT=4310 DATABASE_PATH=/data/opendots.sqlite
WORKDIR /app
COPY --from=build /app/package.json /app/LICENSE ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY entrypoint.mjs ./entrypoint.mjs
EXPOSE 4310
CMD ["node", "entrypoint.mjs"]

FROM node:24-bookworm-slim AS browser
ENV NODE_ENV=production BROWSER_HOST=:: BROWSER_PORT=4311 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY --from=build /app/package.json /app/LICENSE ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/server ./dist/server
RUN npx --no-install playwright install --with-deps chromium && chmod -R a+rX /ms-playwright
USER node
EXPOSE 4311
CMD ["node", "dist/server/browser/index.js"]

# Railway passes the matching service variable as a Docker build argument.
FROM ${OPENDOTS_SERVICE} AS runtime
