/* 单词怪兽生成器：同一个单词永远生成同一只怪兽（按单词做随机种子），纯 SVG，零成本 */
const MonsterArt = (() => {
  function hash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

  function palette(word) {
    const h = hash(word) % 360;
    return {
      h,
      body: `hsl(${h},75%,66%)`,
      dark: `hsl(${h},50%,32%)`,
      light: `hsl(${h},85%,88%)`,
      spot: `hsl(${h},70%,78%)`,
      feet: `hsl(${h},60%,52%)`,
      accent: `hsl(${(h + 150) % 360},75%,62%)`,
    };
  }

  function blobPath(r, cx, cy, rx, ry, n = 9, jit = 0.1) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const k = 1 + (r() * 2 - 1) * jit;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    let d = `M${f(pts[0])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f(c1)} ${f(c2)} ${f(p2)}`;
    }
    return d + "Z";
  }

  function monster(word, emoji, { level = 1, sleepy = false, showEmoji = true } = {}) {
    const r = rng(hash(word) ^ 0x9e3779b9);
    const c = palette(word);
    const cx = 100, cy = 118;
    const rx = 52 + r() * 12, ry = 48 + r() * 12;
    const top = cy - ry;
    const sw = 'stroke="' + c.dark + '" stroke-width="3" stroke-linejoin="round"';
    const back = [], front = [];

    // 头顶装饰（画在身体后面）
    const topType = pick(r, ["horns", "antennae", "ears", "spikes", "unicorn", "none", "horns", "ears"]);
    if (topType === "horns") {
      for (const s of [-1, 1]) back.push(`<path d="M${cx + s * 16},${top + 14} Q${cx + s * 30},${top - 6} ${cx + s * 36},${top - 24} Q${cx + s * 38},${top + 4} ${cx + s * 32},${top + 18}Z" fill="${c.accent}" ${sw}/>`);
    } else if (topType === "antennae") {
      for (const s of [-1, 1]) back.push(`<path d="M${cx + s * 12},${top + 8} Q${cx + s * 18},${top - 14} ${cx + s * 28},${top - 24}" fill="none" ${sw}/><circle cx="${cx + s * 28}" cy="${top - 26}" r="7" fill="${c.accent}" ${sw}/>`);
    } else if (topType === "ears") {
      for (const s of [-1, 1]) back.push(`<circle cx="${cx + s * 36}" cy="${top + 14}" r="16" fill="${c.body}" ${sw}/><circle cx="${cx + s * 36}" cy="${top + 14}" r="8" fill="${c.light}"/>`);
    } else if (topType === "spikes") {
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const x = cx - 30 + (60 / (n - 1)) * i;
        back.push(`<path d="M${x - 9},${top + 12} L${x},${top - 12} L${x + 9},${top + 12}Z" fill="${c.accent}" ${sw}/>`);
      }
    } else if (topType === "unicorn") {
      back.push(`<path d="M${cx - 9},${top + 10} L${cx},${top - 30} L${cx + 9},${top + 10}Z" fill="#ffd54a" ${sw}/>`);
    }

    // 手和脚
    const armUp = r() > 0.5;
    for (const s of [-1, 1]) {
      back.push(`<ellipse cx="${cx + s * (rx - 2)}" cy="${cy + (armUp ? -2 : 10)}" rx="10" ry="17" transform="rotate(${s * (armUp ? -35 : 25)} ${cx + s * (rx - 2)} ${cy + 5})" fill="${c.body}" ${sw}/>`);
      back.push(`<ellipse cx="${cx + s * 22}" cy="${cy + ry - 2}" rx="15" ry="10" fill="${c.feet}" ${sw}/>`);
    }

    // 身体
    const body = `<path d="${blobPath(r, cx, cy, rx, ry)}" fill="${c.body}" ${sw}/>`;

    // 斑点
    const spots = [];
    const nSpots = Math.floor(r() * 4);
    for (let i = 0; i < nSpots; i++) {
      const s = i % 2 ? 1 : -1;
      spots.push(`<circle cx="${cx + s * (28 + r() * 14)}" cy="${cy + 6 + r() * 26}" r="${4 + r() * 5}" fill="${c.spot}"/>`);
    }

    // 肚皮 + 单词 emoji
    front.push(`<ellipse cx="${cx}" cy="${cy + 26}" rx="${rx * 0.52}" ry="22" fill="${c.light}"/>`);
    if (showEmoji) front.push(`<text x="${cx}" y="${cy + 36}" font-size="28" text-anchor="middle">${emoji}</text>`);

    // 眼睛
    const nEyes = pick(r, [1, 2, 2, 2, 3]);
    const ey = cy - 26;
    const eyes = nEyes === 1 ? [[cx, ey, 16]] : nEyes === 2 ? [[cx - 18, ey, 12], [cx + 18, ey, 12]] : [[cx - 25, ey, 9], [cx, ey - 7, 10], [cx + 25, ey, 9]];
    const look = (r() - 0.5) * 4;
    for (const [x, y, er] of eyes) {
      if (sleepy) front.push(`<path d="M${x - er},${y} Q${x},${y + er * 0.7} ${x + er},${y}" fill="none" stroke="${c.dark}" stroke-width="3" stroke-linecap="round"/>`);
      else front.push(`<circle cx="${x}" cy="${y}" r="${er}" fill="#fff" stroke="${c.dark}" stroke-width="2.5"/><circle cx="${x + look}" cy="${y + 1}" r="${er * 0.5}" fill="#2b2140"/><circle cx="${x + look + er * 0.2}" cy="${y - er * 0.2}" r="${er * 0.18}" fill="#fff"/>`);
    }
    // 腮红
    for (const s of [-1, 1]) front.push(`<circle cx="${cx + s * 34}" cy="${cy - 6}" r="6" fill="#ff8fab" opacity=".55"/>`);

    // 嘴巴
    const my = cy - 6;
    const mouthType = sleepy ? "o" : pick(r, ["smile", "open", "fang", "smile", "open"]);
    if (mouthType === "smile") front.push(`<path d="M${cx - 11},${my} Q${cx},${my + 11} ${cx + 11},${my}" fill="none" stroke="${c.dark}" stroke-width="3" stroke-linecap="round"/>`);
    else if (mouthType === "open") front.push(`<path d="M${cx - 11},${my - 1} Q${cx},${my + 17} ${cx + 11},${my - 1}Z" fill="#7a2140" stroke="${c.dark}" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="${cx}" cy="${my + 8}" rx="5" ry="3" fill="#ff7a9a"/>`);
    else if (mouthType === "fang") front.push(`<path d="M${cx - 12},${my} Q${cx},${my + 10} ${cx + 12},${my}" fill="none" stroke="${c.dark}" stroke-width="3" stroke-linecap="round"/><path d="M${cx + 3},${my + 4} L${cx + 6},${my + 11} L${cx + 9},${my + 3}Z" fill="#fff" stroke="${c.dark}" stroke-width="1.5"/>`);
    else front.push(`<ellipse cx="${cx}" cy="${my + 3}" rx="4" ry="5" fill="#7a2140"/>`);

    // 等级装饰
    const deco = [];
    if (level >= 6) back.unshift(`<circle cx="${cx}" cy="${cy}" r="${Math.max(rx, ry) + 26}" fill="url(#glow-${word})"/>`);
    if (level >= 4) deco.push(`<path d="M${cx - 18},${top - 2} L${cx - 22},${top - 22} L${cx - 9},${top - 12} L${cx},${top - 28} L${cx + 9},${top - 12} L${cx + 22},${top - 22} L${cx + 18},${top - 2}Z" fill="#ffd54a" stroke="#c48a00" stroke-width="2" stroke-linejoin="round"/>`);
    if (level >= 3) deco.push(`<text x="28" y="60" font-size="18">✨</text><text x="160" y="80" font-size="14">✨</text>`);
    if (sleepy) deco.push(`<text x="148" y="58" font-size="20" font-weight="700" fill="#6b5b95">z</text><text x="162" y="42" font-size="15" font-weight="700" fill="#6b5b95">z</text>`);

    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="monster${sleepy ? " sleepy" : ""}" role="img" aria-label="${word} monster">
      <defs><radialGradient id="glow-${word}"><stop offset="55%" stop-color="#ffe680" stop-opacity=".9"/><stop offset="100%" stop-color="#ffe680" stop-opacity="0"/></radialGradient></defs>
      ${back.join("")}${body}${spots.join("")}${front.join("")}${deco.join("")}
    </svg>`;
  }

  function egg(word, { hits = 0, locked = false } = {}) {
    const c = palette(word);
    const shell = locked ? "#dcd8e8" : c.light;
    const stroke = locked ? "#b3abc9" : c.dark;
    const spots = locked ? "" : `<circle cx="78" cy="112" r="10" fill="${c.spot}"/><circle cx="122" cy="140" r="13" fill="${c.spot}"/><circle cx="118" cy="82" r="7" fill="${c.spot}"/><circle cx="84" cy="160" r="6" fill="${c.spot}"/>`;
    let cracks = "";
    if (hits >= 1) cracks += `<path d="M70,92 L82,104 L90,92 L100,106 L108,96" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (hits >= 2) cracks += `<path d="M108,96 L118,110 L126,98 L138,112" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    const q = locked ? `<text x="100" y="140" font-size="48" font-weight="800" text-anchor="middle" fill="#b3abc9">?</text>` : "";
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="egg" role="img" aria-label="egg">
      <ellipse cx="100" cy="188" rx="46" ry="7" fill="#000" opacity=".08"/>
      <path d="M100,28 C140,28 160,98 160,130 C160,168 134,186 100,186 C66,186 40,168 40,130 C40,98 60,28 100,28Z" fill="${shell}" stroke="${stroke}" stroke-width="3"/>
      ${spots}${cracks}${q}
    </svg>`;
  }

  return { monster, egg, palette };
})();
