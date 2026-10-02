import { defineRailway, github, project, service, volume } from 'railway/iac';

export default defineRailway((ctx) => {
  const data = volume('opendots-data', { sizeMB: 1024 });
  const browser = service('Browser', {
    source: github('warengonzaga/opendots-railway'),
    build: { builder: 'DOCKERFILE' },
    replicas: 1,
    deploy: { sleepApplication: false, restartPolicyType: 'ON_FAILURE' },
    env: {
      OPENDOTS_SERVICE: 'browser',
      BROWSER_HOST: '::',
      BROWSER_PORT: '4311',
      BROWSER_SECRET: ctx.shared.BROWSER_SECRET,
    },
  });
  const app = service('OpenDots', {
    source: github('warengonzaga/opendots-railway'),
    build: { builder: 'DOCKERFILE' },
    replicas: 1,
    deploy: { sleepApplication: false, restartPolicyType: 'ON_FAILURE' },
    healthcheck: '/',
    volumeMounts: { '/data': data },
    env: {
      OPENDOTS_SERVICE: 'app',
      HOST: '::',
      PORT: '4310',
      DATABASE_PATH: '/data/opendots.sqlite',
      OWNER_ID: '${{RAILWAY_PROJECT_ID}}',
      OWNER_TOKEN: ctx.shared.OWNER_TOKEN,
      APP_ORIGIN: 'https://${{RAILWAY_PUBLIC_DOMAIN}}',
      BROWSER_URL: 'http://${{Browser.RAILWAY_PRIVATE_DOMAIN}}:4311',
      BROWSER_SECRET: browser.env.BROWSER_SECRET,
      INTELLIGENCE_API_KEY: ctx.shared.INTELLIGENCE_API_KEY,
      OPENAI_API_KEY: ctx.shared.OPENAI_API_KEY,
      OPENAI_MODEL: ctx.shared.OPENAI_MODEL,
    },
  });
  return project('opendots', { resources: [app, browser, data] });
});
