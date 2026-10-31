// Local no-auth proxy on 127.0.0.1:8899 that chains CONNECT tunnels to the
// authenticated upstream proxy (HTTPS_PROXY), so Chromium can reach the web
// while still treating 127.0.0.1 as a normal (secure-context) loopback origin.
import http from 'node:http';
import net from 'node:net';
const up = new URL(process.env.HTTPS_PROXY);
const auth = 'Basic ' + Buffer.from(decodeURIComponent(up.username) + ':' + decodeURIComponent(up.password)).toString('base64');
const server = http.createServer((req, res) => { res.writeHead(501); res.end('https only'); });
server.on('connect', (req, client, head) => {
  const s = net.connect(Number(up.port), up.hostname, () => {
    s.write(`CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\nProxy-Authorization: ${auth}\r\n\r\n`);
  });
  let buf = Buffer.alloc(0);
  const onData = (d) => {
    buf = Buffer.concat([buf, d]);
    const i = buf.indexOf('\r\n\r\n');
    if (i < 0) return;
    s.off('data', onData);
    const status = buf.slice(0, i).toString().split(' ')[1];
    if (status !== '200') { client.end(`HTTP/1.1 ${status} Upstream\r\n\r\n`); s.destroy(); return; }
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (buf.length > i + 4) client.write(buf.slice(i + 4));
    if (head?.length) s.write(head);
    s.pipe(client); client.pipe(s);
  };
  s.on('data', onData);
  s.on('error', () => client.destroy());
  client.on('error', () => s.destroy());
});
server.listen(8899, '127.0.0.1', () => console.log('chain proxy on 8899'));
