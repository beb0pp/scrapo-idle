import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import ts from 'typescript';

const iconSource = await readFile('src/art/skillIcons.ts', 'utf8');
const browserCode = ts.transpileModule(iconSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText
  .replace(/Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\r?\n/, '')
  .replace('exports.skillIconUrls = exports.SKILL_ICON_SIZE = void 0;\n', '')
  .replace('exports.SKILL_ICON_SIZE = 24;', 'const SKILL_ICON_SIZE = 24;')
  .replace('exports.skillIconUrls = Object', 'const skillIconUrls = Object')
  .replaceAll('exports.SKILL_ICON_SIZE', 'SKILL_ICON_SIZE')
  .replaceAll('exports.skillIconUrls', 'skillIconUrls')
  + '\nwindow.skillIconUrls = skillIconUrls;';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 700, height: 120 }, deviceScaleFactor: 1 });
await page.setContent('<main aria-label="Prévia dos ícones de habilidade"></main><style>body{margin:0;background:#14121e}main{display:flex;gap:4px;padding:8px}img{width:96px;height:96px;image-rendering:pixelated;background:#282634}</style>');
await page.evaluate(browserCode);
await page.evaluate(() => {
  const main = document.querySelector('main');
  if (!main) throw new Error('Preview container is missing.');
  Object.values(window.skillIconUrls).forEach((url) => {
    const image = document.createElement('img');
    image.src = url;
    image.alt = '';
    main.append(image);
  });
});
await page.locator('main').screenshot({ path: '.snapshots/skill-icons-preview.png' });
await browser.close();
