import http from "node:http";
import next from "next";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOSTNAME || "0.0.0.0";
const dir = process.cwd();

async function start() {
  const app = next({
    dev: true,
    dir,
    hostname: host,
    port,
    webpack: true,
  });

  await app.prepare();
  const handle = app.getRequestHandler();

  http
    .createServer((req, res) => handle(req, res))
    .listen(port, host, () => {
      console.log(`ready - started server on http://${host}:${port}`);
    });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
