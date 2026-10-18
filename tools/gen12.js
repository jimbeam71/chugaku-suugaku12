// レベル12の問題データ生成: node gen12.js -> src/data.js
// 手書き10問（src/handmade.js）＋ 計算で作る問題。誤答は「よくあるまちがい」から作り、理由も一緒に付ける。
const fs = require('fs'), path = require('path');

let seed = 20261020;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const MINUS = '−';
const lab = v => (v < 0 ? MINUS + (-v) : String(v));
const T = v => String(v);
const fr = (n, d) => '\\dfrac{' + n + '}{' + d + '}';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function lcmBrute(a, b) { for (let x = Math.max(a, b); ; x++) if (x % a === 0 && x % b === 0) return x; }
const key = v => (v == null ? 'null:' + Math.random() : Array.isArray(v) ? v.map(x => x.toFixed(9)).join(',') : v.toFixed(9));

/* 問題を組み立てる。truth={v,tex}, cands=[{v,tex,why}]（先のものほど優先） */
function build(o) {
  const unit = o.unit || '';
  const wrap = (tex, raw) => (raw ? tex : '$' + tex + '$' + unit);
  const seen = [o.truth.tex], seenV = [key(o.truth.v)], wrongs = [];
  for (const c of o.cands) {
    if (wrongs.length >= 3) break;
    if (seen.includes(c.tex)) continue;
    if (!c.same && seenV.includes(key(c.v))) continue;
    seen.push(c.tex); seenV.push(key(c.v)); wrongs.push(c);
  }
  if (wrongs.length < 3) throw new Error(o.id + ': 誤答の候補が足りない');
  const all = shuffle([{ t: wrap(o.truth.tex, o.truth.raw), v: o.truth.v, ok: true }].concat(wrongs.map(c => (c.same ? { t: wrap(c.tex, c.raw), v: c.v, why: c.why, same: true } : { t: wrap(c.tex, c.raw), v: c.v, why: c.why }))));
  const ans = all.findIndex(x => x.ok);
  all.forEach(x => delete x.ok);
  const q = { id: o.id, expr: o.expr, p: o.p, ch: all, ans, steps: o.steps, point: o.point };
  if (o.fig) q.fig = o.fig;
  if (o.figAfter) q.figAfter = o.figAfter;
  return q;
}

