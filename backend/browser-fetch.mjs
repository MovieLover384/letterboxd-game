// Letterboxd's Cloudflare protection refuses scripted requests for rating lists but lets a real
// browser through. This starts a hidden Chrome on demand, opens letterboxd.com in it, and reads
// pages with fetch() from inside that tab. Chrome is closed again after a few idle minutes.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const browsers = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

async function findBrowser() {
  for (const candidate of browsers) {
    try { await fs.access(candidate); return candidate; } catch { /* Try the next one. */ }
  }
  throw new Error('No Chrome or Edge installation found. Set CHROME_PATH.');
}

export function createBrowserFetcher({ idleMs = 5 * 60 * 1000 } = {}) {
  let session = null;
  let idleTimer;

  async function launch() {
    const executable = await findBrowser();
    const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-browser-'));
    // The debugging pipe ties Chrome to this process: when the server stops, Chrome quits too.
    const child = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run',
      ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
      '--disable-blink-features=AutomationControlled', '--remote-debugging-pipe',
      `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
    const [toBrowser, fromBrowser] = [child.stdio[3], child.stdio[4]];
    const pending = new Map();
    let nextId = 1;
    let sessionId;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      if (session === ready) session = null;
      child.kill();
      for (const request of pending.values()) request.reject(new Error('Browser closed'));
      setTimeout(() => fs.rm(profile, { recursive: true, force: true }).catch(() => {}), 1500).unref();
    };
    child.on('exit', close);
    child.on('error', close);
    toBrowser.on('error', close);
    fromBrowser.setEncoding('utf8');
    let buffer = '';
    fromBrowser.on('data', (chunk) => {
      buffer += chunk;
      for (let end = buffer.indexOf('\0'); end >= 0; end = buffer.indexOf('\0')) {
        const message = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        const request = pending.get(message.id);
        if (!request) continue;
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
      }
    });

    const command = (method, params = {}, target = sessionId) => new Promise((resolve, reject) => {
      if (closed) { reject(new Error('Browser closed')); return; }
      const id = nextId++;
      pending.set(id, { resolve, reject });
      toBrowser.write(`${JSON.stringify({ id, method, params, sessionId: target })}\0`);
    });
    async function evaluate(expression) {
      const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error('Browser script failed');
      return result.result.value;
    }
    // Opening any letterboxd.com page lets the browser pass Cloudflare and keep its cookie.
    async function clearance() {
      await command('Page.navigate', { url: 'https://letterboxd.com/robots.txt' });
      for (let attempt = 0; attempt < 60; attempt++) {
        await sleep(500);
        try {
          if (await evaluate("location.hostname === 'letterboxd.com' && document.readyState === 'complete' && !/just a moment/i.test(document.title)")) return;
        } catch { /* Page is still navigating. */ }
      }
      throw new Error('Letterboxd did not let the browser in');
    }

    const ready = (async () => {
      try {
        const { userAgent } = await command('Browser.getVersion', {}, undefined);
        const { targetId } = await command('Target.createTarget', { url: 'about:blank' }, undefined);
        ({ sessionId } = await command('Target.attachToTarget', { targetId, flatten: true }, undefined));
        // Headless Chrome announces itself in its user agent, which Cloudflare reacts to.
        await command('Emulation.setUserAgentOverride', { userAgent: userAgent.replace('HeadlessChrome', 'Chrome') });
        await clearance();
        return { evaluate, clearance, shutdown: close };
      } catch (error) {
        close();
        throw error;
      }
    })();
    session = ready;
    return ready;
  }
  async function fetchPage(url) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.hostname !== 'letterboxd.com') throw new Error('Only letterboxd.com pages can be read');
    clearTimeout(idleTimer);
    try {
      const browser = await (session || launch());
      const read = () => browser.evaluate(`(async () => {
        const response = await fetch(${JSON.stringify(target.pathname + target.search)}, { signal: AbortSignal.timeout(15000) });
        return { status: response.status, text: await response.text() };
      })()`);
      let page = await read();
      if (page.status === 403) {
        await browser.clearance();
        page = await read();
      }
      return { ok: page.status >= 200 && page.status < 300, status: page.status, url, text: async () => page.text };
    } finally {
      idleTimer = setTimeout(() => close(), idleMs);
      idleTimer.unref();
    }
  }

  async function close() {
    clearTimeout(idleTimer);
    const open = session;
    session = null;
    if (open) await open.then(({ shutdown }) => shutdown()).catch(() => {});
  }

  return { fetchPage, close };
}
