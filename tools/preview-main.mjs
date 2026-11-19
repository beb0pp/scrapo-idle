// Keeps a preview checkout on the latest origin/main and serves it with Vite (HMR picks up each update).
// Usage, from the preview worktree: node tools/preview-main.mjs [port] [intervalSeconds]
import { execFileSync, spawn } from 'node:child_process';

const PORT = process.argv[2] ?? '5180';
const EVERY = Number(process.argv[3] ?? 60) * 1000;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const log = (msg) => console.log(`[preview ${new Date().toLocaleTimeString()}] ${msg}`);

let vite = null;
function startVite() {
  vite = spawn('npx', ['vite', '--port', PORT, '--strictPort'], { stdio: 'inherit', shell: true });
  vite.on('exit', (code) => log(`vite exited (${code})`));
}

function update() {
  try {
    git('fetch', '--quiet', 'origin', 'main');
    const head = git('rev-parse', 'HEAD');
    const target = git('rev-parse', 'origin/main');
    if (head === target) return;
    const lockChanged = git('diff', '--name-only', head, target).split('\n').includes('package-lock.json');
    git('checkout', '--quiet', '--detach', target);
    log(`updated to ${git('log', '--oneline', '-1')}`);
    if (lockChanged) {
      log('package-lock changed: reinstalling and restarting vite');
      vite?.kill();
      execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { stdio: 'inherit', shell: true });
      startVite();
    }
  } catch (error) {
    log(`update failed: ${error.message.split('\n')[0]}`);
  }
}

update();
startVite();
setInterval(update, EVERY);