/* ---------- 共通の小物 ---------- */
const LT = a => a.join(',\\ ');                                  // 数のならび（TeX）
const dfmt = x => String(+x.toFixed(8));                         // 小数の表示
const divisors = n => { const r = []; for (let i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; };
const reduceF = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const frT = (n, d) => (d === 1 ? String(n) : fr(n, d));           // 分母1なら整数で表示
const Fv = (n, d) => { const [a, b] = reduceF(n, d); return { v: n / d, tex: frT(a, b) }; };
const C = (n, d, why, same) => { const o = { v: n / d, tex: (n * d < 0 ? '-' : '') + frT(Math.abs(n), Math.abs(d)), why }; if (same) o.same = true; return o; };
const mixT = (w, n, d) => String(w) + fr(n, d);
function fracOfDec(x) { const s = Math.round(x * 10000); const g = gcd(s, 10000); return [s / g, 10000 / g]; }
const RAWQ = (id, p, truth, wrongs, steps, point, extra) => build(Object.assign({
  id, expr: '1', p, raw: true, truth: { v: 1, tex: truth, raw: true },
  cands: wrongs.map(([t, why]) => ({ v: null, raw: true, tex: t, why })), steps, point
}, extra || {}));
const lcmOf = (a, b) => a / gcd(a, b) * b;

/* ---------- 共通の小物（レベル12） ---------- */
const fp = n => (n < 0 ? '(' + n + ')' : String(n));       // かっこつきで表示
const sgnWord = s => (s < 0 ? 'マイナス' : 'プラス');
const cnt = a => a.filter(x => x < 0).length;


/* ---------- 文字式の道具 ---------- */
const D = s => (String(s).includes('$') || /[ぁ-んァ-ヶ一-龥]/.test(String(s)) ? s : '$' + s + '$');
// RQ: 4択（式が選択肢）。texはそのまま渡すと $…$ で包む
const RQ = (id, p, t, ws, steps, point, extra) => RAWQ(id, p, D(t), ws.map(([w, why]) => [D(w), why]), steps, point, extra);
// 1次式 a x + b を TeX に
const xt = (a, v) => (a === 1 ? v : a === -1 ? '-' + v : a + v);
const lin = (a, b, v) => { v = v || 'x'; if (a === 0) return String(b); let s = xt(a, v); if (b > 0) s += '+' + b; else if (b < 0) s += '-' + (-b); return s; };
const sgn = n => (n < 0 ? '-' + (-n) : '+' + n);
const num = n => String(n);
// 数値問題（答えがひとつの数）
const NQ = (id, p, t, ws, steps, point, unit) => build({ id, expr: String(t), p, truth: { v: t, tex: dfmt(t) }, cands: ws.map(([v, why]) => ({ v, tex: dfmt(v), why })), steps, point, unit });


/* ---------- 座標グラフの図（SVG） ---------- */
const GR = 6, GS = 22, GC = 150;
const gx = x => GC + GS * x, gy = y => GC - GS * y;
function graph(o) {
  o = o || {};
  const st = (s) => ' style="' + s + '"';
  let s = '<svg viewBox="0 0 300 300" role="img" aria-label="座標平面"' + st('width:100%;max-width:340px;height:auto;display:block;margin:8px auto') + '>';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<line x1="' + gx(i) + '" y1="' + gy(-GR) + '" x2="' + gx(i) + '" y2="' + gy(GR) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
    s += '<line x1="' + gx(-GR) + '" y1="' + gy(i) + '" x2="' + gx(GR) + '" y2="' + gy(i) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
  }
  s += '<line x1="' + gx(-GR - .4) + '" y1="' + GC + '" x2="' + gx(GR + .4) + '" y2="' + GC + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  s += '<line x1="' + GC + '" y1="' + gy(-GR - .4) + '" x2="' + GC + '" y2="' + gy(GR + .4) + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  const tx = 'font:700 10px sans-serif;fill:var(--muted);text-anchor:middle';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<text x="' + gx(i) + '" y="' + (GC + 13) + '"' + st(tx) + '>' + i + '</text>';
    s += '<text x="' + (GC - 9) + '" y="' + (gy(i) + 3.5) + '"' + st(tx) + '>' + i + '</text>';
  }
  s += '<text x="' + (GC - 8) + '" y="' + (GC + 13) + '"' + st(tx) + '>O</text>';
  s += '<text x="' + gx(GR + .4) + '" y="' + (GC + 24) + '"' + st('font:700 12px sans-serif;fill:var(--fg);text-anchor:end') + '>x</text>';
  s += '<text x="' + (GC + 10) + '" y="' + (gy(GR + .4) + 8) + '"' + st('font:700 12px sans-serif;fill:var(--fg)') + '>y</text>';
  (o.lines || []).forEach(a => {                       // y = a x
    const xm = Math.min(GR, GR / Math.abs(a));
    s += '<line x1="' + gx(-xm) + '" y1="' + gy(-a * xm) + '" x2="' + gx(xm) + '" y2="' + gy(a * xm) + '"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
  });
  (o.hyper || []).forEach(a => {                       // y = a / x
    [1, -1].forEach(sg => {
      let pts = [];
      for (let x = Math.abs(a) / GR; x <= GR + 1e-9; x += 0.05) pts.push(gx(sg * x).toFixed(1) + ',' + gy(a / (sg * x)).toFixed(1));
      s += '<polyline points="' + pts.join(' ') + '" fill="none"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
    });
  });
  (o.pts || []).forEach(p => {
    s += '<circle cx="' + gx(p.x) + '" cy="' + gy(p.y) + '" r="4.5"' + st('fill:var(--pos);stroke:var(--card);stroke-width:1.5') + '/>';
    if (p.l) s += '<text x="' + (gx(p.x) + 7) + '" y="' + (gy(p.y) - 6) + '"' + st('font:700 13px sans-serif;fill:var(--pos)') + '>' + p.l + '</text>';
  });
  return { type: 'svg', html: s + '</svg>' };
}
const ct = (x, y) => '(' + x + ',' + y + ')';
const rdc = (n, d) => { const g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return [n, d]; };
const slope = (n, d) => { [n, d] = rdc(n, d); return d === 1 ? (n === 1 ? '' : n === -1 ? '-' : String(n)) + 'x' : (n < 0 ? '-' : '') + '\\dfrac{' + Math.abs(n) + '}{' + d + '}x'; };
const yEq = (n, d) => 'y=' + slope(n, d);
const hyEq = a => 'y=' + (a < 0 ? '-' : '') + '\\dfrac{' + Math.abs(a) + '}{x}';
const QN = ['第1象限', '第2象限', '第3象限', '第4象限'];

const PI = n => (n === 1 ? '\\pi' : n + '\\pi');

