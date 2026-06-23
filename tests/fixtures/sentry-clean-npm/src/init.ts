import * as Sentry from '@sentry/react';

// Clean init: PII off, session replay off, no Replay integration.
Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  sendDefaultPii: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

export {};
