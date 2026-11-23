import express, { type ErrorRequestHandler, type Express } from "express";
import cookieParser from "cookie-parser";
import { AppError } from "./lib/nourish-store";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0]?.replace(/N360-SNP-[A-Z0-9]+/g, "[record]").replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "[id]"),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  const site = req.get('sec-fetch-site');
  if (site && !['same-origin','none'].includes(site)) {
    res.status(403).json({error:'Cross-origin API requests are not allowed.'});
    return;
  }
  next();
});
app.use(express.json({limit:'64kb'}));
app.use(cookieParser());

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) { next(err); return; }
  if (err instanceof AppError) { res.status(err.status).json({error:err.message}); return; }
  if (err?.type === 'entity.parse.failed') { res.status(400).json({error:'Invalid JSON.'}); return; }
  if (err?.status === 413) { res.status(413).json({error:'Request is too large.'}); return; }
  if (err?.status === 415) { res.status(415).json({error:'Unsupported request encoding. Send UTF-8 JSON.'}); return; }
  if (err?.type === 'request.aborted' || err?.type === 'request.size.invalid') { res.status(400).json({error:'Incomplete JSON request.'}); return; }
  req.log.error({name:err?.name, code:err?.code ?? err?.cause?.code},'Nourish360 request failed');
  res.status(500).json({error:'Something went wrong. Try again.'});
};
app.use(errorHandler);

export default app;
