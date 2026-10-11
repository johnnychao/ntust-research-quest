import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {dirname, resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 8765);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.md':'text/plain; charset=utf-8','.R':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.ps1':'text/plain; charset=utf-8'};
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) {response.writeHead(405); response.end(); return;}
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const filename = resolve(root, '.' + (pathname.endsWith('/') ? pathname+'index.html' : pathname));
    const parts = pathname.split('/');
    if (!filename.startsWith(root+sep) || parts.some(part => part.startsWith('.')) || filename.includes('\0')) {response.writeHead(403);response.end('Forbidden');return;}
    const info = await stat(filename); if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, {'Content-Type':mime[extname(filename)] || 'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if (request.method === 'HEAD') response.end(); else createReadStream(filename).pipe(response);
  } catch {response.writeHead(404);response.end('Not found');}
});
server.on('error', error => {console.error(`Preview failed: ${error.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1', () => console.log(`Open http://127.0.0.1:${port}/`));
