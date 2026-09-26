/* ============================================================
   TACTIX — Εμπειρία χρήστη (αυτόνομο αρχείο, δεν αγγίζει το app.js)
   · Γενική αναζήτηση (/ ή Ctrl+K): σελίδες, τακτικές, σχέδια, ασκήσεις, παίκτες, αγώνες
   · Υποδοχή πρώτης χρήσης
   · Υπενθύμιση αντιγράφου ασφαλείας
   Χρησιμοποιεί μόνο το δημόσιο App API και διαβάζει τα δεδομένα από το localStorage.
   ============================================================ */
(() => {
  const DB_KEY = "cosmos_coach_v1", UX_KEY = "tactix_ux";
  const ux = (() => { try { return JSON.parse(localStorage.getItem(UX_KEY)) || {}; } catch (_) { return {}; } })();
  const saveUx = () => { try { localStorage.setItem(UX_KEY, JSON.stringify(ux)); } catch (_) {} };
  const db = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || {}; } catch (_) { return {}; } };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  /* ελληνικά ↔ λατινικά: «κλοπ» βρίσκει «Klopp», «ροντο» βρίσκει «Rondo» */
  const GR2LAT = [["ντ","nd"],["μπ","mb"],["γκ","gk"],["γγ","ng"],["ου","ou"],["θ","th"],["χ","ch"],["ψ","ps"],["α","a"],["β","v"],["γ","g"],["δ","d"],["ε","e"],["ζ","z"],["η","i"],["ι","i"],["κ","k"],["λ","l"],["μ","m"],["ν","n"],["ξ","x"],["ο","o"],["π","p"],["ρ","r"],["σ","s"],["ς","s"],["τ","t"],["υ","y"],["φ","f"],["ω","o"]];
  const latin = s => { let t = s; for (const [g, l] of GR2LAT) t = t.split(g).join(l); return t.replace(/y/g,"i").replace(/w/g,"o").replace(/(.)\1/g,"$1").replace(/c(?!h)/g,"k").replace(/mb/g,"b").replace(/nd/g,"d"); };

  /* ---------- Στυλ ---------- */
  const css = document.createElement("style");
  css.textContent = `
  #uxBg{position:fixed;inset:0;background:rgba(3,6,14,.72);backdrop-filter:blur(4px);z-index:700;display:none;align-items:flex-start;justify-content:center;padding:7vh 14px 14px;overflow:auto}
  #uxBg.open{display:flex}
  #uxBg .ux-box{background:var(--panel);border:1px solid var(--line2);border-radius:16px;box-shadow:var(--shadow);width:100%;max-width:680px;padding:18px;animation:uxIn .18s ease-out}
  @keyframes uxIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .ux-in{display:flex;align-items:center;gap:10px;border:1px solid var(--line2);border-radius:12px;padding:6px 12px;background:var(--bg2)}
  .ux-in input{flex:1;background:transparent;border:0;color:var(--txt);font-size:16px;padding:8px 0;outline:none}
  .ux-res{margin-top:10px;max-height:58vh;overflow:auto}
  .ux-it{display:flex;gap:12px;align-items:center;padding:9px 10px;border-radius:10px;cursor:pointer}
  .ux-it .ic{font-size:20px;width:26px;text-align:center}.ux-it>div{flex:1;min-width:0}
  .ux-it small{display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ux-it.on,.ux-it:hover{background:rgba(228,34,47,.14)}
  .ux-tag{font-size:11px;padding:2px 7px;border-radius:6px;border:1px solid var(--line2);color:var(--mut)}
  .ux-kbd{background:var(--bg2);border:1px solid var(--line2);border-bottom-width:2px;border-radius:5px;padding:0 5px;font:11px Consolas,monospace;color:var(--txt)}
  .ux-hint{margin-top:8px;text-align:right;color:var(--mut);font-size:12px}
  .ux-tip{display:flex;gap:12px;padding:10px 12px;border-radius:11px;background:var(--panel2);border-left:3px solid var(--blue);margin-bottom:8px}
  .ux-tip .ic{font-size:20px}.ux-tip b{display:block}.ux-tip span{color:var(--mut);font-size:13px}
  .ux-foot{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}
  #uxBackup{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:300;max-width:min(640px,calc(100vw - 24px));display:flex;gap:12px;align-items:center;background:var(--panel2);border:1px solid var(--amber);border-radius:14px;padding:10px 14px;box-shadow:var(--shadow)}
  #uxBackup .ic{font-size:22px}#uxBackup span{color:var(--mut);font-size:12.5px;display:block}
  .ux-search-btn{font-size:15px;line-height:1}
  @media(orientation:landscape) and (max-height:560px){#uxBg{padding:8px}#uxBg .ux-box{max-height:calc(100vh - 16px);overflow:auto}}
  `;
  document.head.appendChild(css);

  /* ---------- Παράθυρο ---------- */
  function open(html, lock) {
    let bg = document.getElementById("uxBg");
    if (!bg) { bg = document.createElement("div"); bg.id = "uxBg"; document.body.appendChild(bg);
      bg.addEventListener("click", e => { if (e.target === bg && !bg.dataset.lock) close(); }); }
    bg.dataset.lock = lock ? "1" : ""; bg.innerHTML = `<div class="ux-box" role="dialog" aria-modal="true">${html}</div>`;
    bg.classList.add("open"); return bg;
  }
  function close() { const bg = document.getElementById("uxBg"); if (bg) { bg.classList.remove("open"); bg.innerHTML = ""; } }

  /* ---------- 1) Αναζήτηση ---------- */
  const PAGES = [["dashboard","🏠","Πίνακας"],["squad","👥","Ρόστερ"],["tactics","♟️","Τακτικές"],["playbook","📐","Σχέδια / στημένες"],["training","🏋️","Προπονήσεις"],["matches","⚽","Αγώνες"],["analytics","📊","Αναλυτικά"],["schedule","📅","Πρόγραμμα"],["academy","🎓","Ακαδημία Τακτικής"]];
  const S = { q: "", sel: 0, items: [] };
  function items(q) {
    const n = norm(q), nl = latin(n), d = db(), hit = s => { const t = norm(s); return t.includes(n) || latin(t).includes(nl); };
    const act = [
      { ic:"💾", l:"Εξαγωγή αντιγράφου ασφαλείας", sub:"Ενέργεια", t:"ενέργεια", fn:() => App.export() },
      { ic:"🔗", l:"Εισαγωγή από DATA COACH 360°", sub:"Ρόστερ · ενέργεια", t:"ενέργεια", fn:() => { App.go("squad"); App.importDataCoach && App.importDataCoach(); } },
      { ic:"⛶", l:"Πλήρης οθόνη", sub:"Ενέργεια", t:"ενέργεια", fn:() => App.fullscreen && App.fullscreen() },
      { ic:"❓", l:"Οδηγός υποδοχής", sub:"Βοήθεια", t:"βοήθεια", fn:welcome }
    ];
    const pages = PAGES.map(([id, ic, l]) => ({ ic, l, sub:"Σελίδα", t:"σελίδα", fn:() => App.go(id) }));
    if (!n) return act.concat(pages);
    const tac = (d.tactics || []).filter(t => hit(t.name) || hit(t.coach) || hit(t.formation) || (t.style || []).some(hit)).slice(0, 8)
      .map(t => ({ ic:t.emoji || "♟️", l:t.name, sub:`${t.coach || ""} · ${t.formation || ""}`, t:"τακτική", fn:() => { App.go("tactics"); App.openTactic(t.id); } }));
    const pl = (d.players || []).filter(p => hit(p.name) || hit(p.pos)).slice(0, 8)
      .map(p => ({ ic:"👤", l:p.name, sub:`${p.pos} · ${p.age || ""} ετών`, t:"παίκτης", fn:() => { App.go("squad"); App.viewPlayer(p.id); } }));
    const pla = (d.plays || []).filter(p => hit(p.name) || hit(p.cat)).slice(0, 6)
      .map(p => ({ ic:p.emoji || "📐", l:p.name, sub:"Σχέδιο", t:"σχέδιο", fn:() => { App.go("playbook"); if (p.cat && App.playCat) App.playCat(p.cat); App.openPlay(p.id); } }));
    const dr = (d.drills || []).filter(x => hit(x.name) || hit(x.cat)).slice(0, 6)
      .map(x => ({ ic:"🏋️", l:x.name, sub:`${x.cat || ""} · ${x.dur || "?"}′`, t:"άσκηση", fn:() => { App.go("training"); App.viewDrill(x.id); } }));
    const mt = (d.matches || []).filter(m => hit(m.opp) || hit(m.comp)).slice(0, 5)
      .map(m => ({ ic:"⚽", l:`vs ${m.opp}`, sub:`${m.date || ""} · ${m.status === "played" ? `${m.gf}-${m.ga}` : "επερχόμενος"}`, t:"αγώνας", fn:() => { App.go("matches"); App.openMatch(m.id); } }));
    return act.filter(a => hit(a.l)).concat(pages.filter(p => hit(p.l)), tac, pl, pla, dr, mt).slice(0, 24);
  }
  function draw() {
    S.items = items(S.q); const box = document.getElementById("uxRes"); if (!box) return;
    box.innerHTML = S.items.length ? S.items.map((it, i) => `<div class="ux-it ${i === S.sel ? "on" : ""}" data-i="${i}"><span class="ic">${it.ic}</span><div><b>${esc(it.l)}</b><small>${esc(it.sub || "")}</small></div><span class="ux-tag">${it.t}</span></div>`).join("")
      : `<div style="padding:24px;text-align:center;color:var(--mut)">Δεν βρέθηκε τίποτα για «${esc(S.q)}».</div>`;
    box.querySelectorAll(".ux-it").forEach(el => el.onclick = () => run(S.items[+el.dataset.i]));
    const on = box.querySelector(".ux-it.on"); if (on) on.scrollIntoView({ block:"nearest" });
  }
  function run(it) { close(); S.q = ""; try { it.fn(); } catch (e) { console.error(e); } }
  function search() {
    try { App.closeModal(); } catch (_) {}
    open(`<div class="ux-in"><span>🔎</span><input id="uxQ" type="search" autocomplete="off" placeholder="Τακτική, προπονητής, παίκτης, άσκηση, σχέδιο, αγώνας ή σελίδα…"><span class="ux-kbd">Esc</span></div>
      <div id="uxRes" class="ux-res"></div><div class="ux-hint">↑↓ επιλογή · Enter άνοιγμα · <span class="ux-kbd">/</span> ή <span class="ux-kbd">Ctrl</span>+<span class="ux-kbd">K</span> από οπουδήποτε</div>`);
    const inp = document.getElementById("uxQ"); inp.value = S.q; setTimeout(() => inp.focus(), 30);
    inp.oninput = () => { S.q = inp.value; S.sel = 0; draw(); };
    inp.onkeydown = e => {
      if (e.key === "ArrowDown") { S.sel = Math.min(S.items.length - 1, S.sel + 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { S.sel = Math.max(0, S.sel - 1); draw(); e.preventDefault(); }
      else if (e.key === "Enter" && S.items[S.sel]) run(S.items[S.sel]);
    };
    draw();
  }
  document.addEventListener("keydown", e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "") || (e.target && e.target.isContentEditable);
    const bg = document.getElementById("uxBg");
    if (e.key === "Escape" && bg && bg.classList.contains("open") && !bg.dataset.lock) { close(); return; }
    if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); search(); }
    else if (e.key === "/" && !typing && !(bg && bg.classList.contains("open"))) { e.preventDefault(); search(); }
  });

  /* ---------- 2) Υποδοχή πρώτης χρήσης ---------- */
  function welcome() {
    open(`<div style="display:flex;gap:14px;align-items:center;margin-bottom:10px"><div style="width:52px;height:52px;flex:0 0 52px;border-radius:14px;background:var(--acc);display:grid;place-items:center;font-size:24px">⚽</div>
      <div><h2 style="margin:0;font-size:21px">Καλώς ήρθες στο TACTIX</h2><div style="color:var(--mut)">Τακτικές, σχέδια, προπονήσεις και αγώνες — σε υπολογιστή, κινητό και τάμπλετ.</div></div></div>
      <div class="ux-tip"><span class="ic">🏷️</span><div><b>Βάλε την ομάδα σου</b><span>Όνομα, συντομογραφία και βασικό σύστημα — πάτα το σήμα της ομάδας πάνω δεξιά.</span></div></div>
      <div class="ux-tip"><span class="ic">♟️</span><div><b>Ξεκίνα από μια τακτική μεγάλου προπονητή</b><span>Guardiola, Klopp, Mendilíbar… Σύρε πιόνια, βάλε κινήσεις & πάσες, και «🖥️ Προβολή» για τα αποδυτήρια.</span></div></div>
      <div class="ux-tip"><span class="ic">🔎</span><div><b>Αναζήτηση παντού</b><span>Πάτα <span class="ux-kbd">/</span> ή <span class="ux-kbd">Ctrl</span>+<span class="ux-kbd">K</span> (ή το 🔎) για τακτικές, παίκτες, ασκήσεις και σχέδια.</span></div></div>
      <div class="ux-tip"><span class="ic">📱</span><div><b>Γύρνα το κινητό/τάμπλετ οριζόντια</b><span>Το γήπεδο χωράει ολόκληρο δίπλα στα εργαλεία. Το ⛶ δίνει πλήρη οθόνη.</span></div></div>
      <div class="ux-tip"><span class="ic">🔗</span><div><b>Σύνδεση με DATA COACH 360°</b><span>Ρόστερ από πραγματικά στατιστικά, προτεινόμενη 11άδα και report αντιπάλου — Ρόστερ → «🔗 DATA COACH».</span></div></div>
      <div class="ux-tip" style="border-left-color:var(--amber)"><span class="ic">💾</span><div><b>Τα δεδομένα σου μένουν στη συσκευή</b><span>Κράτα αντίγραφο με «⭳ Εξαγωγή» — θα σου το θυμίζουμε.</span></div></div>
      <div class="ux-foot"><button class="btn ghost" id="uxClub">🏷️ Ρύθμιση ομάδας</button><button class="btn primary" id="uxGo">Ξεκίνα 🚀</button></div>`, true);
    const done = () => { ux.onboarded = true; saveUx(); close(); };
    document.getElementById("uxGo").onclick = () => { done(); App.go("tactics"); };
    document.getElementById("uxClub").onclick = () => { done(); App.editClub(); };
  }

  /* ---------- 3) Υπενθύμιση αντιγράφου ασφαλείας ---------- */
  const DAY = 864e5;
  function hasOwnWork(d) {
    return (d.tactics || []).some(t => t.custom) || (d.sessions || []).length || (d.events || []).length ||
      (d.plays || []).some(p => p.custom) || (d.drills || []).some(x => x.custom) || (d.matches || []).some(m => m.status === "played") || !!d.dcBridge;
  }
  function backupCheck() {
    const old = document.getElementById("uxBackup"); if (old) old.remove();
    const d = db(); if (!hasOwnWork(d)) return;
    const last = ux.lastBackup || 0;
    if (Date.now() - last < 14 * DAY || Date.now() < (ux.snooze || 0)) return;
    const el = document.createElement("div"); el.id = "uxBackup";
    el.innerHTML = `<span class="ic">💾</span><div style="flex:1"><b>${last ? `Τελευταίο αντίγραφο πριν από ${Math.floor((Date.now() - last) / DAY)} ημέρες` : "Δεν έχεις κρατήσει αντίγραφο ασφαλείας"}</b>
      <span>Οι τακτικές, οι προπονήσεις και οι αγώνες σου ζουν μόνο σε αυτόν τον browser.</span></div>
      <button class="btn sm primary" id="uxBkNow">Εξαγωγή τώρα</button><button class="btn sm ghost" id="uxBkLater">Αργότερα</button>`;
    document.body.appendChild(el);
    document.getElementById("uxBkNow").onclick = () => { App.export(); };
    document.getElementById("uxBkLater").onclick = () => { ux.snooze = Date.now() + 7 * DAY; saveUx(); el.remove(); };
  }

  /* ---------- Σύνδεση με την εφαρμογή ---------- */
  function start() {
    if (typeof App === "undefined") return;
    // κάθε «Εξαγωγή» καταγράφεται ως αντίγραφο ασφαλείας
    const exp = App.export;
    App.export = function () { const r = exp.apply(this, arguments); ux.lastBackup = Date.now(); ux.snooze = 0; saveUx(); const b = document.getElementById("uxBackup"); if (b) b.remove(); return r; };
    App.search = search; App.welcome = welcome;
    // κουμπί 🔎 στην κεφαλίδα
    const bar = document.querySelector("header .top-actions");
    if (bar && !document.getElementById("uxSearchBtn")) {
      const b = document.createElement("button"); b.id = "uxSearchBtn"; b.className = "btn sm ghost ux-search-btn"; b.title = "Αναζήτηση (/ ή Ctrl+K)"; b.textContent = "🔎";
      b.onclick = search; bar.insertBefore(b, bar.firstChild);
      window.dispatchEvent(new Event("resize"));   // ξαναμέτρηση ύψους κεφαλίδας (--hdr)
    }
    if (!ux.onboarded) setTimeout(welcome, 500);
    else setTimeout(backupCheck, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0));
  else setTimeout(start, 0);
})();
