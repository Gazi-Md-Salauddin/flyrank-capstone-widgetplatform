const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

const pagePath = join(__dirname, 'index.html');
const server = createServer(async (request, response) => {
  if (request.method !== 'GET' || !['/', '/index.html'].includes(request.url)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  try {
    const page = await readFile(pagePath);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(page);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Unable to load test page');
  }
});

server.listen(5500, 'localhost', () => {
  console.info('[customer-site] Test page at http://localhost:5500');
});
