import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://e2fba7d602fc061ca8aac8668962c15c@o566930.ingest.us.sentry.io/4510367834963968",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});