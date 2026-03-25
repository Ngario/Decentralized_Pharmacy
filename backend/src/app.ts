import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { apiRouter } from './routes/api';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));

  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
  app.use('/api', apiRouter);

  // Central error handler (keeps responses consistent and avoids frontend guessing)
  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ code: 'INTERNAL_ERROR', message });
    }
  );

  return app;
}