const PU = (n, u) => '$' + PI(n) + '$ ' + u;
const S_ = s => ' style="' + s + '"';
const svgW = (h, inner) => '<svg viewBox="0 0 260 ' + h + '" role="img" aria-label="図"' + S_('width:100%;max-width:320px;height:auto;display:block;margin:8px auto') + '>' + inner + '</svg>';
const ln = (x1, y1, x2, y2, c, w, dash) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + S_('stroke:var(' + c + ');stroke-width:' + (w || 2) + ';stroke-linecap:round' + (dash ? ';stroke-dasharray:5 4' : '')) + '/>';
const tx = (x, y, t, a) => '<text x="' + x + '" y="' + y + '"' + S_('font:700 13px sans-serif;fill:var(--fg);text-anchor:' + (a || 'middle')) + '>' + t + '</text>';
const circ = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(--card)"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>';
const TT = s => '$' + s + '$';
const RT = rows => '<table class="rtab">' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';
const SQ = n => '\\sqrt{' + n + '}';
const XS = (...v) => '$x=' + v.join(',\\ ') + '$';
const txc = (x, y, t, c, a) => '<text x="' + x + '" y="' + y + '"' + S_('font:700 14px sans-serif;fill:var(' + c + ');text-anchor:' + (a || 'start')) + '>' + t + '</text>';
function figPara(list) {
  const cx = 130, sx = 26, cy = 100, sy = 11;
  let s = ln(10, cy, 250, cy, '--muted', 1.5) + ln(cx, 5, cx, 195, '--muted', 1.5);
  for (let i = -4; i <= 4; i++) if (i) s += '<text x="' + (cx + sx * i) + '" y="' + (cy + 14) + '"' + S_('font:600 10px sans-serif;fill:var(--muted);text-anchor:middle') + '>' + i + '</text>';
  s += txc(246, cy - 5, 'x', '--muted', 'end') + txc(cx + 6, 14, 'y', '--muted');
  list.forEach(o => {
    let d = '', pen = false;
    for (let k = -40; k <= 40; k++) { const x = k / 10, y = o.a * x * x; if (Math.abs(y) > 8.6) { pen = false; continue; } d += (pen ? 'L' : 'M') + (cx + sx * x).toFixed(1) + ' ' + (cy - sy * y).toFixed(1); pen = true; }
    s += '<path d="' + d + '" fill="none"' + S_('stroke:var(' + o.c + ');stroke-width:2.8') + '/>';
    const xl = Math.min(3.7, Math.sqrt(7 / Math.abs(o.a)));
    s += txc(cx + sx * xl + 5, cy - sy * (o.a > 0 ? 7 : -7) + (o.a > 0 ? 0 : 6), o.l, o.c);
  });
  return { type: 'svg', html: svgW(200, s) };
}
/* ===== パートA: 二次方程式 ===== */
function genNijiA() {
  return [
    RQ('na-1', '$x^2-5x+6=0$ を解くと？', XS(2, 3), [[XS(-2, -3), '$(x-2)(x-3)=0$。$x-2=0$ より $x=+2$。符号がぎゃく。'], [XS(1, 6), '足して $-5$ にならない。かけて 6、足して 5 の2数は、2 と 3。'], [XS(-1, 6), '$(x+1)(x-6)$ は、展開すると $x^2-5x-6$。']], ['因数分解：$(x-2)(x-3)=0$。', '$x-2=0$ または $x-3=0$。'], '$AB=0$ ならば、$A=0$ または $B=0$。'),
    RQ('na-2', '$x^2+2x-15=0$ を解くと？', XS(-5, 3), [[XS(5, -3), '$(x+5)(x-3)=0$。$x+5=0$ より $x=-5$。符号がぎゃく。'], [XS(-5, -3), 'かけて $-15$ になるには、符号がちがう2数。'], [XS(1, -15), '足して $+2$ にならない。']], ['かけて $-15$、足して $+2$ の2数は、$+5$ と $-3$。', '$(x+5)(x-3)=0$。'], '因数分解してから、各かっこを 0 とおく。'),
    RQ('na-3', '$x^2-7x=0$ を解くと？', XS(0, 7), [['$x=7$ だけ', '$x=0$ も解。$x(x-7)=0$。'], [XS(0, -7), '$x-7=0$ より $x=+7$。'], [XS(7, -7), '$x(x-7)=0$ なので、$x=0$ と $7$。']], ['共通因数 $x$ でくくる：$x(x-7)=0$。', '$x=0$ または $x=7$。'], '共通因数でくくる。$x=0$ も解になる。'),
    RQ('na-4', '$x^2=16$ を解くと？', XS('4', '-4'), [['$x=4$ だけ', '平方根は、正と負の2つ。'], [XS('\\pm8'), '16 の平方根は $\\pm4$。$16\\div2=8$ ではない。'], [XS('\\pm256'), '$x^2=16$ の平方根は、$16^2$ ではなく $\\sqrt{16}$。']], ['$x=\\pm\\sqrt{16}=\\pm4$。'], '$x^2=k$ ならば、$x=\\pm\\sqrt{k}$。'),
    RQ('na-5', '$(x-3)^2=25$ を解くと？', XS(8, -2), [['$x=8$ だけ', '$x-3=-5$ のときも考える。$x=-2$。'], [XS(-2, -8), '$x-3=5$ より $x=8$。$x-3=-5$ より $x=-2$。'], [XS(28, -22), '$x=3\\pm5$。$\\pm25$ ではない。']], ['$x-3=\\pm5$。', '$x=3+5=8$、$x=3-5=-2$。'], '$(x-p)^2=k$ は、$x-p=\\pm\\sqrt{k}$ とする。'),
    NQ('na-6', '$x^2-x-12=0$ の、正の解は？', 4, [[3, '$(x-4)(x+3)=0$。$x=-3$ は、負の解。'], [12, '12 は、かけた数。解は、$x=4,\\ -3$。'], [6, '$(x-4)(x+3)=0$。$x=4$ と $x=-3$。']], ['かけて $-12$、足して $-1$ の2数は、$-4$ と $+3$。', '$(x-4)(x+3)=0$。$x=4,\\ -3$。'], '正の解と負の解を、見分ける。'),
    RQ('na-7', '$2x^2-8x=0$ を解くと？', XS(0, 4), [['$x=4$ だけ', '$x=0$ も解。$2x(x-4)=0$。'], [XS(0, 8), '$2x(x-4)=0$。$x=4$。'], [XS(2, 4), '$2$ は定数。$x=2$ は、解ではない。']], ['$2x(x-4)=0$。', '$x=0$ または $x=4$。'], '$2x^2-8x=2x(x-4)$。')
  ];
}
function genNijiB() {
  const f = (a, b, c) => '$x=\\dfrac{' + a + '}{' + c + '}$';
  return [
    RQ('nb-1', '$x^2+3x+1=0$ を解の公式で解くと？', f('-3\\pm\\sqrt{5}', 0, 2), [[f('3\\pm\\sqrt{5}', 0, 2), '$-b=-3$。符号がぎゃく。'], [f('-3\\pm\\sqrt{13}', 0, 2), '$b^2-4ac=9-4=5$。$+4ac$ ではない。'], ['$x=-3\\pm\\sqrt{5}$', '分母の $2a=2$ を、忘れている。']], ['$a=1,\\ b=3,\\ c=1$。', '$b^2-4ac=9-4=5$。$x=\\dfrac{-3\\pm\\sqrt{5}}{2}$。'], '解の公式：$x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$。'),
    RQ('nb-2', '$x^2-5x+3=0$ を解の公式で解くと？', f('5\\pm\\sqrt{13}', 0, 2), [[f('-5\\pm\\sqrt{13}', 0, 2), '$b=-5$ なので、$-b=+5$。'], [f('5\\pm\\sqrt{37}', 0, 2), '$b^2-4ac=25-12=13$。$25+12$ ではない。'], [f('5\\pm\\sqrt{13}', 0, 4), '$2a=2\\times1=2$。4 ではない。']], ['$a=1,\\ b=-5,\\ c=3$。', '$25-12=13$。$x=\\dfrac{5\\pm\\sqrt{13}}{2}$。'], '$b$ が負のとき、$-b$ は正。'),
    RQ('nb-3', '$2x^2+5x+1=0$ を解の公式で解くと？', f('-5\\pm\\sqrt{17}', 0, 4), [[f('-5\\pm\\sqrt{17}', 0, 2), '$2a=2\\times2=4$。'], [f('-5\\pm\\sqrt{33}', 0, 4), '$b^2-4ac=25-8=17$。$25+8$ ではない。'], [f('5\\pm\\sqrt{17}', 0, 4), '$-b=-5$。符号がぎゃく。']], ['$a=2,\\ b=5,\\ c=1$。', '$25-8=17$。$x=\\dfrac{-5\\pm\\sqrt{17}}{4}$。'], '$a\\neq1$ のとき、$4ac$ と $2a$ に注意。'),
    RQ('nb-4', '$x^2-4x+1=0$ を解くと？', '$x=2\\pm\\sqrt{3}$', [['$x=4\\pm\\sqrt{3}$', '分子全体を 2 でわる。$\\dfrac{4\\pm2\\sqrt{3}}{2}$。'], ['$x=2\\pm2\\sqrt{3}$', '$\\sqrt{12}=2\\sqrt{3}$ のあと、4 と $2\\sqrt{3}$ の両方を 2 でわる。'], ['$x=-2\\pm\\sqrt{3}$', '$-b=+4$。符号がぎゃく。']], ['$b^2-4ac=16-4=12$。', '$x=\\dfrac{4\\pm2\\sqrt{3}}{2}=2\\pm\\sqrt{3}$。'], '答えは、約分して、かんたんな形にする。'),
    NQ('nb-5', '$x^2-6x+4=0$ の、$b^2-4ac$ の値は？', 20, [[52, '$-4ac=-16$。$+16$ ではない。'], [32, '$4ac=4\\times1\\times4=16$。4 ではない。'], [-20, '$b^2-4ac$ の順。$36-16=20$。']], ['$b=-6,\\ a=1,\\ c=4$。', '$(-6)^2-4\\times1\\times4=36-16=20$。'], '$b^2$ は、$b$ が負でも、正の数。'),
    RQ('nb-6', '$x^2+4x+4=0$ を解くと？', '$x=-2$', [['$x=2$', '$(x+2)^2=0$。$x+2=0$ より $x=-2$。'], ['$x=\\pm2$', '$(x+2)^2=0$ なので、解は $-2$ だけ。'], ['解なし', '$b^2-4ac=16-16=0$。解は、$x=-2$ が1つ。']], ['$(x+2)^2=0$。', '$x=-2$（解は1つ）。'], '$(x+a)^2=0$ の解は、$x=-a$ の1つだけ。'),
    RQ('nb-7', '$x^2-3x-1=0$ を解くと？', f('3\\pm\\sqrt{13}', 0, 2), [[f('3\\pm\\sqrt{5}', 0, 2), '$c=-1$。$-4ac=+4$。$9+4=13$。'], [f('-3\\pm\\sqrt{13}', 0, 2), '$b=-3$ なので、$-b=+3$。'], [f('3\\pm\\sqrt{13}', 0, 4), '$2a=2$。']], ['$a=1,\\ b=-3,\\ c=-1$。', '$9+4=13$。$x=\\dfrac{3\\pm\\sqrt{13}}{2}$。'], '$c$ が負のとき、$-4ac$ はプラス。')
  ];
}
function genNijiC() {
  return [
    NQ('nc-1', '連続する2つの正の整数の積が 56。小さいほうの数は？', 7, [[8, '8 は、大きいほう。小さいほうは 7。'], [-8, '正の整数なので、負の解は使えない。'], [28, '56 を 2 でわった数。$x(x+1)=56$。']], ['小さいほうを $x$ とすると、$x(x+1)=56$。', '$(x+8)(x-7)=0$。$x=7$（正）。'], '解が問題に合うかを、確かめる。'),
    NQ('nc-2', '正方形の1辺を 3 cm のばしたら、面積が 49 cm² になった。もとの1辺は？', 4, [[7, '7 cm は、のばしたあとの1辺。'], [46, '$49-3$ ではない。$(x+3)^2=49$。'], [10, '$x+3=7$。$x=4$。']], ['もとの1辺を $x$ とすると、$(x+3)^2=49$。', '$x+3=7$、$x=4$（$-7$ は不適）。'], '長さは、正の数。負の解は、使えない。', 'cm'),
    NQ('nc-3', '縦が横より 3 cm 長い長方形で、面積が 40 cm²。横の長さは？', 5, [[8, '8 cm は、縦の長さ。'], [-8, '長さは、負にならない。'], [3, '3 cm は、縦と横のちがい。']], ['横を $x$ とすると、縦は $x+3$。', '$x(x+3)=40$。$(x+8)(x-5)=0$。$x=5$。'], '求めるものを $x$ とおく。', 'cm'),
    RQ('nc-4', 'ある数 $x$ を2乗して 5 を足すと、$x$ の 6倍になった。$x$ は？', XS(1, 5), [[XS(-1, -5), '$x^2-6x+5=0$。$(x-1)(x-5)=0$。'], [XS(1, 6), '$(x-1)(x-6)$ は、$x^2-7x+6$。'], [XS(2, 3), '$(x-2)(x-3)$ は、$x^2-5x+6$。']], ['$x^2+5=6x$。', '$x^2-6x+5=0$、$(x-1)(x-5)=0$。'], '式を $=0$ の形にする。'),
    RQ('nc-5', 'ある数 $x$ の2乗が、$x$ の 2倍より 8 大きい。$x$ は？', XS(4, -2), [[XS(-4, 2), '$(x-4)(x+2)=0$。符号がぎゃく。'], [XS(4, 8), '$x^2=2x+8$。$x^2-2x-8=0$。'], ['$x=4$ だけ', '「ある数」は、負でもよい。$x=-2$ も解。']], ['$x^2=2x+8$。', '$x^2-2x-8=0$、$(x-4)(x+2)=0$。'], '「ある数」は、負の数でもよい。'),
    NQ('nc-6', '$x=2$ が $x^2+ax-10=0$ の解のとき、$a$ の値は？', 3, [[-3, '$4+2a-10=0$。$2a=6$。$a=+3$。'], [-7, '$-10$ を移項するとき、$+10$。$2a=6$。'], [6, '$2a=6$。2 でわって、$a=3$。']], ['$x=2$ を代入：$4+2a-10=0$。', '$2a=6$、$a=3$。'], '解を代入すると、$a$ の方程式になる。'),
    RQ('nc-7', '$x^2=3x$ を、両辺を $x$ でわって $x=3$ とした。正しい答えは？', XS(0, 3), [['$x=3$ だけ', '$x$ でわると、$x=0$ の解が消える。'], [XS(0, -3), '$x(x-3)=0$。$x=3$。'], [XS('\\pm3'), '$x^2=3x$ は、$x^2=9$ ではない。']], ['$x^2-3x=0$。', '$x(x-3)=0$。$x=0$ または $x=3$。'], '文字でわらないで、移項して因数分解。')
  ];
}
/* ===== パートB: 関数 y=ax² ===== */
function genGraph() {
  return [
    NQ('fg-1', '$y=2x^2$ で、$x=-3$ のとき、$y$ は？', 18, [[-18, '$x^2=(-3)^2=9$。9 は正の数。'], [36, '$(2x)^2$ ではなく、$2\\times x^2$。'], [-6, '$2\\times x$ ではなく、$2\\times x^2$。']], ['$x^2=(-3)^2=9$。', '$y=2\\times9=18$。'], '$x^2$ は、$x$ が負でも、正の数。'),
    RQ('fg-2', '$y$ が $x^2$ に比例し、$x=2$ のとき $y=12$。式は？', 'y=3x^2', [['y=6x^2', '$12=a\\times2^2=4a$。$a=3$。'], ['y=12x^2', '$12=a\\times4$。$a=3$。'], ['y=\\dfrac{12}{x^2}', '$x^2$ に比例なので、$y=ax^2$。']], ['$y=ax^2$ に代入：$12=4a$。', '$a=3$。$y=3x^2$。'], '$y$ が $x^2$ に比例 → $y=ax^2$。'),
    RQ('fg-3', '$y=ax^2$ のグラフの対称軸は？', '$y$ 軸', [['$x$ 軸', 'グラフは、$y$ 軸について、左右対称。'], ['直線 $y=x$', '放物線は、$y$ 軸について対称。'], ['対称ではない', '$y$ 軸について、左右対称。']], ['$x$ と $-x$ で、$y$ が同じ。', '$y$ 軸について対称。'], '放物線の頂点は原点、対称軸は $y$ 軸。'),
    Object.assign(RQ('fg-4', '図で、いちばん細い（$y$ 軸にせまい）グラフ ア の式は？', 'y=2x^2', [['y=x^2', 'これは、イ。中くらいの広さ。'], ['y=\\dfrac{1}{2}x^2', 'これは、ウ。いちばん広い。'], ['y=-2x^2', '下にひらくグラフ。アは、上にひらく。']], ['$a$ が大きいほど、グラフは細くなる。', 'ア は $a=2$。'], '$|a|$ が大きいほど、$y$ 軸にせまい。'), { fig: figPara([{ a: 2, c: '--pos', l: 'ア' }, { a: 1, c: '--neg', l: 'イ' }, { a: 0.5, c: '--fg', l: 'ウ' }]) }),
    RQ('fg-5', 'グラフが、下にひらくのは？', 'y=-3x^2', [['y=3x^2', '$a>0$ は、上にひらく。'], ['y=\\dfrac{1}{3}x^2', '$a>0$ は、上にひらく。'], ['y=\\dfrac{3}{x}', 'これは反比例。']], ['$a<0$ のとき、下にひらく。'], '$a>0$ → 上にひらく、$a<0$ → 下にひらく。'),
    NQ('fg-6', '$y=ax^2$ が、点 $(2,\\ -8)$ を通る。$a$ の値は？', -2, [[2, '$-8=4a$。$a=-2$。符号に注意。'], [-4, '$-8\\div2$ ではなく、$-8\\div4$。'], [-16, '$-8\\times2$ ではなく、$-8\\div4$。']], ['$x=2,\\ y=-8$ を代入。', '$-8=a\\times4$。$a=-2$。'], '通る点を代入して、$a$ を求める。'),
    RQ('fg-7', '$y=ax^2$ で、$|a|$ が大きいほど、グラフは？', '$y$ 軸にせまくなる（細くなる）', [['ひろがる（広くなる）', '$|a|$ が小さいほど、広がる。'], ['変わらない', '$a$ で、ひらき方が変わる。'], ['$x$ 軸に近づく', '$|a|$ が小さいほど、$x$ 軸に近づく。']], ['同じ $x$ で、$|y|$ が大きくなる。', 'グラフは、$y$ 軸にせまくなる。'], '$|a|$ が大きい → せまい、小さい → 広い。')
  ];
}
function genHenka() {
  return [
    NQ('fh-1', '$y=x^2$ で、$x$ が 1 から 3 まで増えるときの、変化の割合は？', 4, [[2, '$x$ の増加量 2 は、わる数。$y$ の増加量は 8。'], [8, '8 は、$y$ の増加量。$x$ の増加量 2 でわる。'], [9, '$3^2=9$。変化の割合は、$\\dfrac{y\\text{の増加量}}{x\\text{の増加量}}$。']], ['$x=1$ のとき $y=1$、$x=3$ のとき $y=9$。', '$\\dfrac{9-1}{3-1}=\\dfrac{8}{2}=4$。'], '変化の割合 ＝ $y$ の増加量 ÷ $x$ の増加量。'),
    NQ('fh-2', '$y=2x^2$ で、$x$ が $-1$ から 3 まで増えるときの、変化の割合は？', 4, [[16, '16 は、$y$ の増加量。$x$ の増加量 4 でわる。'], [8, '$x$ の増加量は、$3-(-1)=4$。'], [2, '2 は、$a$。変化の割合は、$a(p+q)=2\\times2$。']], ['$y$：$2$ から $18$。増加量 16。', '$x$ の増加量は 4。$16\\div4=4$。'], '$a(p+q)$ を使うと、すぐに求まる。'),
    NQ('fh-3', '$y=-x^2$ で、$x$ が 2 から 4 まで増えるときの、変化の割合は？', -6, [[-12, '$-12$ は、$y$ の増加量。$x$ の増加量 2 でわる。'], [6, '符号に注意。$y$ は $-4$ から $-16$ へ、減っている。'], [-8, '$y$ の増加量は $-16-(-4)=-12$。']], ['$y$：$-4$ から $-16$。増加量 $-12$。', '$\\dfrac{-12}{2}=-6$。'], '$y$ が減るときは、変化の割合は負。'),
    RQ('fh-4', '$y=x^2$ で、$-2\\leqq x\\leqq3$ のときの、$y$ の変域は？', '$0\\leqq y\\leqq9$', [['$4\\leqq y\\leqq9$', '$x=0$ のとき、$y=0$。0 が最小。'], ['$-2\\leqq y\\leqq3$', '$y$ の値は、$x^2$ で求める。'], ['$0\\leqq y\\leqq4$', '$x=3$ で、$y=9$。9 が最大。']], ['$x=0$ で最小 $y=0$。', '$x=3$ で最大 $y=9$。'], '$x=0$ をふくむときは、最小値が 0。'),
    RQ('fh-5', '$y=-2x^2$ で、$1\\leqq x\\leqq3$ のときの、$y$ の変域は？', '$-18\\leqq y\\leqq-2$', [['$-2\\leqq y\\leqq-18$', '小さいほうを、左に書く。'], ['$-18\\leqq y\\leqq0$', '$x=1$ のとき $y=-2$。0 にはならない。'], ['$2\\leqq y\\leqq18$', '$a<0$ なので、$y$ は負。']], ['$x=1$ で $y=-2$、$x=3$ で $y=-18$。', '小さいほうから書く：$-18\\leqq y\\leqq-2$。'], '$x=0$ をふくまないときは、両端の値で。'),
    NQ('fh-6', '$y=ax^2$ で、$x$ が 1 から 3 まで増えるときの変化の割合が 8。$a$ の値は？', 2, [[4, '$a(1+3)=8$。$4a=8$。$a=2$。'], [8, '8 は、変化の割合そのもの。'], [6, '$a(1+3)=8$ より、$a=2$。']], ['変化の割合 ＝ $a(p+q)$。', '$a(1+3)=8$。$a=2$。'], '$a(p+q)$ の公式で、$a$ を求める。'),
    RQ('fh-7', '$y=x^2$ の変化の割合は？', '一定ではない', [['いつも 2', '$x$ の範囲で、変わる。'], ['いつも 1', '$a=1$ だが、変化の割合は $p+q$ で変わる。'], ['いつも 0', '0 ではない。']], ['1→3 では 4、2→3 では 5。', '範囲によって、変わる。'], '二乗に比例する関数は、変化の割合が一定でない。')
  ];
}
function genRiyou() {
  return [
    NQ('fr-1', '物を落とすと、$x$ 秒間で $y=5x^2$ m 落ちる。2秒間では？', 20, [[10, '$5\\times2$ ではなく、$5\\times2^2$。'], [100, '$(5\\times2)^2$ ではなく、$5\\times2^2$。'], [40, '$2^2=4$。$5\\times4=20$。']], ['$y=5\\times2^2=5\\times4=20$。'], '$x^2$ を先に計算してから、$a$ をかける。', 'm'),
    NQ('fr-2', 'ブレーキを踏んでからの距離は、速さ $x$ km/時 で $y=0.004x^2$ m。$x=50$ のとき、$y$ は？', 10, [[0.2, '$0.004\\times50$ ではなく、$0.004\\times50^2$。'], [100, '$0.004\\times2500=10$。'], [1, '$50^2=2500$。']], ['$50^2=2500$。', '$y=0.004\\times2500=10$。'], '速さが2倍になると、距離は4倍になる。', 'm'),
    NQ('fr-3', '$y=x^2$ のグラフ上の、$x=2$ の点Aと、$x=-3$ の点Bを通る直線の、傾きは？', -1, [[1, '符号に注意。$a(p+q)=1\\times(2-3)=-1$。'], [5, '5 は、$y$ の差。$x$ の差でわる。'], [-5, '$y$ の差 5 を、$x$ の差 $-5$ でわる。']], ['$A(2,4)$、$B(-3,9)$。', '傾き $=\\dfrac{9-4}{-3-2}=-1$。'], '放物線上の2点を通る直線の傾き ＝ 変化の割合。'),
    NQ('fr-4', '$y=ax^2$ のグラフが、点 $(3,18)$ を通る。$a$ の値は？', 2, [[6, '$18\\div3$ ではなく、$18\\div3^2$。'], [54, '$18\\times3$ ではない。'], [9, '$3^2=9$ は、$x^2$。$18\\div9=2$。']], ['$18=a\\times3^2=9a$。', '$a=2$。'], '通る点を代入して、$a$ を求める。'),
    RQ('fr-5', '$y=\\dfrac{1}{2}x^2$ のグラフ上で、$y=8$ のとき、$x$ は？', XS(4, -4), [['$x=4$ だけ', '放物線は、左右対称。$x=-4$ もある。'], [XS('\\pm16'), '$x^2=16$。$x=\\pm4$。'], [XS('\\pm8'), '$\\dfrac{1}{2}x^2=8$。$x^2=16$。']], ['$\\dfrac{1}{2}x^2=8$。$x^2=16$。', '$x=\\pm4$。'], '$y$ の値から $x$ を求めると、正負2つ。'),
    RQ('fr-6', '$y=x^2$ と $y=2x+3$ の、交点の $x$ 座標は？', XS(3, -1), [[XS(-3, 1), '$x^2=2x+3$。$x^2-2x-3=0$。$(x-3)(x+1)=0$。'], ['$x=3$ だけ', '交点は、2つある。$x=-1$ も。'], [XS(1, 3), '$(x-1)(x-3)=x^2-4x+3$。']], ['$x^2=2x+3$。', '$x^2-2x-3=0$、$(x-3)(x+1)=0$。'], '交点は、2つの式を $=$ でむすんで解く。'),
    NQ('fr-7', '$y=-\\dfrac{1}{2}x^2$ で、$x=4$ のとき、$y$ は？', -8, [[8, '$a=-\\dfrac{1}{2}$ なので、$y$ は負。'], [-2, '$x$ ではなく、$x^2=16$ をかける。'], [-32, '$-\\dfrac{1}{2}\\times16=-8$。']], ['$x^2=16$。', '$y=-\\dfrac{1}{2}\\times16=-8$。'], '$a$ が分数でも、$x^2$ を先に計算。')
  ];
}
const I = {
  na: '<b>二次方程式</b>：$ax^2+bx+c=0$ の形。<br>① <b>因数分解</b>：$(x-p)(x-q)=0$ → $x=p,\\ q$。<br>② <b>平方根</b>：$x^2=k$ → $x=\\pm\\sqrt{k}$。$(x-p)^2=k$ → $x=p\\pm\\sqrt{k}$。<br>共通因数でくくれば、$x=0$ も解になる。',
  nb: '因数分解できないときは、<b>解の公式</b>。<br>$ax^2+bx+c=0$ の解は、<br>$x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$。<br>$a$、$b$、$c$ を、符号ごと、そのまま入れる。',
  nc: '文章題の手順：<br>① 求めるものを $x$ とおく。<br>② 式をつくり、$=0$ の形にして解く。<br>③ <b>解が問題に合うか</b>、確かめる（長さは正、整数など）。',
  fg: '$y=ax^2$ のグラフは<b>放物線</b>。<br>原点が頂点、$y$ 軸について対称。<br>$a>0$ なら上にひらき、$a<0$ なら下にひらく。<br>$|a|$ が大きいほど、$y$ 軸にせまい。' + figPara([{ a: 1, c: '--pos', l: 'a＞0' }, { a: -0.5, c: '--neg', l: 'a＜0' }]).html,
  fh: '<b>変化の割合</b> ＝ $y$ の増加量 ÷ $x$ の増加量。<br>$y=ax^2$ では一定でない。<br>$x$ が $p$ から $q$ まで：変化の割合 ＝ $a(p+q)$。<br><b>変域</b>：$x=0$ をふくむなら、$a>0$ で最小 0、$a<0$ で最大 0。',
  fr: '$y=ax^2$ の利用：<br>・通る点を代入して、$a$ を求める。<br>・$y$ の値から、$x$ を求める（$\\pm$ が2つ）。<br>・放物線と直線の交点は、2つの式を等しいとおいて、二次方程式を解く。'
};
const ABOUT = {
  niji: [
    { p: '<b>二次方程式</b>は、3つの解き方がある。' },
    { p: RT([['因数分解', '→', '$(x-p)(x-q)=0$'], ['平方根', '→', '$x=\\pm\\sqrt{k}$'], ['解の公式', '→', '$\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$']]) },
    { cap: 'まず、因数分解できるか、考える。' }
  ],
  kan: [
    { p: '<b>$y=ax^2$</b> は、$x^2$ に比例する関数。' },
    { p: RT([['グラフ', '→', '放物線'], ['$a>0$', '→', '上にひらく'], ['変化の割合', '→', '$a(p+q)$']]) },
    { cap: '$a$ で、ひらき方と広さが決まる。' }
  ]
};
const PARTS = [
  {
    id: 'niji', title: '二次方程式', sub: '解き方・解の公式・利用', about: ABOUT.niji, aboutTitle: 'まず見てみよう：二次方程式', aboutSub: '3つの解き方',
    steps: [
      { id: 'niji-1', title: '因数分解と平方根', sub: '因数分解・平方根で解く', intro: I.na, qs: genNijiA() },
      { id: 'niji-2', title: '解の公式', sub: '公式で解く', intro: I.nb, qs: genNijiB() },
      { id: 'niji-3', title: '二次方程式の利用', sub: '文章題', intro: I.nc, qs: genNijiC() }
    ]
  },
  {
    id: 'kan', title: '関数 y＝ax²', sub: 'グラフ・変化の割合・利用', about: ABOUT.kan, aboutTitle: 'まず見てみよう：関数 y＝ax²', aboutSub: '放物線',
    steps: [
      { id: 'kan-1', title: '式とグラフ', sub: '放物線', intro: I.fg, qs: genGraph() },
      { id: 'kan-2', title: '変化の割合と変域', sub: 'a(p+q)', intro: I.fh, qs: genHenka() },
      { id: 'kan-3', title: '関数の利用', sub: '代入・交点', intro: I.fr, qs: genRiyou() }
    ]
  }
];
const RBM = { '二次方程式': 'にじほうていしき', '解の公式': 'かいのこうしき', '因数分解': 'いんすうぶんかい', '共通因数': 'きょうつういんすう', '平方根': 'へいほうこん', '放物線': 'ほうぶつせん', '変化の割合': 'へんかのわりあい', '変域': 'へんいき', '対称軸': 'たいしょうじく', '対称': 'たいしょう', '比例': 'ひれい', '反比例': 'はんぴれい', '原点': 'げんてん', '頂点': 'ちょうてん', '交点': 'こうてん', '座標': 'ざひょう', '関数': 'かんすう', '移項': 'いこう', '代入': 'だいにゅう', '増加量': 'ぞうかりょう' };
const RBR = new RegExp(Object.keys(RBM).sort((a, b) => b.length - a.length).join('|'), 'g');
const RB = s => s.replace(RBR, w => '<ruby>' + w + '<rt>' + RBM[w] + '</rt></ruby>');
const ruby = o => typeof o === 'string' ? o.split(/(<svg[\s\S]*?<\/svg>)/).map((t, k) => k % 2 ? t : RB(t)).join('')
  : Array.isArray(o) ? o.map(ruby) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (k === 'expr' || k === 'id' || k === 'html') ? v : ruby(v)])) : o;
const out = '// 自動生成（node gen12.js）。手で直すときは gen12.js を直す。\nconst PARTS = ' + JSON.stringify(ruby(PARTS)) + ';\nif (typeof module !== \'undefined\') module.exports = PARTS;\n';
fs.writeFileSync(path.join(__dirname, 'src/data.js'), out);
let n = 0; PARTS.forEach(P => P.steps.forEach(s => { n += s.qs.length; }));
console.log('src/data.js を作成：' + n + '問、' + (out.length / 1024).toFixed(0) + 'KB');
