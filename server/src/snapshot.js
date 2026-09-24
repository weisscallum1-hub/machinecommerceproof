import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
import http from 'node:http';

const PRIVATE_V4 = /^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01])|100\.(6[4-9]|[789]\d|1[01]\d|12[0-7]))\./;
const BLOCKED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

function isPublicAddress(address) {
  if (net.isIP(address) === 4) return !PRIVATE_V4.test(address) && !address.startsWith('255.');
  if (net.isIP(address) === 6) {
    const a = address.toLowerCase();
    return a === '::1' ? false : !(a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe8') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb') || a.startsWith('::ffff:'));
  }
  return false;
}

async function resolvePublic(hostname) {
  if (BLOCKED_HOSTS.has(hostname.toLowerCase()) || net.isIP(hostname)) throw new Error('Enter a public website hostname, not a local or IP address.');
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(x => !isPublicAddress(x.address))) throw new Error('This website does not resolve exclusively to public addresses.');
  return addresses;
}

function requestPinned(url, address, protocol) {
  return new Promise((resolve, reject) => {
    const transport = protocol === 'https:' ? https : http;
    const req = transport.request(url, {
      method: 'GET', timeout: 7000, maxHeaderSize: 16384,
      headers: { 'user-agent': 'AgentReady-Snapshot/1.0 (+https://agentready.example/scope)', accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.8,*/*;q=0.2' },
      lookup: (_host, _opts, cb) => cb(null, address.address, address.family),
      servername: url.hostname
    }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size <= 1_000_000) chunks.push(chunk); else req.destroy(new Error('Website response exceeded the 1 MB snapshot limit.')); });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), bytes: size }));
    });
    req.on('timeout', () => req.destroy(new Error('Website response timed out.')));
    req.on('error', reject); req.end();
  });
}

function has(html, pattern) { return pattern.test(html); }

export async function createSnapshot(input) {
  if (!input || input.consent !== true) throw new Error('Please confirm you are authorized to request this public-site review.');
  let url;
  try { url = new URL(input.url); } catch { throw new Error('Enter a valid public website URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port && !['80', '443'].includes(url.port)) throw new Error('Only public HTTP or HTTPS websites on standard ports are supported.');
  url.hash = ''; url.search = '';
  const addresses = await resolvePublic(url.hostname);
  const address = addresses.find(a => a.family === 4) || addresses[0];
  const page = await requestPinned(url, address, url.protocol);
  if (page.status < 200 || page.status >= 400) throw new Error(`The public homepage returned HTTP ${page.status}; no score was generated.`);
  const html = page.body.slice(0, 1_000_000);
  const checks = [];
  const add = (label, found, detail, points, maximum) => checks.push({ label, status: found ? 'Found' : 'Not observed', detail, points: found ? points : 0, maximum });
  add('HTTPS', url.protocol === 'https:', url.protocol === 'https:' ? 'Homepage was requested over HTTPS.' : 'Homepage uses HTTP; consider HTTPS for all public pages.', 10, 10);
  add('Reachable homepage', page.status >= 200 && page.status < 400, `Homepage responded with HTTP ${page.status}.`, 10, 10);
  add('Page title', has(html, /<title\b[^>]*>[^<]{3,}/i), 'A descriptive title helps people and software identify this page.', 6, 6);
  add('Meta description', has(html, /<meta\b[^>]*name=["']description["'][^>]*content=["'][^"']{20,}/i) || has(html, /<meta\b[^>]*content=["'][^"']{20,}["'][^>]*name=["']description["']/i), 'A summary can clarify the purpose of your page in previews.', 6, 6);
  add('Structured business data', /application\/ld\+json/i.test(html), 'JSON-LD structured data was ' + (/application\/ld\+json/i.test(html) ? 'observed.' : 'not observed on the homepage.'), 10, 10);
  add('Canonical URL', /<link\b[^>]*rel=["']canonical["']/i.test(html), 'A canonical link can indicate the preferred public page URL.', 5, 5);
  add('Viewport metadata', /name=["']viewport["']/i.test(html), 'Viewport metadata helps mobile browsers render the page appropriately.', 5, 5);
  const root = new URL('/', url);
  const optional = await Promise.all(['/robots.txt', '/llms.txt', '/.well-known/agent-proof.json'].map(async p => {
    try { return [p, await requestPinned(new URL(p, root), address, url.protocol)]; } catch { return [p, null]; }
  }));
  const byPath = Object.fromEntries(optional);
  const robots = byPath['/robots.txt']; const llms = byPath['/llms.txt']; const profile = byPath['/.well-known/agent-proof.json'];
  add('Robots policy', Boolean(robots && robots.status >= 200 && robots.status < 300), 'robots.txt ' + (robots ? `returned HTTP ${robots.status}.` : 'was not reachable.'), 5, 5);
  add('llms.txt', Boolean(llms && llms.status >= 200 && llms.status < 300), 'llms.txt ' + (llms ? `returned HTTP ${llms.status}.` : 'was not reachable.'), 8, 8);
  add('Machine-readable trust profile', Boolean(profile && profile.status >= 200 && profile.status < 300), 'Agent proof profile ' + (profile ? `returned HTTP ${profile.status}.` : 'was not reachable.'), 8, 8);
  add('Published privacy page', /href=["'][^"']*(privacy|data-protection)[^"']*["']/i.test(html), 'A discoverable privacy link was ' + (/href=["'][^"']*(privacy|data-protection)[^"']*["']/i.test(html) ? 'observed.' : 'not observed.'), 5, 5);
  add('Published terms page', /href=["'][^"']*(terms|conditions)[^"']*["']/i.test(html), 'A discoverable terms link was ' + (/href=["'][^"']*(terms|conditions)[^"']*["']/i.test(html) ? 'observed.' : 'not observed.'), 4, 4);
  add('Content language', /<html\b[^>]*\blang=["'][a-z]{2}/i.test(html), 'The root page language was ' + (/<html\b[^>]*\blang=["'][a-z]{2}/i.test(html) ? 'declared.' : 'not observed.'), 4, 4);
  const security = ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy'];
  for (const header of security) add(`Security header: ${header}`, Boolean(page.headers[header]), page.headers[header] ? `${header} was returned by the homepage.` : `${header} was not returned by the homepage response; this alone does not establish a vulnerability.`, 2, 2);
  const total = checks.reduce((n, c) => n + c.maximum, 0);
  const earned = checks.reduce((n, c) => n + c.points, 0);
  const score = Math.round(earned / total * 100);
  return { domain: url.hostname, checkedAt: new Date().toISOString(), score, scoreLabel: score >= 75 ? 'Good visible foundation' : score >= 50 ? 'Promising foundation' : 'Opportunity to improve', summary: `${score >= 75 ? 'A number of useful public signals are in place.' : 'Several public signals could make your business clearer to people and software.'} Start with the not-observed items that matter to your customers.`, checks: checks.map(({ label, status, detail }) => ({ label, status, detail })), scope: 'Passive public HTTP checks only. No authentication, form submission, port scanning, vulnerability testing, or website changes.' };
}
