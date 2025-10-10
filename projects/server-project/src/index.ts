import app from './app';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '127.0.0.1';

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.info(`🚀 Server ready at http://${host}:${port}`);
});
