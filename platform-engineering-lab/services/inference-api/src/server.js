import http from 'node:http';

const port = Number(process.env.PORT || 8080);
const version = process.env.APP_VERSION || 'local';
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  if (req.url === '/health' || req.url === '/ready') {
    res.writeHead(200); return res.end(JSON.stringify({ status: 'ok', version }));
  }
  if (req.url === '/v1/infer' && req.method === 'POST') {
    let body = ''; req.on('data', chunk => { body += chunk; });
    return req.on('end', () => { res.writeHead(200); res.end(JSON.stringify({ requestId: crypto.randomUUID(), accepted: true, bytes: body.length })); });
  }
  res.writeHead(404); res.end(JSON.stringify({ error: 'not_found' }));
});
server.listen(port, '0.0.0.0');
