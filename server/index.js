import express from 'express';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const PORT = Number(process.env.SERVER_PORT || process.env.PORT || 3004);
const HOST = process.env.SERVER_HOST || '127.0.0.1';

const DATA_FILE = path.resolve(__dirname, '..', 'client', 'src', 'data', 'rentals.json');
const DIST_DIR = path.resolve(__dirname, '..', 'client', 'dist');

// The dataset is static (aggregated from the data.gov.sg CSV). We read the
// pre-built JSON once at startup; `npm run build:data` regenerates it.
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (err) {
    console.error(`[server] could not read ${DATA_FILE}:`, err.message);
    console.error('[server] run `npm run build:data` to generate it.');
    return null;
  }
}

let data = loadData();

const app = express();

app.get('/api/rentals', (_req, res) => {
  if (!data) data = loadData();
  if (!data) {
    res.status(503).json({ error: 'data_unavailable', message: 'Run `npm run build:data`.' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json(data);
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasData: !!data,
    generatedAt: data?.generatedAt ?? null,
    towns: data?.towns?.length ?? 0,
    months: data?.months?.length ?? 0,
  });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  console.log(`[server] data ${data ? 'loaded' : 'MISSING — run npm run build:data'}`);
});
