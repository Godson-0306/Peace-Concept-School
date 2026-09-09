/**
 * DirectAdmin / Passenger Node startup.
 * Setup Node.js App → Application startup file: server.js
 * Application mode: production. Node 20+.
 *
 * CloudLinux Passenger injects a global PhusionPassenger. When present,
 * listen on the Passenger socket instead of a TCP port.
 */
/* global PhusionPassenger */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const underPassenger = typeof PhusionPassenger !== "undefined";
if (underPassenger) {
  PhusionPassenger.configure({ autoInstall: false });
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const apiOrigin = process.env.API_PROXY_ORIGIN || "http://127.0.0.1:8000";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function proxyToApi(req, res, pathname) {
  const target = new URL(pathname + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""), apiOrigin);
  const headers = { ...req.headers, host: target.host };
  delete headers["accept-encoding"];
  const upstream = require(target.protocol === "https:" ? "https" : "http").request(
    target,
    { method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    res.statusCode = 502;
    res.end(`Media proxy error: ${err.message}`);
  });
  req.pipe(upstream);
}

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url || "/", true);
      const pathname = parsedUrl.pathname || "/";
      // Runtime proxy so media works even if next.config was built without API_PROXY_ORIGIN.
      if (pathname.startsWith("/media/")) {
        proxyToApi(req, res, pathname);
        return;
      }
      handle(req, res, parsedUrl);
    });

    const onListen = () => {
      if (underPassenger) {
        console.log("Peace Concept frontend listening via Passenger");
      } else {
        console.log(`Peace Concept frontend listening on ${hostname}:${port}`);
      }
    };

    if (underPassenger) {
      server.listen("passenger", onListen);
    } else {
      server.listen(port, hostname, onListen);
    }
  })
  .catch((err) => {
    console.error("Failed to start Next.js", err);
    process.exit(1);
  });
