import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = 'https://github.com/Ateliers-Dev/ateliers-ai-skills/blob/main/';
// 配布対象を増やす場合だけ対応を追加する。編集元は常に knowledge/。
export const patterns = [
  {
    source: 'knowledge/reviews/patterns/filesystem-path-safety.md',
    output: 'skills/ateliers-pr-review/references/filesystem-path-safety.md',
  },
];

// 許可領域は root 内。ただし内向きでもリンク経由は拒否する。
// root 自体とその親も検査し、存在しない出力は最後の既存親まで検査する。
// Node がリンクとして報告しない reparse point も、実体パスが異なれば拒否する。
// パス単位の検査なので、検査と I/O の間の置換競合を完全には防がない。
function checkedFile(root, relative, { allowMissing = false } = {}) {
  root = path.resolve(root);
  const target = path.resolve(root, relative);
  const within = path.relative(root, target);
  if (!within || within === '..' || within.startsWith(`..${path.sep}`) || path.isAbsolute(within)) {
    throw new Error(`リポジトリ外または不正なパス: ${relative}`);
  }
  const volume = path.parse(target).root;
  const parts = target.slice(volume.length).split(path.sep);
  let current = volume;
  for (let i = -1; i < parts.length; i++) {
    if (i >= 0) current = path.join(current, parts[i]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      // root 不在は設定不備。ENOENT 以外（権限、非ディレクトリ等）は隠さない。
      const beneathRoot = path.relative(root, current);
      if (error.code === 'ENOENT' && allowMissing && beneathRoot &&
          beneathRoot !== '..' && !beneathRoot.startsWith(`..${path.sep}`) && !path.isAbsolute(beneathRoot)) return target;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`リンク経由のパスを拒否: ${current}`);
    // path.relative は Windows で大文字小文字を区別せず、単なる文字列前方一致もしない。
    if (path.relative(current, fs.realpathSync.native(current)) !== '') {
      throw new Error(`実体が異なるパスを拒否: ${current}`);
    }
    if (i === parts.length - 1 ? !stat.isFile() : !stat.isDirectory()) {
      throw new Error(`ファイルまたは親ディレクトリの種類が不正: ${current}`);
    }
  }
  return target;
}

function linkURL(raw, source, root) {
  if (/%(?![0-9a-f]{2})/i.test(raw)) throw new Error(`不正なリンクエンコード: ${raw}`);
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    if (url.username || url.password) throw new Error(`認証情報付きリンク: ${raw}`);
    return raw; // 固定コミット・アンカーを含め、既存URLはそのまま保持する。
  }
  if (/^[a-z][a-z0-9+.-]*:|^\/|[\\?<>\s]/i.test(raw)) {
    throw new Error(`未対応リンク: ${raw}`);
  }
  const [target, anchor, extra] = raw.split('#');
  if (extra !== undefined || !raw) throw new Error(`未対応リンク: ${raw}`);
  const decoded = decodeURIComponent(target);
  if (/[\\:\x00-\x1f]/.test(decoded) || decoded.startsWith('/')) throw new Error(`未対応リンク: ${raw}`);
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(source), decoded || path.posix.basename(source)));
  if (relative.startsWith('../') || path.posix.isAbsolute(relative)) throw new Error(`リポジトリ外リンク: ${raw}`);
  checkedFile(root, relative);
  return webRoot + relative.split('/').map(encodeURIComponent).join('/') + (anchor === undefined ? '' : `#${anchor}`);
}

// 通常の単行インラインリンクのみ対応。コード内は変更しない。
// 参照形式・画像・HTML・複雑なラベル等は黙って残さず、対応を決めるまでエラーにする。
export function rewriteLinks(markdown, source, root) {
  let output = '';
  for (let i = 0; i < markdown.length;) {
    const tail = markdown.slice(i);
    if (i === 0 || markdown[i - 1] === '\n') {
      const fence = tail.match(/^ {0,3}(`{3,}|~{3,})[^\n]*\n/);
      if (fence) {
        const close = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},} *$`, 'm');
        const rest = tail.slice(fence[0].length);
        const end = close.exec(rest);
        if (!end) throw new Error('閉じていないコードフェンス');
        const length = fence[0].length + end.index + end[0].length;
        output += tail.slice(0, length); i += length; continue;
      }
    }
    if (tail[0] === '`') {
      const run = tail.match(/^`+/)[0];
      const end = [...tail.slice(run.length).matchAll(/`+/g)].find(m => m[0].length === run.length);
      if (!end) throw new Error('閉じていないコードスパン');
      const length = run.length + end.index + run.length;
      output += tail.slice(0, length); i += length; continue;
    }
    if (tail[0] === '[') {
      const link = tail.match(/^\[([^\[\]\\\n]+)\]\(([^\s()<>]+)\)/);
      if (!link) throw new Error(`未対応リンク構文: ${tail.slice(0, 80)}`);
      output += `[${link[1]}](${linkURL(link[2], source, root)})`;
      i += link[0].length; continue;
    }
    if (tail.startsWith('![') || /^[\]<>]/.test(tail)) throw new Error(`未対応リンク構文: ${tail.slice(0, 80)}`);
    output += markdown[i++];
  }
  return output;
}

export function renderPattern(root, entry) {
  // UTF-8（BOMなし）/ LF / 末尾LF 1個。ハッシュはリンク変換前の正規化本文。
  const source = fs.readFileSync(checkedFile(root, entry.source), 'utf8')
    .replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
  const hash = createHash('sha256').update(source, 'utf8').digest('hex');
  const body = rewriteLinks(source, entry.source, root);
  return `<!-- 機械生成: 直接編集禁止。npm run knowledge:generate で再生成。\n正本: ${entry.source}\n内容SHA256 (UTF-8/LF正規化・リンク変換前): ${hash}\n-->\n\n${body}`;
}

export function syncKnowledge(root = repo, { write = false } = {}) {
  // 全入力・全出力を副作用前に検査。check はディレクトリも作らない。
  for (const entry of patterns) checkedFile(root, entry.output, { allowMissing: true });
  const rendered = patterns.map(entry => ({ ...entry, text: renderPattern(root, entry) }));
  for (const entry of rendered) {
    const output = checkedFile(root, entry.output, { allowMissing: true });
    if (write) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      checkedFile(root, entry.output, { allowMissing: true });
      fs.writeFileSync(output, entry.text, 'utf8');
    } else if (!fs.existsSync(output) || !fs.readFileSync(output).equals(Buffer.from(entry.text, 'utf8'))) {
      throw new Error(`生成物が欠落または未同期: ${entry.output}。npm run knowledge:generate を実行してください。`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && !['--check', '--write'].includes(args[0]))) {
      throw new Error('使い方: node scripts/sync-review-knowledge.mjs [--check|--write]（既定は照合のみ）');
    }
    syncKnowledge(repo, { write: args[0] === '--write' });
    console.log(args[0] === '--write' ? 'レビュー知見を生成しました。' : 'レビュー知見は同期済みです。');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
