// ===== 저장 =====
const store = {
  get(k, d) { try { const v = localStorage.getItem('voca_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('voca_' + k, JSON.stringify(v)); } catch (e) {} }
};
let S = {
  level: store.get('level', 'm'),
  known: new Set(store.get('known', [])),
  wrong: new Set(store.get('wrong', [])),
  done: new Set(store.get('done', [])),
  auto: store.get('auto', true),
  accent: store.get('accent', 'en-US'),
  rate: store.get('rate', 0.85)
};
function save() {
  store.set('level', S.level); store.set('known', [...S.known]); store.set('wrong', [...S.wrong]);
  store.set('done', [...S.done]); store.set('auto', S.auto); store.set('accent', S.accent); store.set('rate', S.rate);
}

const PER_DAY = 30;
const LV = { e: '초등', m: '중등', all: '전체' };
const listOf = lv => lv === 'all' ? WORDS : WORDS.filter(w => w.l === lv);
const days = lv => { const L = listOf(lv), out = []; for (let i = 0; i < L.length; i += PER_DAY) out.push(L.slice(i, i + PER_DAY)); return out; };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ===== 발음 =====
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) {} }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text, slow) {
  if (!('speechSynthesis' in window)) { alert('이 브라우저는 발음 기능을 지원하지 않아요.'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = S.accent;
  const v = voices.find(v => v.lang === S.accent) || voices.find(v => v.lang && v.lang.startsWith('en'));
  if (v) u.voice = v;
  u.rate = slow ? 0.55 : S.rate;
  speechSynthesis.speak(u);
}

// ===== 화면 =====
const app = document.getElementById('app'), title = document.getElementById('title'), back = document.getElementById('back');
let backFn = null;
back.onclick = () => backFn && backFn();
function setHead(t, b) { title.textContent = t; backFn = b || null; back.hidden = !b; window.scrollTo(0, 0); }
document.querySelectorAll('nav button').forEach(b => b.onclick = () => go(b.dataset.tab));
function go(tab) {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  ({ home, quiz: quizHome, wrong: wrongNote, search, settings })[tab]();
}
function seg() {
  return `<div class="seg">${['e', 'm', 'all'].map(k => `<button data-lv="${k}" class="${S.level === k ? 'on' : ''}">${LV[k]}</button>`).join('')}</div>`;
}
function bindSeg(again) { app.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { S.level = b.dataset.lv; save(); again(); }); }
function wordRow(w) {
  const on = S.wrong.has(w.w);
  return `<div class="row"><div class="t"><b>${esc(w.w)}</b>${S.level === 'all' ? `<span class="chip">${LV[w.l]}</span>` : ''}<div class="ipa">${esc(w.p)}</div><div class="mean">${esc(w.m)}</div></div>
  <button class="ib star ${on ? 'on' : ''}" data-star="${esc(w.w)}" aria-label="오답노트">★</button>
  <button class="ib" data-say="${esc(w.w)}" aria-label="발음 듣기">🔊</button></div>`;
}
function bindRows(root = app) {
  root.querySelectorAll('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say));
  root.querySelectorAll('[data-star]').forEach(b => b.onclick = () => {
    const k = b.dataset.star; S.wrong.has(k) ? S.wrong.delete(k) : S.wrong.add(k); save(); b.classList.toggle('on');
  });
}

// ----- 홈 -----
function home() {
  setHead('📚 중학 영단어');
  const L = listOf(S.level), D = days(S.level);
  const k = L.filter(w => S.known.has(w.w)).length, pct = L.length ? Math.round(k / L.length * 100) : 0;
  const next = D.findIndex((_, i) => !S.done.has(S.level + i));
  app.innerHTML = `${seg()}
  <div class="stat"><div style="color:var(--sub);font-size:14px">${LV[S.level]} 단어 · 외운 단어</div>
  <div class="big">${k} <span style="font-size:16px;color:var(--sub)">/ ${L.length}개 (${pct}%)</span></div>
  <div class="bar"><i style="width:${pct}%"></i></div></div>
  ${next >= 0 ? `<button class="btn" id="cont">Day ${next + 1} 이어서 공부하기 →</button>` : ''}
  <div class="lbl">하루 ${PER_DAY}단어씩 · Day ${D.length}개</div>
  <div class="grid">${D.map((d, i) => {
    const kk = d.filter(w => S.known.has(w.w)).length;
    return `<button class="day ${S.done.has(S.level + i) ? 'done' : ''}" data-day="${i}">Day ${i + 1}<small>${kk}/${d.length}</small></button>`;
  }).join('')}</div>
  <button class="btn ghost" style="margin-top:18px" id="set">⚙️ 설정</button>`;
  bindSeg(home);
  app.querySelectorAll('[data-day]').forEach(b => b.onclick = () => dayView(+b.dataset.day));
  const c = document.getElementById('cont'); if (c) c.onclick = () => dayView(next);
  document.getElementById('set').onclick = settings;
}

// ----- Day 목록 -----
function dayView(i) {
  const d = days(S.level)[i];
  setHead(`Day ${i + 1}`, home);
  let hide = false;
  const draw = () => {
    app.innerHTML = `<div class="btns"><button class="btn" id="card">🃏 카드 학습</button><button class="btn" id="dq">✏️ 이 Day 퀴즈</button></div>
    <button class="btn ghost" id="hide">${hide ? '뜻 보이기' : '뜻 가리기'}</button>
    <div id="list">${d.map(wordRow).join('')}</div>`;
    if (hide) app.querySelectorAll('.mean').forEach(m => { m.style.filter = 'blur(6px)'; m.onclick = () => m.style.filter = ''; });
    bindRows();
    document.getElementById('card').onclick = () => cards(d, () => dayView(i), i);
    document.getElementById('dq').onclick = () => quiz(d, 'ek', () => dayView(i));
    document.getElementById('hide').onclick = () => { hide = !hide; draw(); };
  };
  draw();
}

// ----- 카드 학습 -----
function cards(list, onBack, dayIdx) {
  let q = shuffle(list), idx = 0, open = false, missed = [];
  setHead('카드 학습', onBack);
  const draw = () => {
    if (idx >= q.length) {
      if (dayIdx !== undefined) { S.done.add(S.level + dayIdx); save(); }
      app.innerHTML = `<div class="flash"><div style="font-size:48px">🎉</div><div class="m">한 바퀴 끝!</div>
      <div class="hint">몰라요 ${missed.length}개는 오답노트에 넣어뒀어요</div></div>
      ${missed.length ? '<button class="btn" id="again">모르는 것만 다시</button>' : ''}<button class="btn ghost" id="fin">돌아가기</button>`;
      const a = document.getElementById('again'); if (a) a.onclick = () => cards(missed, onBack);
      document.getElementById('fin').onclick = onBack; return;
    }
    const w = q[idx];
    app.innerHTML = `<div class="cnt">${idx + 1} / ${q.length}</div>
    <div class="flash" id="fc"><div class="w">${esc(w.w)}</div><div class="ipa">${esc(w.p)}</div>
    <div class="m">${open ? esc(w.m) : ''}</div><div class="hint">${open ? '' : '카드를 누르면 뜻이 보여요'}</div></div>
    <div class="btns" style="margin-bottom:10px"><button class="btn ghost" id="say">🔊 듣기</button><button class="btn ghost" id="slow">🐢 천천히</button></div>
    <div class="btns"><button class="btn" style="background:var(--bad)" id="no">몰라요</button><button class="btn" style="background:var(--ok)" id="yes">알아요</button></div>`;
    document.getElementById('fc').onclick = () => { open = !open; draw(); };
    document.getElementById('say').onclick = () => speak(w.w);
    document.getElementById('slow').onclick = () => speak(w.w, true);
    document.getElementById('yes').onclick = () => { S.known.add(w.w); S.wrong.delete(w.w); save(); idx++; open = false; draw(); sayNow(); };
    document.getElementById('no').onclick = () => { S.known.delete(w.w); S.wrong.add(w.w); missed.push(w); save(); idx++; open = false; draw(); sayNow(); };
  };
  const sayNow = () => { if (S.auto && q[idx]) speak(q[idx].w); };
  draw(); sayNow();
}

// ----- 퀴즈 -----
function quizHome() {
  setHead('✏️ 퀴즈');
  app.innerHTML = `${seg()}
  <button class="btn" data-m="ek">영어 보고 → 뜻 고르기</button>
  <button class="btn" data-m="ke">뜻 보고 → 영어 고르기</button>
  <button class="btn" data-m="listen">🔊 듣고 → 뜻 고르기</button>
  <div class="lbl">${LV[S.level]} 단어 중 무작위 20문제 · 틀린 건 오답노트로</div>`;
  bindSeg(quizHome);
  app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => quiz(shuffle(listOf(S.level)).slice(0, 20), b.dataset.m, quizHome));
}
function quiz(list, mode, onBack) {
  const pool = listOf(S.level === 'all' ? 'all' : S.level).length > 10 ? listOf(S.level) : WORDS;
  let q = shuffle(list), idx = 0, score = 0;
  setHead('퀴즈', onBack);
  const draw = () => {
    if (idx >= q.length) {
      app.innerHTML = `<div class="flash"><div style="font-size:48px">${score / q.length >= .8 ? '🏆' : '💪'}</div>
      <div class="m">${q.length}문제 중 ${score}개 정답!</div></div>
      <button class="btn" id="re">다시 풀기</button><button class="btn ghost" id="fin">돌아가기</button>`;
      document.getElementById('re').onclick = () => quiz(shuffle(list), mode, onBack);
      document.getElementById('fin').onclick = onBack; return;
    }
    const w = q[idx];
    const opts = shuffle([w, ...shuffle(pool.filter(x => x.w !== w.w && x.m !== w.m)).slice(0, 3)]);
    const show = mode === 'ke' ? x => x.w : x => x.m;
    const ask = mode === 'ke' ? `<div class="w" style="font-size:28px">${esc(w.m)}</div>`
      : mode === 'listen' ? `<button class="ib" id="ls" style="width:90px;height:90px;font-size:40px;border-radius:24px">🔊</button><div class="hint">다시 들으려면 누르세요</div>`
      : `<div class="w">${esc(w.w)}</div><div class="ipa">${esc(w.p)}</div>`;
    app.innerHTML = `<div class="cnt">${idx + 1} / ${q.length} · 정답 ${score}</div>
    <div class="flash" style="min-height:200px">${ask}</div>
    ${opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(show(o))}</button>`).join('')}`;
    const ls = document.getElementById('ls'); if (ls) ls.onclick = () => speak(w.w);
    if (mode !== 'ke') speak(w.w);
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const pick = opts[+b.dataset.i], right = pick.w === w.w;
      app.querySelectorAll('.opt').forEach((x, i) => { x.disabled = true; if (opts[i].w === w.w) x.classList.add('ok'); });
      if (right) { score++; S.known.add(w.w); } else { b.classList.add('bad'); S.wrong.add(w.w); S.known.delete(w.w); }
      save();
      if (mode === 'ke') speak(w.w);
      const hint = document.createElement('div');
      hint.className = 'row'; hint.innerHTML = `<div class="t"><b>${esc(w.w)}</b> <span class="ipa">${esc(w.p)}</span><div class="mean">${esc(w.m)}</div></div><button class="btn" style="width:auto;margin:0;padding:10px 18px" id="nx">다음</button>`;
      app.appendChild(hint);
      document.getElementById('nx').onclick = () => { idx++; draw(); };
      if (right) setTimeout(() => { if (document.getElementById('nx')) { idx++; draw(); } }, 900);
    });
  };
  draw();
}

// ----- 오답노트 -----
function wrongNote() {
  setHead('❗ 오답노트');
  const L = WORDS.filter(w => S.wrong.has(w.w));
  if (!L.length) { app.innerHTML = `<div class="empty">오답노트가 비어 있어요 👍<br><br>카드에서 ‘몰라요’를 누르거나<br>퀴즈에서 틀리면 여기 모여요</div>`; return; }
  app.innerHTML = `<div class="btns"><button class="btn" id="wc">🃏 카드로 복습</button><button class="btn" id="wq">✏️ 오답 퀴즈</button></div>
  <div class="lbl">${L.length}개 · ★ 누르면 빠져요</div>${L.map(wordRow).join('')}`;
  bindRows();
  document.getElementById('wc').onclick = () => cards(L, wrongNote);
  document.getElementById('wq').onclick = () => quiz(L, 'ek', wrongNote);
}

// ----- 찾기 -----
function search() {
  setHead('🔍 단어 찾기');
  app.innerHTML = `<input type="search" id="q" placeholder="영어나 뜻으로 검색 (예: apple, 사과)" autocomplete="off"><div id="res" class="empty">전체 ${WORDS.length}단어에서 찾아요</div>`;
  const inp = document.getElementById('q'), res = document.getElementById('res');
  inp.oninput = () => {
    const s = inp.value.trim().toLowerCase();
    if (!s) { res.className = 'empty'; res.innerHTML = `전체 ${WORDS.length}단어에서 찾아요`; return; }
    const L = WORDS.filter(w => w.w.toLowerCase().includes(s) || w.m.includes(s)).slice(0, 60);
    res.className = ''; res.innerHTML = L.length ? L.map(w => wordRow(w).replace('</b>', `</b><span class="chip">${LV[w.l]}</span>`)).join('') : '<div class="empty">없는 단어예요</div>';
    bindRows(res);
  };
  inp.focus();
}

// ----- 설정 -----
function settings() {
  setHead('⚙️ 설정', home);
  app.innerHTML = `
  <label class="toggle">카드 넘길 때 자동 발음 <input type="checkbox" id="auto" ${S.auto ? 'checked' : ''}></label>
  <div class="lbl">발음</div>
  <div class="seg"><button data-ac="en-US" class="${S.accent === 'en-US' ? 'on' : ''}">🇺🇸 미국식</button><button data-ac="en-GB" class="${S.accent === 'en-GB' ? 'on' : ''}">🇬🇧 영국식</button></div>
  <div class="lbl">말하기 속도</div>
  <div class="seg">${[[0.6, '느리게'], [0.85, '보통'], [1, '빠르게']].map(([r, t]) => `<button data-r="${r}" class="${S.rate == r ? 'on' : ''}">${t}</button>`).join('')}</div>
  <button class="btn ghost" id="test">🔊 발음 테스트 (beautiful)</button>
  <div class="lbl">발음기호는 미국식 기준이에요</div>
  <button class="btn ghost" id="reset" style="color:var(--bad);margin-top:30px">학습 기록 초기화</button>`;
  document.getElementById('auto').onchange = e => { S.auto = e.target.checked; save(); };
  app.querySelectorAll('[data-ac]').forEach(b => b.onclick = () => { S.accent = b.dataset.ac; save(); settings(); speak('Hello'); });
  app.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { S.rate = +b.dataset.r; save(); settings(); });
  document.getElementById('test').onclick = () => speak('beautiful');
  document.getElementById('reset').onclick = () => {
    if (confirm('외운 단어·오답노트·진도를 모두 지울까요?')) { S.known.clear(); S.wrong.clear(); S.done.clear(); save(); home(); }
  };
}

home();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
