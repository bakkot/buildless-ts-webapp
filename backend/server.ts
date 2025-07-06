import path from 'node:path';
import fs from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import express, { type Request, type Response } from 'express';
// @ts-expect-error this does not have types
import { writeImportmaps } from '@jsenv/importmap-node-module';
import type { APIRequest, APIResponse } from '../common/types.ts';

const PORT = 3000;
const frontendDir = path.resolve(import.meta.dirname, '..', 'frontend');
const nodeModulesDir = path.resolve(import.meta.dirname, '..', 'node_modules');

const app = express();

app.use(express.json());
app.post('/api', async (req: Request<{}, {}, APIRequest>, res: Response) => {
  res.json({ output: req.body.input.toUpperCase() } satisfies APIResponse);
});

app.get('/{*splat}', async (req: Request, res: Response) => {
  let reqPath = path.normalize(req.path);
  if (reqPath.endsWith('/')) {
    reqPath += 'index.html';
  }
  try {
    let resolvedPath = path.resolve(path.join(frontendDir, reqPath));
    if (reqPath.startsWith('/node_modules')) {
      resolvedPath = path.resolve(path.join(nodeModulesDir, '..', reqPath));
      if (!resolvedPath.startsWith(nodeModulesDir)) {
        res.status(403).send('Forbidden');
        return;
      }
    } else if (!resolvedPath.startsWith(frontendDir)) {
      res.status(403).send('Forbidden');
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();

    if (ext === '.ts') {
      // ******* This is the important bit. *******
      const content = await fs.readFile(resolvedPath, 'utf8');
      res.type('text/javascript');
      res.send(stripTypeScriptTypes(content, { mode: 'transform' }));
    } else if (ext === '.html') {
      // insert import map
      const packageJsonDir = path.join(import.meta.dirname, '..');
      const relative = path.relative(packageJsonDir, resolvedPath);
      const importMap = JSON.stringify((await writeImportmaps({
        writeFiles: false,
        directoryUrl: packageJsonDir,
        importmaps: { [relative]: {} }, // default options are all fine
      }))[relative]);
      const content = await fs.readFile(resolvedPath, 'utf8');
      res.type('text/html');
      res.send(content.replace(/<script\b/i, `<script type="importmap">${importMap}</script><script`));
    } else {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        res.status(404).send('Not Found');
        return;
      }
      res.sendFile(resolvedPath);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      res.status(404).send('Not Found');
      return;
    }
    if (error.code === 'EACCES') {
      res.status(403).send('Forbidden');
      return;
    }
    console.error('File serving error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT);
console.log(`Listening at http://localhost:${PORT}`);
