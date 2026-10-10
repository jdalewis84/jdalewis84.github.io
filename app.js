/* Road Code Quest — game engine. Vanilla JS, no dependencies, works fully offline. */
(() => {
  'use strict';

  // ---------- Content ----------
  const UNITS = window.RQ_UNITS;
  const QB = [];
  const QBY = {};
  UNITS.forEach((u, ui) => {
    u.index = ui;
    u.q.forEach((row, i) => {
      const q = { id: `${u.id}-${i}`, unit: u.id, text: row[0], opts: row[1], exp: row[2], sign: row[3] || null };
      QB.push(q);
      QBY[q.id] = q;
    });
  });
  const UNIT_BY = Object.fromEntries(UNITS.map((u) => [u.id, u]));

  const LESSON_SIZE = 10;
  const MOCK_SIZE = 35;
  const MOCK_PASS = 32;
  const SPEED_SECONDS = 60;
  const SRS_DAYS = [0, 1, 3, 7, 14, 30];
  const FREEZE_COST = 60;
  const DAY = 86400000;

  const TITLES = [
    [1, 'Passenger'], [2, 'Learner'], [4, 'Restricted'], [6, 'Full Licence'],
    [9, 'Road Scholar'], [12, 'Road Legend'], [16, 'Aotearoa Ace'],
  ];
  const VEHICLES = [
    { e: '🚗', lvl: 1, name: 'Hatchback' }, { e: '🚙', lvl: 3, name: 'SUV' },
    { e: '🛻', lvl: 5, name: 'Ute' }, { e: '🚐', lvl: 7, name: 'Campervan' },
    { e: '🏍️', lvl: 9, name: 'Motorbike' }, { e: '🚜', lvl: 11, name: 'Tractor' },
    { e: '🏎️', lvl: 14, name: 'Race car' }, { e: '🚀', lvl: 18, name: 'Rocket (not road legal)' },
  ];
  const PRAISE = ['Ka pai!', 'Sweet as!', 'Choice!', 'Tu meke!', 'Mean as!', 'Good as gold!', 'Nailed it!', 'Spot on!'];
  const CONSOLE = ['Not quite', 'Close one!', 'Kia kaha, nearly!', 'Good try'];

  // ---------- Utilities ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a, rnd = Math.random) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const dateStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / DAY);
  const seeded = (str) => {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  };

  // ---------- State ----------
  const KEY = 'roadcodequest.v1';
  const DEFAULT = () => ({
    v: 1, xp: 0, coins: 0, goal: 50, vehicle: '🚗', onboarded: false, installDismissed: false,
    daily: { date: '', xp: 0, challengeDone: '' },
    streak: { count: 0, best: 0, last: '', freezes: 1 },
    units: {}, qs: {}, badges: {},
    stats: { answered: 0, correct: 0, bestCombo: 0, speedBest: 0, mockBest: 0, mockPasses: 0, lessons: 0, perfects: 0, reviews: 0, goalsHit: 0, signsRight: 0 },
    settings: { sound: true, unlockAll: false },
  });
  const merge = (base, saved) => {
    for (const k in saved) {
      if (saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k]) && base[k] && typeof base[k] === 'object') merge(base[k], saved[k]);
      else base[k] = saved[k];
    }
    return base;
  };
  let st;
  try { st = merge(DEFAULT(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { st = DEFAULT(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* storage full or blocked */ } };
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const rollDay = () => {
    const t = dateStr();
    if (st.daily.date !== t) { st.daily.date = t; st.daily.xp = 0; }
  };
  rollDay();

  // ---------- Derived ----------
  const xpForLevel = (L) => 50 * L * (L - 1);
  const levelOf = (xp) => { let L = 1; while (xp >= xpForLevel(L + 1)) L++; return L; };
  const titleOf = (L) => TITLES.filter(([l]) => L >= l).pop()[1];
  const liveStreak = () => {
    const s = st.streak;
    if (!s.last) return 0;
    const gap = daysBetween(s.last, dateStr());
    return gap <= 1 + s.freezes ? s.count : 0;
  };
  const unitUnlocked = (i) => st.settings.unlockAll || i === 0 || (st.units[UNITS[i - 1].id] || {}).stars > 0;
  const allUnitsDone = () => UNITS.every((u) => (st.units[u.id] || {}).stars > 0);
  const mastery = (uid) => {
    const qs = QB.filter((q) => q.unit === uid);
    return Math.round((qs.reduce((n, q) => n + Math.min((st.qs[q.id] || {}).box || 0, 4), 0) / (qs.length * 4)) * 100);
  };
  const dueList = () => {
    const now = Date.now();
    return QB.filter((q) => st.qs[q.id] && st.qs[q.id].due <= now);
  };

  // ---------- Sound ----------
  let actx;
  const tone = (freq, start, dur, type = 'sine', vol = 0.18) => {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, actx.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, actx.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + start + dur);
    o.connect(g).connect(actx.destination);
    o.start(actx.currentTime + start);
    o.stop(actx.currentTime + start + dur + 0.05);
  };
  const sfx = (name) => {
    if (!st.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      if (name === 'right') { tone(660, 0, 0.12, 'triangle'); tone(990, 0.09, 0.2, 'triangle'); }
      else if (name === 'wrong') { tone(180, 0, 0.25, 'sawtooth', 0.09); tone(140, 0.12, 0.3, 'sawtooth', 0.08); }
      else if (name === 'combo') { tone(784, 0, 0.1, 'square', 0.07); tone(1047, 0.08, 0.1, 'square', 0.07); tone(1319, 0.16, 0.18, 'square', 0.07); }
      else if (name === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle'));
      else if (name === 'level') [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.35, 'triangle', 0.15));
      else if (name === 'tick') tone(1200, 0, 0.04, 'square', 0.04);
    } catch { /* audio unavailable */ }
  };
  const buzz = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };

  // ---------- Confetti ----------
  const confetti = (amount = 140) => {
    const c = $('#confetti');
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#facc15', '#22c55e', '#0ea5e9', '#ef4444', '#a855f7', '#f97316', '#fff'];
    const parts = Array.from({ length: amount }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
      r: Math.random() * 6 + 4, c: pick(colors), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    }));
    const t0 = performance.now();
    const frame = (t) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
      });
      if (t - t0 < 3000) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    requestAnimationFrame(frame);
  };

  // ---------- Toasts & modals ----------
  const toast = (html, ms = 2600) => {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 400);
  };
  const modal = (html) => {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-card pop">${html}</div>`;
    m.hidden = false;
  };
  const closeModal = () => { $('#modal').hidden = true; $('#modal').innerHTML = ''; };
  const sheet = (html) => {
    const s = $('#sheet');
    s.innerHTML = `<div class="sheet-card"><div class="grab"></div>${html}</div>`;
    s.hidden = false;
    requestAnimationFrame(() => s.classList.add('open'));
  };
  const closeSheet = () => {
    const s = $('#sheet');
    s.classList.remove('open');
    setTimeout(() => { s.hidden = true; s.innerHTML = ''; }, 220);
  };

  // ---------- Badges ----------
  const BADGES = [
    { id: 'first', e: '🚦', name: 'Green Light', desc: 'Finish your first lesson', ok: () => st.stats.lessons >= 1 },
    { id: 'perfect', e: '💎', name: 'Flawless', desc: 'Finish a lesson with no mistakes', ok: () => st.stats.perfects >= 1 },
    { id: 'perfect5', e: '👑', name: 'Perfectionist', desc: '5 flawless lessons', ok: () => st.stats.perfects >= 5 },
    { id: 'combo10', e: '🔥', name: 'On Fire', desc: '10 correct in a row', ok: () => st.stats.bestCombo >= 10 },
    { id: 'combo25', e: '☄️', name: 'Unstoppable', desc: '25 correct in a row', ok: () => st.stats.bestCombo >= 25 },
    { id: 'streak3', e: '📅', name: 'Habit Forming', desc: '3-day streak', ok: () => st.streak.best >= 3 },
    { id: 'streak7', e: '🗓️', name: 'Week Warrior', desc: '7-day streak', ok: () => st.streak.best >= 7 },
    { id: 'streak30', e: '🏔️', name: 'Long Haul', desc: '30-day streak', ok: () => st.streak.best >= 30 },
    { id: 'c100', e: '💯', name: 'Century', desc: '100 correct answers', ok: () => st.stats.correct >= 100 },
    { id: 'c500', e: '🎓', name: 'Scholar', desc: '500 correct answers', ok: () => st.stats.correct >= 500 },
    { id: 'signs', e: '🪧', name: 'Sign Spotter', desc: '25 sign questions right', ok: () => st.stats.signsRight >= 25 },
    { id: 'speed15', e: '⚡', name: 'Quick Draw', desc: 'Score 15+ in a Speed Run', ok: () => st.stats.speedBest >= 15 },
    { id: 'speed25', e: '🏎️', name: 'Lightning', desc: 'Score 25+ in a Speed Run', ok: () => st.stats.speedBest >= 25 },
    { id: 'welly', e: '🌬️', name: 'Windy Welly', desc: 'Reach Wellington', ok: () => UNITS.some((u, i) => u.town === 'Wellington' && unitUnlocked(i)) },
    { id: 'bluff', e: '🦪', name: 'Cape to Bluff', desc: 'Complete every stop on the journey', ok: allUnitsDone },
    { id: 'allstars', e: '🌟', name: 'Star Collector', desc: '3 stars on every stop', ok: () => UNITS.every((u) => (st.units[u.id] || {}).stars === 3) },
    { id: 'mock', e: '🏁', name: 'Test Ready', desc: 'Pass a mock theory test', ok: () => st.stats.mockPasses >= 1 },
    { id: 'mock35', e: '🏆', name: 'Perfect Paper', desc: 'Score 35/35 on a mock test', ok: () => st.stats.mockBest >= 35 },
    { id: 'review5', e: '🧠', name: 'Memory Palace', desc: 'Complete 5 Smart Reviews', ok: () => st.stats.reviews >= 5 },
    { id: 'goal7', e: '🎯', name: 'Goal Getter', desc: 'Hit your daily goal 7 times', ok: () => st.stats.goalsHit >= 7 },
    { id: 'night', e: '🦉', name: 'Night Owl', desc: 'Study after 10pm', ok: (c) => c && c.hour >= 22 },
    { id: 'early', e: '🐦', name: 'Early Bird', desc: 'Study before 7am', ok: (c) => c && c.hour < 7 },
    { id: 'master', e: '🥝', name: 'Road Code Master', desc: '100% mastery on every stop', ok: () => UNITS.every((u) => mastery(u.id) === 100) },
  ];
  const checkBadges = (ctx) => {
    const fresh = [];
    BADGES.forEach((b) => {
      if (!st.badges[b.id] && b.ok(ctx)) { st.badges[b.id] = Date.now(); fresh.push(b); }
    });
    return fresh;
  };

  // ---------- Progress mutations ----------
  const touchStreak = () => {
    const t = dateStr();
    const s = st.streak;
    if (s.last === t) return false;
    const gap = s.last ? daysBetween(s.last, t) : 99;
    if (gap === 1) s.count++;
    else if (gap > 1 && gap - 1 <= s.freezes) { s.freezes -= gap - 1; s.count++; toast(`🧊 Streak freeze used: your ${s.count - 1}-day streak survived!`); }
    else s.count = 1;
    s.last = t;
    if (s.count > s.best) s.best = s.count;
    if (s.count % 7 === 0 && s.freezes < 2) { s.freezes++; toast('🧊 +1 streak freeze for a 7-day streak!'); }
    return true;
  };
  const recordAnswer = (q, right) => {
    const r = st.qs[q.id] || (st.qs[q.id] = { box: 0, due: 0, right: 0, wrong: 0 });
    if (right) { r.right++; r.box = Math.min(5, r.box + 1); } else { r.wrong++; r.box = 0; }
    r.due = Date.now() + SRS_DAYS[r.box] * DAY - (r.box ? 3600000 : 0);
  };

  // ---------- Session building ----------
  const item = (id, retry = false) => ({ id, retry, order: shuffle([0, 1, 2, 3]) });
  const weakest = (pool, n) => shuffle(pool).sort((a, b) => ((st.qs[a.id] || {}).box || 0) - ((st.qs[b.id] || {}).box || 0)).slice(0, n);
  const unlockedPool = () => QB.filter((q) => unitUnlocked(UNIT_BY[q.unit].index));

  const build = {
    lesson: (uid) => weakest(QB.filter((q) => q.unit === uid), LESSON_SIZE),
    review: () => {
      let qs = shuffle(dueList()).sort((a, b) => st.qs[a.id].box - st.qs[b.id].box).slice(0, 10);
      if (qs.length < 8) {
        const extra = weakest(unlockedPool().filter((q) => !qs.includes(q)), 8 - qs.length);
        qs = qs.concat(extra);
      }
      return qs;
    },
    mistakes: () => weakest(QB.filter((q) => (st.qs[q.id] || {}).wrong > 0 && st.qs[q.id].box < 3), 10),
    signs: () => shuffle(QB.filter((q) => q.sign)).slice(0, 10),
    daily: () => shuffle(QB, seeded('daily' + dateStr())).slice(0, 5),
    mock: () => {
      // Spread questions evenly across all topics, like the real test.
      const per = UNITS.map((u) => shuffle(QB.filter((q) => q.unit === u.id)));
      const out = [];
      for (let i = 0; out.length < MOCK_SIZE; i++) {
        const list = per[i % per.length];
        if (list.length) out.push(list.pop());
      }
      return shuffle(out);
    },
    speed: () => shuffle(QB),
  };

  const MODES = {
    lesson: { title: (u) => `${u.town}: ${u.title}`, feedback: true, retry: true },
    review: { title: () => 'Smart Review', feedback: true, retry: true },
    mistakes: { title: () => 'Mistake Fixer', feedback: true, retry: true },
    signs: { title: () => 'Sign Spotter', feedback: true, retry: false },
    daily: { title: () => 'Daily Challenge', feedback: true, retry: false },
    mock: { title: () => 'Mock Theory Test', feedback: false, retry: false },
    speed: { title: () => 'Speed Run', feedback: false, retry: false },
  };

  let S = null; // active session

  const startSession = (mode, unitId) => {
    closeSheet();
    const qs = build[mode](unitId);
    if (!qs.length) { toast('Nothing to practise here yet. Play some lessons first!'); return; }
    S = {
      mode, unitId, cfg: MODES[mode], queue: qs.map((q) => item(q.id)), idx: 0,
      combo: 0, bestCombo: 0, xp: 0, coins: 0, firstTry: 0, firstWrong: 0, answers: [],
      startLevel: levelOf(st.xp), t0: Date.now(), locked: false,
      timeLeft: SPEED_SECONDS * 1000, timer: null,
    };
    document.body.classList.add('in-quiz');
    $('#quiz').hidden = false;
    renderQuestion();
    if (mode === 'speed') {
      let last = performance.now();
      S.timer = setInterval(() => {
        const now = performance.now();
        S.timeLeft -= now - last; last = now;
        const bar = $('#timebar');
        if (bar) bar.style.width = `${Math.max(0, (S.timeLeft / (SPEED_SECONDS * 1000)) * 100)}%`;
        const tl = $('#timeleft');
        if (tl) tl.textContent = Math.ceil(Math.max(0, S.timeLeft) / 1000);
        if (S.timeLeft <= 0) finish();
      }, 100);
    }
  };

  const quitSession = () => {
    if (S && S.timer) clearInterval(S.timer);
    S = null;
    $('#quiz').hidden = true;
    $('#quiz').innerHTML = '';
    document.body.classList.remove('in-quiz');
    render();
  };

  const comboMult = (c) => (c >= 6 ? 3 : c >= 3 ? 2 : 1);

  const renderQuestion = () => {
    const it = S.queue[S.idx];
    const q = QBY[it.id];
    const total = S.mode === 'speed' ? null : S.queue.length;
    const pct = total ? (S.idx / total) * 100 : 0;
    const mult = comboMult(S.combo);
    const top = S.mode === 'speed'
      ? `<div class="bar time"><div id="timebar" style="width:${(S.timeLeft / (SPEED_SECONDS * 1000)) * 100}%"></div></div>
         <div class="speed-meta"><span>⏱️ <b id="timeleft">${Math.ceil(S.timeLeft / 1000)}</b>s</span><span>✅ <b>${S.firstTry}</b></span></div>`
      : `<div class="bar"><div style="width:${pct}%"></div></div>`;
    $('#quiz').innerHTML = `
      <div class="quiz-top">
        <button class="icon-btn" data-act="quit" aria-label="Quit">✕</button>
        <div class="quiz-progress">${top}</div>
        <div class="combo ${S.combo >= 3 ? 'hot' : ''}" title="Combo">${S.combo >= 3 ? `🔥×${mult}` : S.mode === 'mock' ? `${S.idx + 1}/${total}` : ''}</div>
      </div>
      <div class="quiz-body">
        ${it.retry ? '<div class="chip retry">🔁 Let\'s try this one again</div>' : `<div class="chip">${esc(MODES[S.mode].title(UNIT_BY[S.unitId] || {}))}</div>`}
        ${q.sign ? `<div class="sign">${window.RQ_SIGN(q.sign)}</div>` : ''}
        <h2 class="question">${esc(q.text)}</h2>
        <div class="options">
          ${it.order.map((oi, k) => `<button class="opt" data-act="answer" data-k="${k}"><span class="key">${'ABCD'[k]}</span><span>${esc(q.opts[oi])}</span></button>`).join('')}
        </div>
      </div>
      <div id="feedback" class="feedback" hidden></div>`;
    S.locked = false;
  };

  const answer = (k) => {
    if (!S || S.locked) return;
    S.locked = true;
    const it = S.queue[S.idx];
    const q = QBY[it.id];
    const right = it.order[k] === 0;
    const btns = [...document.querySelectorAll('.opt')];
    const correctK = it.order.indexOf(0);

    if (S.mode === 'mock') {
      btns[k].classList.add('chosen');
      S.answers.push({ id: q.id, chosen: q.opts[it.order[k]], right });
      if (right) S.firstTry++;
      setTimeout(next, 220);
      return;
    }

    st.stats.answered++;
    if (right) {
      st.stats.correct++;
      if (q.sign) st.stats.signsRight++;
      S.combo++;
      if (S.combo > S.bestCombo) S.bestCombo = S.combo;
      if (S.combo > st.stats.bestCombo) st.stats.bestCombo = S.combo;
      const gain = (it.retry ? 5 : 10) * comboMult(S.combo);
      S.xp += gain; S.coins += 1;
      if (!it.retry) S.firstTry++;
      btns[k].classList.add('right');
      sfx(S.combo === 3 || S.combo === 6 ? 'combo' : 'right');
      buzz(15);
      floatXP(btns[k], `+${gain} XP`);
    } else {
      S.combo = 0;
      if (!it.retry) S.firstWrong++;
      btns[k].classList.add('wrong', 'shake');
      btns[correctK].classList.add('right');
      sfx('wrong');
      buzz([30, 40, 30]);
      if (S.cfg.retry && !it.retry) S.queue.push(item(q.id, true));
    }
    if (S.mode !== 'speed') recordAnswer(q, right);
    S.answers.push({ id: q.id, right });
    btns.forEach((b) => b.setAttribute('disabled', ''));

    if (S.mode === 'speed') {
      if (!right) S.timeLeft -= 3000;
      setTimeout(next, right ? 280 : 900);
      return;
    }
    const fb = $('#feedback');
    fb.className = `feedback ${right ? 'good' : 'bad'}`;
    fb.innerHTML = `
      <div class="fb-head">${right ? `✅ ${pick(PRAISE)}` : `💡 ${pick(CONSOLE)}`}${S.combo >= 3 ? ` <span class="fb-combo">🔥 ${S.combo} in a row</span>` : ''}</div>
      ${right ? '' : `<div class="fb-answer">Answer: <b>${esc(q.opts[0])}</b></div>`}
      <div class="fb-exp">${esc(q.exp)}</div>
      <button class="btn ${right ? 'go' : 'warn'} block" data-act="next">Continue</button>`;
    fb.hidden = false;
    requestAnimationFrame(() => fb.classList.add('show'));
  };

  const floatXP = (el, text) => {
    const r = el.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float-xp';
    f.textContent = text;
    f.style.left = `${r.right - 70}px`;
    f.style.top = `${r.top}px`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 900);
  };

  const next = () => {
    if (!S) return;
    S.idx++;
    if (S.mode === 'speed') {
      if (S.idx >= S.queue.length) S.queue = S.queue.concat(build.speed().map((q) => item(q.id)));
      if (S.timeLeft > 0) renderQuestion();
      return;
    }
    if (S.idx >= S.queue.length) finish();
    else renderQuestion();
  };

  // ---------- Finishing a session ----------
  const finish = () => {
    if (!S) return;
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    closeModal();
    const R = S;
    const lines = [];
    let stars = 0;
    let headline = '';
    let emoji = '🎉';
    let good = true;

    if (R.mode === 'mock') {
      R.answers.forEach((a) => recordAnswer(QBY[a.id], a.right));
      st.stats.answered += R.answers.length;
      st.stats.correct += R.firstTry;
      const passed = R.firstTry >= MOCK_PASS;
      R.xp = R.firstTry * 5 + (passed ? 100 : 0);
      R.coins = R.firstTry + (passed ? 25 : 0);
      if (passed) st.stats.mockPasses++;
      st.stats.mockBest = Math.max(st.stats.mockBest, R.firstTry);
      good = passed;
      emoji = passed ? '🏁' : '🚧';
      headline = passed ? 'PASS! You\'re test ready!' : 'Not yet. Keep practising!';
      lines.push(['Score', `${R.firstTry} / ${MOCK_SIZE}`], ['Pass mark', `${MOCK_PASS} / ${MOCK_SIZE}`]);
    } else if (R.mode === 'speed') {
      const isBest = R.firstTry > st.stats.speedBest;
      st.stats.speedBest = Math.max(st.stats.speedBest, R.firstTry);
      emoji = isBest ? '🏆' : '⚡';
      headline = isBest ? 'New personal best!' : 'Speed Run complete';
      lines.push(['Correct', R.firstTry], ['Best', st.stats.speedBest], ['Best combo', R.bestCombo]);
      good = isBest || R.firstTry >= 10;
    } else {
      const firstAttempts = R.queue.filter((i) => !i.retry).length;
      const acc = Math.round((R.firstTry / firstAttempts) * 100);
      if (R.mode === 'lesson') {
        stars = R.firstWrong === 0 ? 3 : R.firstWrong <= 2 ? 2 : 1;
        const u = st.units[R.unitId] || (st.units[R.unitId] = { stars: 0, plays: 0 });
        const firstClear = !u.stars;
        u.stars = Math.max(u.stars, stars);
        u.plays++;
        st.stats.lessons++;
        if (stars === 3) { st.stats.perfects++; R.xp += 20; }
        if (firstClear) {
          R.xp += 20; R.coins += 10;
          const nxt = UNITS[UNIT_BY[R.unitId].index + 1];
          if (nxt) lines.push(['Unlocked', `${nxt.emoji} ${nxt.town}`]);
          else lines.push(['Unlocked', '🏁 Mock Theory Test']);
        }
        headline = stars === 3 ? 'Flawless!' : stars === 2 ? 'Great drive!' : 'Lesson complete!';
        emoji = UNIT_BY[R.unitId].emoji;
      } else if (R.mode === 'daily') {
        const first = st.daily.challengeDone !== dateStr();
        st.daily.challengeDone = dateStr();
        if (first) { R.xp *= 2; lines.push(['Daily bonus', '2× XP']); }
        headline = 'Daily Challenge done!';
        emoji = '🎯';
      } else {
        if (R.mode === 'review') st.stats.reviews++;
        headline = R.firstWrong === 0 ? 'Perfect practice!' : 'Practice complete!';
        emoji = R.mode === 'signs' ? '🪧' : '🧠';
      }
      lines.unshift(['Accuracy', `${acc}%`], ['Best combo', `🔥 ${R.bestCombo}`]);
      good = acc >= 60;
    }

    // Rewards
    rollDay();
    const before = st.daily.xp;
    st.xp += R.xp;
    st.coins += R.coins;
    st.daily.xp += R.xp;
    const hitGoal = before < st.goal && st.daily.xp >= st.goal;
    if (hitGoal) st.stats.goalsHit++;
    const streakUp = touchStreak();
    const newLevel = levelOf(st.xp);
    const fresh = checkBadges({ hour: new Date().getHours() });
    save();

    S = null;
    document.body.classList.remove('in-quiz');
    const mins = Math.max(1, Math.round((Date.now() - R.t0) / 60000));
    lines.push(['Time', `${mins} min`]);

    const reviewList = R.mode === 'mock'
      ? R.answers.filter((a) => !a.right).map((a) => {
        const q = QBY[a.id];
        return `<div class="review-item"><div class="ri-q">${q.sign ? `<span class="mini-sign">${window.RQ_SIGN(q.sign)}</span>` : ''}${esc(q.text)}</div>
          <div class="ri-bad">✗ ${esc(a.chosen)}</div><div class="ri-good">✓ ${esc(q.opts[0])}</div><div class="ri-exp">${esc(q.exp)}</div></div>`;
      }).join('')
      : '';

    $('#quiz').innerHTML = `
      <div class="results">
        <div class="res-emoji pop">${emoji}</div>
        <h1>${headline}</h1>
        ${stars ? `<div class="stars big">${[1, 2, 3].map((n) => `<span class="${n <= stars ? 'on' : ''}" style="animation-delay:${n * 0.18}s">★</span>`).join('')}</div>` : ''}
        <div class="res-rewards">
          <div class="reward xp"><b>+${R.xp}</b><span>XP</span></div>
          <div class="reward coin"><b>+${R.coins}</b><span>🪙 coins</span></div>
          ${streakUp ? `<div class="reward fire"><b>${st.streak.count}</b><span>🔥 day streak</span></div>` : ''}
        </div>
        <div class="res-lines">${lines.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
        ${hitGoal ? '<div class="goal-hit">🎯 Daily goal reached. Ka rawe!</div>' : ''}
        ${reviewList ? `<h3 class="sec">Review your mistakes</h3>${reviewList}` : ''}
        ${R.mode === 'mock' && !reviewList ? '<p class="muted center">No mistakes at all. Outstanding!</p>' : ''}
        <div class="res-actions">
          ${R.mode === 'lesson' && stars < 3 ? `<button class="btn ghost block" data-act="replay" data-mode="lesson" data-unit="${R.unitId}">Replay for 3 stars</button>` : ''}
          ${R.mode === 'speed' ? '<button class="btn ghost block" data-act="replay" data-mode="speed">Go again</button>' : ''}
          <button class="btn go block" data-act="done">Continue</button>
        </div>
      </div>`;
    $('#quiz').scrollTop = 0;
    if (good) { sfx('win'); confetti(); } else sfx('tick');

    const after = [];
    if (newLevel > R.startLevel) after.push(() => levelUpModal(newLevel));
    fresh.forEach((b) => after.push(() => toast(`<span class="t-emoji">${b.e}</span><div><b>Badge unlocked!</b><br>${esc(b.name)}</div>`, 3200)));
    after.forEach((fn, i) => setTimeout(fn, 900 + i * 700));
  };

  const levelUpModal = (L) => {
    const unlocked = VEHICLES.filter((v) => v.lvl === L);
    sfx('level');
    confetti(200);
    modal(`
      <div class="lvl-badge">${L}</div>
      <h2>Level up!</h2>
      <p>You're now a <b>${titleOf(L)}</b>.</p>
      ${unlocked.map((v) => `<div class="unlock">New ride unlocked: <span class="big-emoji">${v.e}</span> ${v.name}</div>`).join('')}
      <button class="btn go block" data-act="close-modal">Sweet as!</button>`);
  };

  // ---------- Screens ----------
  let tab = 'journey';

  const header = () => {
    const L = levelOf(st.xp);
    const into = st.xp - xpForLevel(L);
    const need = xpForLevel(L + 1) - xpForLevel(L);
    return `
      <header class="top">
        <button class="lvl" data-act="tab" data-tab="profile" aria-label="Level ${L}">
          <span class="lvl-num">${L}</span>
          <span class="lvl-info"><b>${titleOf(L)}</b><span class="mini-bar"><span style="width:${(into / need) * 100}%"></span></span></span>
        </button>
        <div class="pills">
          <span class="pill fire ${liveStreak() ? '' : 'cold'}" title="Day streak">🔥 ${liveStreak()}</span>
          <span class="pill" title="Coins">🪙 ${st.coins}</span>
        </div>
      </header>`;
  };

  const goalRing = () => {
    const p = Math.min(1, st.daily.xp / st.goal);
    const C = 2 * Math.PI * 26;
    return `<svg class="ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="ring-bg"/>
      <circle cx="32" cy="32" r="26" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}"/></svg>
      <div class="ring-label">${p >= 1 ? '✓' : `${Math.round(p * 100)}%`}</div>`;
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;

  const journey = () => {
    const offsets = [0, 70, 100, 70, 0, -70, -100, -70];
    let current = UNITS.findIndex((u, i) => unitUnlocked(i) && !(st.units[u.id] || {}).stars);
    const bossOpen = allUnitsDone() || st.settings.unlockAll;
    if (current === -1) current = UNITS.length;
    const due = dueList().length;
    const nodes = UNITS.map((u, i) => {
      const open = unitUnlocked(i);
      const us = st.units[u.id] || {};
      const off = offsets[i % offsets.length];
      const here = i === current;
      return `
        <div class="node-row" style="--off:${off}px">
          <button class="node ${open ? 'open' : 'locked'} ${here ? 'current' : ''} ${us.stars ? 'done' : ''}" style="--c:${u.color}" data-act="unit" data-unit="${u.id}" aria-label="${esc(u.town)}: ${esc(u.title)}">
            ${here ? `<span class="vehicle">${st.vehicle}</span>` : ''}
            <span class="node-emoji">${open ? u.emoji : '🔒'}</span>
            ${us.stars ? `<span class="node-stars">${'★'.repeat(us.stars)}${'☆'.repeat(3 - us.stars)}</span>` : ''}
          </button>
          <div class="node-label ${off > 0 ? 'left' : 'right'}"><b>${esc(u.town)}</b><span>${esc(u.title)}</span></div>
        </div>`;
    }).join('');
    const installHint = isIOS && !standalone && !st.installDismissed ? `
      <div class="card install">
        <div><b>📲 Install for offline use</b><br><span class="muted">In Safari, tap <b>Share</b> <span class="share-ico">⎋</span> then <b>Add to Home Screen</b>. It'll work with no signal.</span></div>
        <button class="icon-btn" data-act="dismiss-install" aria-label="Dismiss">✕</button>
      </div>` : '';
    return `
      ${installHint}
      <div class="card goal">
        <div class="ring-wrap">${goalRing()}</div>
        <div class="goal-text">
          <b>Daily goal</b>
          <span>${st.daily.xp} / ${st.goal} XP today</span>
          <span class="muted">${st.daily.xp >= st.goal ? 'Goal smashed. Keep the streak alive tomorrow!' : liveStreak() && st.streak.last !== dateStr() ? `Play today to keep your 🔥 ${liveStreak()}-day streak!` : 'Every lesson gets you closer.'}</span>
        </div>
      </div>
      ${due ? `<button class="card cta" data-act="start" data-mode="review"><span class="cta-emoji">🧠</span><div><b>${due} question${due > 1 ? 's' : ''} ready for review</b><br><span class="muted">Spaced repetition locks rules into long-term memory.</span></div><span class="chev">›</span></button>` : ''}
      <div class="map">
        <div class="map-start">🏝️ Te Rerenga Wairua · Start your journey</div>
        ${nodes}
        <div class="node-row" style="--off:0px">
          <button class="node boss ${bossOpen ? 'open' : 'locked'} ${current === UNITS.length ? 'current' : ''}" data-act="mock-node" aria-label="Mock theory test">
            ${current === UNITS.length ? `<span class="vehicle">${st.vehicle}</span>` : ''}
            <span class="node-emoji">${bossOpen ? '🏁' : '🔒'}</span>
          </button>
          <div class="node-label right"><b>Final boss</b><span>Mock Theory Test</span></div>
        </div>
        <div class="map-end">🎉 ${st.stats.mockPasses ? 'Ready for the real thing!' : 'Pass the mock to finish your journey'}</div>
      </div>`;
  };

  const practice = () => {
    const due = dueList().length;
    const mistakes = QB.filter((q) => (st.qs[q.id] || {}).wrong > 0 && st.qs[q.id].box < 3).length;
    const dailyDone = st.daily.challengeDone === dateStr();
    const card = (mode, emoji, title, sub, extra = '', cls = '') => `
      <button class="card mode ${cls}" data-act="start" data-mode="${mode}">
        <span class="mode-emoji">${emoji}</span>
        <div class="mode-text"><b>${title}</b><span class="muted">${sub}</span></div>
        ${extra}
      </button>`;
    return `
      <h2 class="screen-title">Practice</h2>
      ${card('daily', '🎯', 'Daily Challenge', dailyDone ? 'Done today. Come back tomorrow for 2× XP.' : '5 questions · 2× XP bonus today', dailyDone ? '<span class="tag ok">✓</span>' : '<span class="tag hot">2×</span>', dailyDone ? 'dim' : 'featured')}
      ${card('review', '🧠', 'Smart Review', 'Spaced repetition: revisit rules just before you forget them', due ? `<span class="tag">${due} due</span>` : '')}
      ${card('speed', '⚡', 'Speed Run', `60 seconds. Wrong answers cost 3s. Best: ${st.stats.speedBest}`)}
      ${card('signs', '🪧', 'Sign Spotter', 'Road signs, lights and markings')}
      ${card('mistakes', '🔧', 'Mistake Fixer', mistakes ? 'Drill the questions you\'ve missed' : 'No weak spots right now. Nice!', mistakes ? `<span class="tag warn">${mistakes}</span>` : '')}
      ${card('mock', '🏁', 'Mock Theory Test', `${MOCK_SIZE} questions · pass with ${MOCK_PASS}+ · no hints until the end. Best: ${st.stats.mockBest}/${MOCK_SIZE}`, '', 'boss-card')}
      <h3 class="sec">Topic mastery</h3>
      <div class="mastery-list">
        ${UNITS.map((u) => { const m = mastery(u.id); return `
          <div class="mastery"><span>${u.emoji}</span><div class="m-text"><b>${esc(u.title)}</b><span class="mini-bar"><span style="width:${m}%;background:${u.color}"></span></span></div><span class="m-pct">${m}%</span></div>`; }).join('')}
      </div>`;
  };

  const trophies = () => {
    const got = BADGES.filter((b) => st.badges[b.id]).length;
    return `
      <h2 class="screen-title">Trophies <span class="muted">${got}/${BADGES.length}</span></h2>
      <div class="badges">
        ${BADGES.map((b) => `
          <div class="badge ${st.badges[b.id] ? 'got' : ''}">
            <div class="b-emoji">${st.badges[b.id] ? b.e : '🔒'}</div>
            <b>${esc(b.name)}</b><span>${esc(b.desc)}</span>
          </div>`).join('')}
      </div>`;
  };

  const profile = () => {
    const L = levelOf(st.xp);
    const acc = st.stats.answered ? Math.round((st.stats.correct / st.stats.answered) * 100) : 0;
    const totalStars = UNITS.reduce((n, u) => n + ((st.units[u.id] || {}).stars || 0), 0);
    return `
      <div class="card hero">
        <div class="hero-vehicle">${st.vehicle}</div>
        <div><div class="muted">Level ${L}</div><h2>${titleOf(L)}</h2><div class="muted">${st.xp} XP · ${xpForLevel(L + 1) - st.xp} to level ${L + 1}</div></div>
      </div>
      <div class="stats">
        <div><b>🔥 ${liveStreak()}</b><span>Day streak</span></div>
        <div><b>🏅 ${st.streak.best}</b><span>Best streak</span></div>
        <div><b>⭐ ${totalStars}/${UNITS.length * 3}</b><span>Stars</span></div>
        <div><b>🎯 ${acc}%</b><span>Accuracy</span></div>
        <div><b>✅ ${st.stats.correct}</b><span>Correct</span></div>
        <div><b>🧊 ${st.streak.freezes}</b><span>Streak freezes</span></div>
      </div>
      <h3 class="sec">Garage</h3>
      <div class="garage">
        ${VEHICLES.map((v) => { const ok = L >= v.lvl; return `
          <button class="car ${st.vehicle === v.e ? 'sel' : ''} ${ok ? '' : 'locked'}" data-act="vehicle" data-v="${v.e}" ${ok ? '' : 'disabled'}>
            <span class="car-e">${ok ? v.e : '🔒'}</span><span>${ok ? v.name : `Level ${v.lvl}`}</span></button>`; }).join('')}
      </div>
      <h3 class="sec">Shop</h3>
      <div class="card shop">
        <span class="mode-emoji">🧊</span>
        <div class="mode-text"><b>Streak freeze</b><span class="muted">Protects your streak if you miss a day. Hold up to 2.</span></div>
        <button class="btn small ${st.coins >= FREEZE_COST && st.streak.freezes < 2 ? 'go' : 'off'}" data-act="buy-freeze">🪙 ${FREEZE_COST}</button>
      </div>
      <h3 class="sec">Settings</h3>
      <div class="card settings">
        <label class="row"><span>🔊 Sound effects</span><input type="checkbox" data-act="toggle" data-key="sound" ${st.settings.sound ? 'checked' : ''}></label>
        <div class="row"><span>🎯 Daily goal</span>
          <div class="seg">${[20, 50, 100, 150].map((g) => `<button class="${st.goal === g ? 'on' : ''}" data-act="goal" data-g="${g}">${g}</button>`).join('')}</div></div>
        <label class="row"><span>🔓 Unlock all stops</span><input type="checkbox" data-act="toggle" data-key="unlockAll" ${st.settings.unlockAll ? 'checked' : ''}></label>
        <div class="row"><span>💾 Backup progress</span><div><button class="btn small ghost" data-act="export">Export</button> <button class="btn small ghost" data-act="import">Import</button></div></div>
        <div class="row"><span>🗑️ Reset everything</span><button class="btn small danger" data-act="reset">Reset</button></div>
      </div>
      <p class="disclaimer">Road Code Quest is an unofficial study aid based on the NZTA Road Code. Rules change. Licensing rules change on 25 January 2027. Always check the official Road Code at nzta.govt.nz before your test. Works offline. Progress is stored only on this device.</p>`;
  };

  let ruleQuery = '';
  const rules = () => {
    const words = ruleQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (t) => words.every((w) => t.toLowerCase().includes(w));
    const total = UNITS.reduce((n, u) => n + u.learn.length, 0);
    let shown = 0;
    const sections = UNITS.map((u) => {
      const cards = u.learn.filter(([, t]) => !words.length || match(t) || match(u.title));
      shown += cards.length;
      if (!cards.length) return '';
      return `
        <section class="rule-sec" style="--c:${u.color}">
          <div class="rule-head"><span class="rule-emoji">${u.emoji}</span><div><b>${esc(u.title)}</b><span class="muted small">Stop ${u.index + 1} · ${esc(u.town)}</span></div>
            <button class="btn small ghost" data-act="start" data-mode="lesson" data-unit="${u.id}" ${unitUnlocked(u.index) ? '' : 'disabled'}>▶ Quiz</button></div>
          ${cards.map(([e, t]) => `<div class="rule"><span>${e}</span><p>${esc(t)}</p></div>`).join('')}
        </section>`;
    }).join('');
    return `
      <h2 class="screen-title">Road Code <span class="muted">${total} rules</span></h2>
      <input id="rule-search" class="search" type="search" placeholder="Search rules, e.g. parking, 6 m, alcohol" value="${esc(ruleQuery)}" autocomplete="off">
      <div id="rule-list">${sections || '<p class="muted center">No rules match that search.</p>'}</div>
      ${words.length ? `<p class="muted center small">${shown} matching rules</p>` : ''}`;
  };

  const SCREENS = { journey, practice, rules, trophies, profile };

  const render = () => {
    rollDay();
    $('#app').innerHTML = `${header()}<main class="screen screen-${tab}">${SCREENS[tab]()}</main>`;
    document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'journey') {
      const cur = $('.node.current');
      if (cur && !render.scrolled) { render.scrolled = true; if (cur !== $('.node')) cur.scrollIntoView({ block: 'center' }); }
    }
  };

  // ---------- Unit sheet & learn cards ----------
  const unitSheet = (uid) => {
    const u = UNIT_BY[uid];
    const i = u.index;
    if (!unitUnlocked(i)) {
      sheet(`<div class="us-head" style="--c:${u.color}"><span class="us-emoji">🔒</span><div><h2>${esc(u.town)}</h2><p class="muted">${esc(u.title)}</p></div></div>
        <p>Finish <b>${esc(UNITS[i - 1].town)}</b> to unlock this stop.</p>
        <p class="muted small">Already know your stuff? Turn on "Unlock all stops" in Profile.</p>
        <button class="btn ghost block" data-act="close-sheet">OK</button>`);
      return;
    }
    const us = st.units[uid] || {};
    const m = mastery(uid);
    sheet(`
      <div class="us-head" style="--c:${u.color}"><span class="us-emoji">${u.emoji}</span>
        <div><div class="muted small">Stop ${i + 1} of ${UNITS.length} · ${esc(u.town)}</div><h2>${esc(u.title)}</h2><p class="muted">${esc(u.blurb)}</p></div></div>
      <div class="us-meta">
        <div><b>${us.stars ? '★'.repeat(us.stars) + '☆'.repeat(3 - us.stars) : '☆☆☆'}</b><span>Best</span></div>
        <div><b>${m}%</b><span>Mastery</span></div>
        <div><b>${u.q.length}</b><span>Questions</span></div>
      </div>
      <button class="btn ghost block" data-act="learn" data-unit="${uid}">📖 Key rules (${u.learn.length} cards)</button>
      <button class="btn go block" data-act="start" data-mode="lesson" data-unit="${uid}">${us.stars ? '▶ Practise again' : '▶ Start lesson'}</button>`);
  };

  let learnState = null;
  const learnCards = (uid, k = 0) => {
    const u = UNIT_BY[uid];
    learnState = { uid, k };
    const [e, text] = u.learn[k];
    const last = k === u.learn.length - 1;
    sheet(`
      <div class="learn" style="--c:${u.color}">
        <div class="dots">${u.learn.map((_, j) => `<span class="${j === k ? 'on' : j < k ? 'past' : ''}"></span>`).join('')}</div>
        <div class="learn-card pop"><div class="learn-emoji">${e}</div><p>${esc(text)}</p></div>
        <div class="learn-nav">
          <button class="btn ghost" data-act="learn-prev" ${k ? '' : 'disabled'}>‹ Back</button>
          ${last ? `<button class="btn go" data-act="start" data-mode="lesson" data-unit="${uid}">Start lesson ▶</button>` : '<button class="btn go" data-act="learn-next">Next ›</button>'}
        </div>
      </div>`);
  };

  // ---------- Onboarding ----------
  const onboarding = () => {
    modal(`
      <div class="onb-car">🚗💨</div>
      <h2>Kia ora!</h2>
      <p>Welcome to <b>Road Code Quest</b>. Drive from Cape Reinga to Bluff, mastering the NZ Road Code one stop at a time.</p>
      <ul class="onb-list">
        <li>⭐ Earn stars, XP and coins</li>
        <li>🔥 Build a daily streak</li>
        <li>🧠 Smart Review brings back what you're about to forget</li>
        <li>🏁 Beat the mock theory test boss</li>
      </ul>
      <p class="muted">Pick a daily goal:</p>
      <div class="seg wide">${[[20, 'Chill'], [50, 'Regular'], [100, 'Serious'], [150, 'Intense']].map(([g, n]) => `<button class="${st.goal === g ? 'on' : ''}" data-act="goal" data-g="${g}"><b>${n}</b><br>${g} XP</button>`).join('')}</div>
      <button class="btn go block" data-act="onboard-done">Let's go!</button>`);
  };

  // ---------- Export / import ----------
  const doExport = () => {
    const blob = new Blob([JSON.stringify(st)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `road-code-quest-${dateStr()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('💾 Progress exported');
  };
  const doImport = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      f.text().then((t) => {
        const data = JSON.parse(t);
        if (!data || data.v !== 1) throw new Error('bad file');
        st = merge(DEFAULT(), data);
        save(); render(); toast('✅ Progress restored');
      }).catch(() => toast('⚠️ That file couldn\'t be read'));
    };
    inp.click();
  };

  // ---------- Events ----------
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) {
      if (ev.target.id === 'sheet') closeSheet();
      return;
    }
    const d = el.dataset;
    switch (d.act) {
      case 'tab': tab = d.tab; closeSheet(); render(); window.scrollTo(0, 0); break;
      case 'unit': unitSheet(d.unit); break;
      case 'mock-node':
        if (allUnitsDone() || st.settings.unlockAll) startSession('mock');
        else sheet(`<div class="us-head"><span class="us-emoji">🏁</span><div><h2>Final boss</h2><p class="muted">Mock Theory Test</p></div></div>
          <p>Complete every stop to face the boss here. You can still take the mock test anytime from <b>Practice</b>.</p>
          <button class="btn go block" data-act="start" data-mode="mock">Take it anyway</button>
          <button class="btn ghost block" data-act="close-sheet">Later</button>`);
        break;
      case 'learn': learnCards(d.unit); break;
      case 'learn-next': learnCards(learnState.uid, learnState.k + 1); break;
      case 'learn-prev': learnCards(learnState.uid, Math.max(0, learnState.k - 1)); break;
      case 'start': startSession(d.mode, d.unit); break;
      case 'replay': quitSession(); startSession(d.mode, d.unit); break;
      case 'answer': answer(+d.k); break;
      case 'next': next(); break;
      case 'quit':
        if (S && (S.idx > 0 || S.mode === 'speed')) {
          modal(`<h2>Leave this ${S.mode === 'mock' ? 'test' : 'session'}?</h2><p class="muted">Your progress in this round won't count.</p>
            <button class="btn danger block" data-act="confirm-quit">Leave</button><button class="btn ghost block" data-act="close-modal">Keep going</button>`);
        } else quitSession();
        break;
      case 'confirm-quit': closeModal(); quitSession(); break;
      case 'done': quitSession(); break;
      case 'close-modal': closeModal(); break;
      case 'close-sheet': closeSheet(); break;
      case 'dismiss-install': st.installDismissed = true; save(); render(); break;
      case 'vehicle': st.vehicle = d.v; save(); render(); break;
      case 'goal': st.goal = +d.g; save(); if ($('#modal').hidden) render(); else document.querySelectorAll('#modal .seg button').forEach((b) => b.classList.toggle('on', +b.dataset.g === st.goal)); break;
      case 'onboard-done': st.onboarded = true; save(); closeModal(); render(); break;
      case 'buy-freeze':
        if (st.streak.freezes >= 2) toast('🧊 You already hold the max of 2 freezes');
        else if (st.coins < FREEZE_COST) toast(`🪙 You need ${FREEZE_COST - st.coins} more coins`);
        else { st.coins -= FREEZE_COST; st.streak.freezes++; save(); render(); sfx('right'); toast('🧊 Streak freeze bought!'); }
        break;
      case 'export': doExport(); break;
      case 'import': doImport(); break;
      case 'reset':
        modal(`<h2>Reset all progress?</h2><p class="muted">XP, stars, streaks and badges will be wiped. This can't be undone.</p>
          <button class="btn danger block" data-act="confirm-reset">Reset everything</button><button class="btn ghost block" data-act="close-modal">Cancel</button>`);
        break;
      case 'confirm-reset': st = DEFAULT(); st.onboarded = true; save(); closeModal(); tab = 'journey'; render(); break;
      default: break;
    }
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id !== 'rule-search') return;
    ruleQuery = ev.target.value;
    const tmp = document.createElement('div');
    tmp.innerHTML = rules();
    $('#rule-list').replaceWith(tmp.querySelector('#rule-list'));
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.act === 'toggle') { st.settings[el.dataset.key] = el.checked; save(); render(); }
  });
  document.addEventListener('keydown', (ev) => {
    if (!S) return;
    if (['1', '2', '3', '4'].includes(ev.key)) answer(+ev.key - 1);
    else if (ev.key === 'Enter' && $('#feedback') && !$('#feedback').hidden) next();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !S) render(); });

  // ---------- Boot ----------
  render();
  if (!st.onboarded) onboarding();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
