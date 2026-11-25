// Megalodon · compilación: concatena el código en orden, incrusta CSS y JS en un único HTML
// y fija la CSP con los hashes sha256 de lo incrustado. Sin dependencias: solo Node.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(ROOT, p), 'utf8');

// Orden de carga: un único ámbito compartido (sin módulos), igual que en el navegador.
export const ORDER = [
  'src/app/00-iconos.js',
  'src/engine/net.js', 'src/engine/scenarios.js', 'src/engine/fields.js', 'src/engine/dissect.js',
  'src/engine/filter.js', 'src/engine/stats.js', 'src/engine/analyze.js',
  'src/content/modules.js', 'src/content/reference.js',
  '@hero',
  'src/app/05-i18n.js', 'src/app/10-state.js', 'src/app/20-ui.js', 'src/app/30-workspace.js',
  'src/app/40-dialogs.js', 'src/app/45-ladder.js', 'src/app/50-views.js', 'src/app/60-perfil.js',
  'src/app/80-fx.js', 'src/app/85-search.js', 'src/app/90-shell.js',
];

function heroChunk() {
  const meta = JSON.parse(rd('src/assets/hero.json'));
  const b64 = f => readFileSync(join(ROOT, 'src/assets', f)).toString('base64');
  const obj = { avif: `data:image/avif;base64,${b64('hero.avif')}`, webp: `data:image/webp;base64,${b64('hero.webp')}`, ...meta };
  const logo = `data:image/webp;base64,${b64('logo.webp')}`;
  const version = JSON.parse(rd('package.json')).version;
  return `/* hero: assets/hero.avif + hero.webp · logo: assets/logo.webp */\nconst HERO_IMG = ${JSON.stringify(obj)};\nconst LOGO_IMG = ${JSON.stringify(logo)};\nconst APP_VERSION = ${JSON.stringify(version)};\n`;
}

export function build() {
  const parts = ORDER.map(f => f === '@hero' ? heroChunk() : `/* ${f} */\n${rd(f)}`);
  const script = parts.join('\n');
  const style = rd('src/styles.css');
  const sha = s => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
  const html = rd('src/index.html')
    .replace('{{FAVICON}}', `data:image/png;base64,${readFileSync(join(ROOT, 'src/assets/favicon.png')).toString('base64')}`)
    .replace('{{SCRIPT_HASH}}', sha(script)).replace('{{STYLE_HASH}}', sha(style))
    .replace('{{STYLE}}', () => style).replace('{{SCRIPT}}', () => script);
  if (/<(script|link|img|iframe)[^>]+(src|href)=["']https?:/i.test(html)) throw new Error('El HTML carga recursos externos');
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = build();
  if (process.argv.includes('--check')) {               // la CI comprueba que dist/ y megalodon.html están al día
    const stale = ['dist/index.html', 'megalodon.html'].filter(f => !existsSync(join(ROOT, f)) || readFileSync(join(ROOT, f), 'utf8') !== html);
    if (stale.length) { console.error(`Sin compilar: ${stale.join(', ')}. Ejecuta npm run build.`); process.exit(1); }
    console.log('dist/ al día'); process.exit(0);
  }
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist/index.html'), html);
  writeFileSync(join(ROOT, 'megalodon.html'), html);
  console.log(`dist/index.html y megalodon.html · ${(html.length / 1024).toFixed(1)} KB`);
}
