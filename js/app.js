/* ============================================================
   TACTIX — Κύρια εφαρμογή
   ============================================================ */
/* Λογότυπο TACTIX — κόμβος + βέλος τρεξίματος + διακεκομμένη πάσα (ταμπλό τακτικής) */
function LOGO_SVG(px){
  const s = px ? `width="${px}" height="${px}"` : `width="100%" height="100%"`;
  return `<svg viewBox="0 0 100 100" ${s} xmlns="http://www.w3.org/2000/svg" style="display:block">
    <defs><linearGradient id="txg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ef3742"/><stop offset="1" stop-color="#a3121b"/></linearGradient></defs>
    <rect x="5" y="5" width="90" height="90" rx="24" fill="url(#txg)"/>
    <g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
      <path d="M31 71 L63 35" stroke-width="11"/>
      <path d="M63 35 l-16 2 M63 35 l-2 16" stroke-width="9"/>
      <path d="M72 72 L42 46" stroke-width="7" stroke-dasharray="0.5 12"/>
    </g>
    <circle cx="31" cy="71" r="7" fill="#fff"/>
  </svg>`;
}

const App = (() => {
  const KEY = "cosmos_coach_v1";
  let DB, state = { view:"dashboard", tacticId:null, designer:null, cmpA:null, cmpB:null, drawTab:"buildup", boardTool:"move", dTool:"move", playId:null, playCat:"setpiece", playTool:"move", boardLabels:"role", oppSymbol:"blank", oppColor:"#64748b" };

  /* ---------- Αποθήκευση ---------- */
  function load(){
    try{ DB = JSON.parse(localStorage.getItem(KEY)); }catch(e){ DB=null; }
    if(!DB){
      DB = {
        club:{ name:"Η Ομάδα μου", short:"FC", formation:"4-3-3" },
        players: PLAYERS_SEED,
        tactics: TACTICS_SEED.map(t=>({...t, custom:false})),
        drills: DRILLS_SEED.map(d=>({...d, custom:false})),
        plays: PLAYS_SEED.map(p=>({...p, custom:false})),
        sessions: [],
        matches: [ demoMatch() ],
        microcycle: defaultMicro(),
        events: []
      };
      save();
    }
    // ασφάλεια για παλιές εκδόσεις
    DB.microcycle = DB.microcycle || defaultMicro();
    DB.events = DB.events || [];
    // merge νέων seed τακτικών/ασκήσεων (χωρίς να χαθούν τα δικά σου)
    let added=false;
    TACTICS_SEED.forEach(t=>{ if(!DB.tactics.some(x=>x.id===t.id)){ DB.tactics.push({...t,custom:false}); added=true; } });
    DRILLS_SEED.forEach(d=>{ if(!DB.drills.some(x=>x.id===d.id)){ DB.drills.push({...d,custom:false}); added=true; } });
    DB.plays = DB.plays || [];
    PLAYS_SEED.forEach(p=>{ if(!DB.plays.some(x=>x.id===p.id)){ DB.plays.push({...p,custom:false}); added=true; } });
    // migration πεδίων παίκτη (ύψος/βάρος/θέσεις/καταλληλότητα)
    DB.players.forEach(pl=>{
      if(pl.height==null) pl.height=180;
      if(pl.weight==null) pl.weight=75;
      if(!pl.pastPositions) pl.pastPositions=[pl.pos];
      if(!pl.suitability) pl.suitability={[pl.pos]:"good"};
      if(!pl.status) pl.status="fit";
      added=true;
    });
    if(added) save();
    // επαναφορά custom σχηματισμών (δεν υπάρχουν στο FORMATIONS μετά από reload)
    DB.tactics.forEach(t=>{ if(t.customPositions && !FORMATIONS[t.formation]) FORMATIONS[t.formation]=t.customPositions.map(p=>({r:p.r,x:p.x,y:p.y})); });
    recomputeStats();
  }

  /* Επανυπολογισμός συνόλων παικτών από τα στατιστικά ανά αγώνα */
  function recomputeStats(){
    const agg={}; DB.players.forEach(p=>{ agg[p.id]={min:0,g:0,a:0,ratings:[]}; });
    DB.matches.filter(m=>m.status==="played" && m.playerStats).sort((a,b)=>(a.date||"").localeCompare(b.date||""))
      .forEach(m=>{ Object.entries(m.playerStats).forEach(([pid,s])=>{ const a=agg[pid]; if(!a) return;
        a.min+=(+s.min||0); a.g+=(+s.g||0); a.a+=(+s.a||0); if(+s.rating>0) a.ratings.push(+s.rating); }); });
    DB.players.forEach(p=>{ const a=agg[p.id];
      p.minutes=a.min; p.goals=a.g; p.assists=a.a; p.ratings=a.ratings; p.matches=a.ratings.length;
      p.avgRating=a.ratings.length? +(a.ratings.reduce((x,y)=>x+y,0)/a.ratings.length).toFixed(1) : 0;
      p.form=a.ratings.slice(-5); });
  }
  function ratingColor(r){ return r>=8?"#fbbf24": r>=7?"#38bdf8": r>=6?"#f59e0b": r>0?"#ef4444":"#64748b"; }
  /* Διαθεσιμότητα παικτών */
  const STATUS={
    fit:{t:"Διαθέσιμος", ic:"✅", c:"#22d3ee", chip:"b"},
    doubtful:{t:"Αμφίβολος", ic:"⚠️", c:"#f59e0b", chip:"a"},
    injured:{t:"Τραυματίας", ic:"🚑", c:"#ef4444", chip:"r"},
    suspended:{t:"Τιμωρία", ic:"🟥", c:"#a855f7", chip:"p"}
  };
  const isAvailable=p=>!p.status||p.status==="fit"||p.status==="doubtful";
  function statusBadge(p, small){
    const s=STATUS[p.status]||STATUS.fit; if(p.status==="fit"||!p.status) return small?"":"";
    return `<span class="chip ${s.chip}" style="font-size:${small?'10px':'11.5px'}" title="${esc(s.t)}${p.returnDate?' — επιστροφή '+fmtDate(p.returnDate):''}">${s.ic} ${esc(s.t)}</span>`;
  }
  function save(){ localStorage.setItem(KEY, JSON.stringify(DB)); }

  function demoMatch(){
    return { id:"m_demo", opp:"ΑΕΚ Β'", date:nextSaturday(), home:true, comp:"Πρωτάθλημα",
      formation:"4-3-3", tacticId:"my-hybrid", gf:null, ga:null, status:"upcoming",
      oppNotes:"Παίζουν 4-2-3-1, επικίνδυνοι στη μετάβαση. Αδύναμοι στον αέρα.",
      scorers:[], lineup:[] };
  }
  function nextSaturday(){
    const d=new Date(); d.setDate(d.getDate()+((6-d.getDay()+7)%7||7));
    return d.toISOString().slice(0,10);
  }
  function defaultMicro(){
    // Tactical Periodization microcycle (εβδομάδα με 1 ματς)
    return [
      {day:"Δευτέρα",  code:"MD+1", load:25, name:"Αποθεραπεία", color:"#38bdf8",
        items:["Ελαφριά αποκατάσταση / recovery run","Πισίνα / κινητικότητα","Video ανάλυσης προηγ. αγώνα"]},
      {day:"Τρίτη",    code:"MD-4", load:70, name:"Δύναμη / Ένταση", color:"#ef4444",
        items:["Προθέρμανση RAMP","Ρόντο υψηλής έντασης","Small-sided 4v4 (υπο-αρχές)","Εκρηκτικά / δύναμη"]},
      {day:"Τετάρτη",  code:"MD-3", load:100, name:"Αντοχή / Τακτική (peak)", color:"#f59e0b",
        items:["Positional games μεγάλου χώρου","11v11 τακτική (κύριος σχηματισμός)","Μεγάλο τακτικό όγκο — peak εβδομάδας"]},
      {day:"Πέμπτη",   code:"MD-2", load:55, name:"Ταχύτητα / Μεταβάσεις", color:"#3b82f6",
        items:["Counter-press transition games","Ταχύτητα & αντιδράσεις","Τελείωμα / cut-backs"]},
      {day:"Παρασκευή",code:"MD-1", load:35, name:"Ενεργοποίηση / Στημένες", color:"#a855f7",
        items:["Χαμηλός όγκος, υψηλή ένταση σε μικρά","Στημένες φάσεις (υπέρ & κατά)","Απομνημόνευση πλάνου αγώνα"]},
      {day:"Σάββατο",  code:"MD",   load:100, name:"ΑΓΩΝΑΣ", color:"#e11d48",
        items:["Προαγωνιστική προθέρμανση","ΑΓΩΝΑΣ","Εφαρμογή πλάνου"]},
      {day:"Κυριακή",  code:"OFF",  load:0, name:"Ρεπό", color:"#64748b",
        items:["Ξεκούραση","Προαιρετική ελαφριά κίνηση"]}
    ];
  }

  /* ---------- Βοηθητικά ---------- */
  const $ = s => document.querySelector(s);
  const esc = s => (s==null?"":(""+s)).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }
  function avg(arr){ return arr.length? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
  function ovr(pl){ const v=Object.values(pl.attrs); return Math.round(avg(v)); }
  function attrColor(v){ return v>=15?"#fbbf24": v>=12?"#f59e0b": v>=9?"#fb923c":"#64748b"; }
  function loadColor(l){ return l>=90?"#ef4444": l>=60?"#f59e0b": l>=30?"#3b82f6":"#64748b"; }

  /* ---------- Modal ---------- */
  function modal(title, bodyHTML, footHTML){
    $("#modal").innerHTML = `<header><h3 style="margin:0">${title}</h3><button class="x" onclick="App.closeModal()">×</button></header>
      <div class="body">${bodyHTML}</div>${footHTML?`<div class="foot">${footHTML}</div>`:""}`;
    $("#modalBg").classList.add("open");
  }
  function closeModal(){ $("#modalBg").classList.remove("open"); }

  /* ---------- Navigation ---------- */
  const NAV = [
    {id:"dashboard", ic:"🏠", t:"Πίνακας"},
    {id:"squad",     ic:"👥", t:"Ρόστερ"},
    {id:"tactics",   ic:"♟️", t:"Τακτικές"},
    {id:"playbook",  ic:"📐", t:"Σχέδια"},
    {id:"training",  ic:"🏋️", t:"Προπονήσεις"},
    {id:"matches",   ic:"⚽", t:"Αγώνες"},
    {id:"analytics", ic:"📊", t:"Αναλυτικά"},
    {id:"schedule",  ic:"📅", t:"Πρόγραμμα"},
    {id:"academy",   ic:"🎓", t:"Ακαδημία Τακτικής"}
  ];
  function renderNav(){
    $("#nav").innerHTML = NAV.map(n=>`<button class="${n.id===state.view?'active':''}" onclick="App.go('${n.id}')">
      <span class="ico">${n.ic}</span>${n.t}</button>`).join("");
  }
  function go(v){ state.view=v; renderNav();
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
    $("#view-"+v).classList.add("active");
    ({dashboard:renderDashboard,squad:renderSquad,tactics:renderTactics,playbook:renderPlaybook,training:renderTraining,
      matches:renderMatches,analytics:renderAnalytics,schedule:renderSchedule,academy:renderAcademy}[v])();
    window.scrollTo(0,0);
  }

  /* ============================================================
     1) DASHBOARD
     ============================================================ */
  function renderDashboard(){
    const next = DB.matches.filter(m=>m.status==="upcoming").sort((a,b)=>a.date.localeCompare(b.date))[0];
    const days = next? Math.ceil((new Date(next.date)-new Date())/864e5) : null;
    const played = DB.matches.filter(m=>m.status==="played");
    const w=played.filter(m=>m.gf>m.ga).length, d=played.filter(m=>m.gf===m.ga).length, l=played.filter(m=>m.gf<m.ga).length;
    const ages = DB.players.map(p=>p.age);
    const curTac = DB.tactics.find(t=>t.id===DB.club.formation) || DB.tactics.find(t=>t.formation===DB.club.formation) || DB.tactics[DB.tactics.length-1];

    $("#view-dashboard").innerHTML = `
    <div class="sectionhead">
      <h2>🏠 Πίνακας Ελέγχου</h2>
      <div class="sub2">${esc(DB.club.name)} · Σχηματισμός βάσης ${esc(DB.club.formation)}</div>
    </div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="kpi"><div class="ic">👥</div><div class="stat"><b>${DB.players.length}</b><span>Παίκτες ρόστερ</span></div></div>
      <div class="kpi"><div class="ic">📈</div><div class="stat"><b>${Math.round(avg(DB.players.map(ovr)))||0}</b><span>Μ.Ο. αξιολόγησης</span></div></div>
      <div class="kpi"><div class="ic">🎂</div><div class="stat"><b>${ages.length?Math.round(avg(ages)):0}</b><span>Μ.Ο. ηλικίας</span></div></div>
      <div class="kpi"><div class="ic">🏆</div><div class="stat"><b>${w}-${d}-${l}</b><span>Ν-Ι-Η (${played.length} αγ.)</span></div></div>
    </div>
    ${(()=>{ const out=DB.players.filter(p=>!isAvailable(p)); if(!out.length) return ""; return `
    <div class="card" style="margin-bottom:16px;border-color:#7f1d1d;cursor:pointer" onclick="App.go('squad')">
      <h3 style="margin:0">🚑 Θέματα Διαθεσιμότητας <span class="tag">${out.length}</span></h3>
      <div class="pill-row" style="margin-top:8px">${out.map(p=>{const s=STATUS[p.status]||STATUS.fit;return `<span class="chip ${s.chip}">${s.ic} ${esc(shortName(p.name))}${p.returnDate?' · ↩ '+fmtDate(p.returnDate):''}</span>`;}).join("")}</div>
    </div>`; })()}

    <div class="grid g2">
      <div class="card">
        <h3>⚽ Επόμενος Αγώνας <span class="tag">match center</span></h3>
        ${next? `
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px">
            <div style="font-size:40px">${days<=0?'🔴':'🗓️'}</div>
            <div>
              <div style="font-size:20px;font-weight:800">${esc(DB.club.short)} ${next.home?'🆚':'@'} ${esc(next.opp)}</div>
              <div class="sub">${esc(next.comp)} · ${fmtDate(next.date)} · ${days<=0?'ΣΗΜΕΡΑ':'σε '+days+' ημέρες'}</div>
            </div>
          </div>
          <div class="sub"><b>Πλάνο:</b> ${esc((DB.tactics.find(t=>t.id===next.tacticId)||{}).name||'—')} · Σχηματισμός ${esc(next.formation)}</div>
          <div class="sub" style="margin-top:6px"><b>Αντίπαλος:</b> ${esc(next.oppNotes||'—')}</div>
          <div style="margin-top:12px"><button class="btn primary sm" onclick="App.go('matches')">Άνοιγμα Match Center →</button></div>
        ` : `<div class="empty"><div class="big">🗓️</div>Δεν υπάρχει προγραμματισμένος αγώνας.<br><button class="btn sm primary" style="margin-top:10px" onclick="App.go('matches')">Πρόσθεσε αγώνα</button></div>`}
      </div>

      <div class="card">
        <h3>♟️ Τρέχουσα Τακτική <span class="tag">${esc(curTac.coach||'')}</span></h3>
        <div style="font-size:16px;font-weight:800;margin-bottom:4px">${curTac.emoji||'⚽'} ${esc(curTac.name)}</div>
        <div class="sub" style="margin-bottom:10px">${esc(curTac.summary)}</div>
        <div class="pill-row">${(curTac.style||[]).map(s=>`<span class="chip g">${esc(s)}</span>`).join("")}</div>
        <div style="margin-top:12px"><button class="btn blue sm" onclick="App.go('tactics');App.openTactic('${curTac.id}')">Ανάλυση τακτικής →</button></div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>📅 Εβδομαδιαίος Μικρόκυκλος <span class="tag">Tactical Periodization</span></h3>
      ${microHTML()}
      <div class="legend">
        <span><i class="dotc" style="background:#3b82f6"></i>Χαμηλό φορτίο</span>
        <span><i class="dotc" style="background:#f59e0b"></i>Peak (MD-3)</span>
        <span><i class="dotc" style="background:#ef4444"></i>Υψηλή ένταση</span>
        <span><i class="dotc" style="background:#e11d48"></i>Αγώνας</span>
      </div>
    </div>`;
  }

  function microHTML(){
    return `<div class="micro">${DB.microcycle.map((m,i)=>`
      <div class="md">
        <div class="dh"><span>${esc(m.day)}</span><span>${esc(m.code)}</span></div>
        <div class="dname">${esc(m.name)}</div>
        <div class="load-bar"><i style="width:${m.load}%;background:${m.color}"></i></div>
        <ul>${m.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      </div>`).join("")}</div>`;
  }
  function fmtDate(s){ if(!s) return "—"; const d=new Date(s); return d.toLocaleDateString("el-GR",{weekday:'short',day:'2-digit',month:'short'}); }

  /* ============================================================
     2) ΡΟΣΤΕΡ
     ============================================================ */
  const POS_ORDER = ["ΤΦ","ΣΤ","ΔΑ","ΑΑ","ΑΜ","ΚΜ","10","ΔΕ","ΑΕ","ΕΠ","F9"];
  function renderSquad(){
    const players = [...DB.players].sort((a,b)=>POS_ORDER.indexOf(a.pos)-POS_ORDER.indexOf(b.pos));
    const out=DB.players.filter(p=>!isAvailable(p));
    const availLine = out.length? ` · <span style="color:#ef4444">🚑 ${out.length} εκτός</span>` : ` · <span style="color:#22d3ee">όλοι διαθέσιμοι</span>`;
    $("#view-squad").innerHTML = `
      <div class="sectionhead">
        <h2>👥 Ρόστερ & Ανάλυση Παικτών</h2>
        <div class="sub2">${DB.players.length} παίκτες${availLine}</div>
        <div class="sp">
          <button class="btn sm ghost" onclick="App.importDataCoach()">🔗 DATA COACH</button>
          <button class="btn sm ghost" onclick="App.exportExcelRoster()">⬇ Excel</button>
          <button class="btn primary sm" onclick="App.editPlayer()">＋ Νέος Παίκτης</button>
        </div>
      </div>
      <div class="card">
        <div class="tbl-wrap">
        <table>
          <thead><tr><th>Παίκτης</th><th>Θέση</th><th class="center">Κατάσταση</th><th class="center">Ηλικ.</th><th class="center">Υ/Β</th><th class="center">OVR</th>
          <th>Φυσ. κατάσταση</th><th>Ηθικό</th><th class="center">Λεπτά</th><th class="center">Γκολ/Ασ</th><th></th></tr></thead>
          <tbody>${players.map(pl=>{
            const o=ovr(pl); const st=STATUS[pl.status]||STATUS.fit;
            return `<tr style="${!isAvailable(pl)?'opacity:.62':''}">
              <td><b>${esc(pl.name)}</b></td>
              <td><span class="chip">${esc(pl.pos)}</span></td>
              <td class="center"><button class="btn sm ghost" title="Κλικ για αλλαγή κατάστασης" style="padding:3px 8px;color:${st.c}" onclick="App.cycleStatus('${pl.id}')">${st.ic} ${pl.status&&pl.status!=='fit'?esc(st.t):''}</button></td>
              <td class="center">${pl.age}</td>
              <td class="center" style="color:var(--mut);font-size:12px">${pl.height||'—'}<span style="color:var(--dim)">/</span>${pl.weight||'—'}</td>
              <td class="center"><b style="color:${attrColor(o)}">${o}</b></td>
              <td>${bar(pl.fitness,'#22d3ee')}</td>
              <td>${bar(pl.morale,'#3b82f6')}</td>
              <td class="center">${pl.minutes||0}</td>
              <td class="center">${pl.goals||0}/${pl.assists||0}</td>
              <td class="right">
                <button class="btn sm" onclick="App.viewPlayer('${pl.id}')">Ανάλυση</button>
                <button class="btn sm ghost" onclick="App.editPlayer('${pl.id}')">✎</button>
              </td></tr>`;
          }).join("")}</tbody>
        </table>
        </div>
      </div>`;
  }
  function bar(v,c){ v=Math.max(0,Math.min(100,v||0)); return `<div class="attr-bar" style="width:90px"><i style="width:${v}%;background:${c}"></i></div>`; }
  function cycleStatus(id){ const order=["fit","doubtful","injured","suspended"]; const p=DB.players.find(x=>x.id===id); p.status=order[(order.indexOf(p.status||"fit")+1)%order.length]; if(p.status==="fit"){delete p.returnDate;delete p.statusNote;} save(); renderSquad(); }
  function suitabilityHTML(pl){
    const s=pl.suitability||{[pl.pos]:"good"};
    const groups={good:[],ok:[],no:[]};
    POS_ORDER.forEach(pos=>{ if(s[pos]) groups[s[pos]].push(pos); });
    const row=lvl=>groups[lvl].length? `<div style="display:grid;grid-template-columns:74px 1fr;gap:8px;align-items:center;margin-bottom:6px">
       <span class="chip ${SUIT[lvl].c}">${SUIT[lvl].t}</span>
       <div class="pill-row">${groups[lvl].map(x=>`<span class="chip">${esc(x)}</span>`).join("")}</div></div>`:"";
    const html=row("good")+row("ok")+row("no");
    return html || '<div class="sub">Δεν έχει οριστεί καταλληλότητα.</div>';
  }

  function viewPlayer(id){
    const pl = DB.players.find(p=>p.id===id); if(!pl) return;
    const entries = Object.entries(pl.attrs);
    modal(`${esc(pl.name)} — ${ROLE_NAMES[pl.pos]||pl.pos}`, `
      <div class="pmodal">
        <div>${radarSVG(entries, Pitch.roleColor(pl.pos))}</div>
        <div>
          <div class="stat" style="margin-bottom:10px"><b style="color:${attrColor(ovr(pl))}">${ovr(pl)}</b><span>Συνολική Αξιολόγηση (OVR)</span></div>
          <div class="mini-bars">${entries.map(([k,v])=>`
            <div class="mb"><b style="color:var(--txt);text-align:left">${esc(k)}</b>
              <div class="attr-bar"><i style="width:${v/20*100}%;background:${attrColor(v)}"></i></div>
              <b>${v}</b></div>`).join("")}</div>
          <div class="row" style="margin-top:12px">
            <div class="kpi" style="padding:8px 10px"><div class="ic" style="width:34px;height:34px;font-size:16px">📏</div><div class="stat"><b style="font-size:18px">${pl.height||'—'}<small style="font-size:11px;color:var(--mut)"> cm</small></b><span>Ύψος</span></div></div>
            <div class="kpi" style="padding:8px 10px"><div class="ic" style="width:34px;height:34px;font-size:16px">⚖️</div><div class="stat"><b style="font-size:18px">${pl.weight||'—'}<small style="font-size:11px;color:var(--mut)"> kg</small></b><span>Βάρος</span></div></div>
          </div>
          <div class="row" style="margin-top:10px">
            <div><label>Φυσ. κατάσταση</label><div>${bar(pl.fitness,'#22d3ee')} ${pl.fitness}%</div></div>
            <div><label>Ηθικό</label><div>${bar(pl.morale,'#3b82f6')} ${pl.morale}%</div></div>
          </div>
        </div>
      </div>
      <div class="detail-block" style="margin-top:14px"><h4>🎽 Θέσεις που έχει παίξει</h4>
        <div class="pill-row">${(pl.pastPositions&&pl.pastPositions.length?pl.pastPositions:[pl.pos]).map(x=>`<span class="chip b">${esc(x)}<small style="color:var(--dim)"> ${esc(ROLE_NAMES[x]||'')}</small></span>`).join("")}</div></div>
      ${pl.avgRating>0?`<div class="detail-block"><h4>⭐ Επίδοση σε Αγώνες</h4>
        <div class="pill-row" style="align-items:center">
          <span class="chip" style="font-size:13px">Μ.Ο. <b style="color:${ratingColor(pl.avgRating)}">${pl.avgRating.toFixed(1)}</b></span>
          <span class="chip">${pl.matches||0} αγ.</span>
          <span class="chip">${pl.goals||0} ⚽</span><span class="chip">${pl.assists||0} 🅰️</span>
          <span class="chip">${pl.minutes||0}′</span>
          <span style="margin-left:4px">Φόρμα: ${(pl.form||[]).map(r=>`<span title="${r}" style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-left:2px;background:${ratingColor(r)}"></span>`).join("")||'—'}</span>
        </div></div>`:''}
      <div class="detail-block"><h4>🎯 Καταλληλότητα Θέσεων</h4>
        ${suitabilityHTML(pl)}</div>
      ${pl.notes?`<div class="detail-block"><h4>📝 Σημειώσεις</h4><div class="sub">${esc(pl.notes)}</div></div>`:""}`,
      `<button class="btn" onclick="App.editPlayer('${pl.id}')">✎ Επεξεργασία</button>
       <button class="btn primary" onclick="App.closeModal()">Κλείσιμο</button>`);
  }

  function editPlayer(id){
    const pl = id? DB.players.find(p=>p.id===id) : null;
    const attrKeys = pl? Object.keys(pl.attrs) : ["ταχύτητα","πάσα","τεχνική","σουτ","τάκλιν","αντοχή"];
    const attrRows = attrKeys.map(k=>`
      <div class="mb" style="display:grid;grid-template-columns:1fr 90px;gap:8px;align-items:center;margin-bottom:6px">
        <label style="margin:0">${esc(k)}</label>
        <input type="number" min="1" max="20" value="${pl?pl.attrs[k]:12}" data-attr="${esc(k)}"></div>`).join("");
    modal(pl?"Επεξεργασία Παίκτη":"Νέος Παίκτης", `
      <div class="row"><div class="field"><label>Όνομα</label><input id="pName" value="${pl?esc(pl.name):''}"></div>
        <div class="field" style="max-width:130px"><label>Θέση</label>
          <select id="pPos">${POS_ORDER.map(p=>`<option ${pl&&pl.pos===p?'selected':''}>${p}</option>`).join("")}</select></div>
        <div class="field" style="max-width:90px"><label>Ηλικία</label><input type="number" id="pAge" value="${pl?pl.age:22}"></div></div>
      <div class="row"><div class="field"><label>Ύψος (cm)</label><input type="number" id="pHt" value="${pl?pl.height:180}"></div>
        <div class="field"><label>Βάρος (kg)</label><input type="number" id="pWt" value="${pl?pl.weight:75}"></div>
        <div class="field"><label>Φυσ. κατάσταση %</label><input type="number" id="pFit" value="${pl?pl.fitness:90}"></div>
        <div class="field"><label>Ηθικό %</label><input type="number" id="pMor" value="${pl?pl.morale:80}"></div></div>
      <div class="row"><div class="field"><label>🩺 Διαθεσιμότητα</label>
          <select id="pStatus">${Object.entries(STATUS).map(([k,s])=>`<option value="${k}" ${((pl&&pl.status)||'fit')===k?'selected':''}>${s.ic} ${s.t}</option>`).join("")}</select></div>
        <div class="field"><label>Αναμ. επιστροφή</label><input type="date" id="pReturn" value="${pl&&pl.returnDate?pl.returnDate:''}"></div>
        <div class="field"><label>Σημείωση κατάστασης</label><input id="pStatusNote" value="${pl&&pl.statusNote?esc(pl.statusNote):''}" placeholder="π.χ. θλάση δικεφάλου"></div></div>
      <div class="field"><label>Θέσεις που έχει παίξει (χωρισμένες με κόμμα)</label>
        <input id="pPast" value="${pl?esc((pl.pastPositions||[]).join(', ')):''}" placeholder="π.χ. ΚΜ, 10, ΑΜ"></div>
      <div class="detail-block"><h4>Χαρακτηριστικά (1-20)</h4><div id="pAttrs">${attrRows}</div>
        <button class="btn sm ghost" onclick="App.addAttrRow()">＋ Χαρακτηριστικό</button></div>
      <div class="detail-block"><h4>🎯 Καταλληλότητα ανά θέση</h4>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px">
          ${POS_ORDER.map(pos=>{ const cur=pl&&pl.suitability?pl.suitability[pos]:''; return `
            <div style="display:grid;grid-template-columns:44px 1fr;gap:6px;align-items:center">
              <span class="chip">${pos}</span>
              <select data-suit="${pos}">
                <option value="" ${!cur?'selected':''}>—</option>
                <option value="good" ${cur==='good'?'selected':''}>Καλά</option>
                <option value="ok" ${cur==='ok'?'selected':''}>Μέτρια</option>
                <option value="no" ${cur==='no'?'selected':''}>Καθόλου</option>
              </select></div>`; }).join("")}
        </div></div>
      <div class="field"><label>Σημειώσεις</label><textarea id="pNotes">${pl?esc(pl.notes):''}</textarea></div>`,
      `${pl?`<button class="btn danger" onclick="App.delPlayer('${pl.id}')">Διαγραφή</button>`:''}
       <button class="btn" onclick="App.closeModal()">Άκυρο</button>
       <button class="btn primary" onclick="App.savePlayer('${id||''}')">Αποθήκευση</button>`);
  }
  function addAttrRow(){
    const div=document.createElement("div"); div.className="mb";
    div.style.cssText="display:grid;grid-template-columns:1fr 90px;gap:8px;align-items:center;margin-bottom:6px";
    div.innerHTML=`<input type="text" placeholder="όνομα χαρακτηριστικού" oninput="this.nextElementSibling.dataset.attr=this.value.trim()">
      <input type="number" min="1" max="20" value="12" data-attr="">`;
    $("#pAttrs").appendChild(div); div.querySelector('input').focus();
  }
  function savePlayer(id){
    const attrs={}; document.querySelectorAll('#pAttrs input[data-attr]').forEach(i=>{ const k=(i.dataset.attr||'').trim(); if(k) attrs[k]=Math.max(1,Math.min(20,+i.value||1)); });
    const suitability={}; document.querySelectorAll('select[data-suit]').forEach(s=>{ if(s.value) suitability[s.dataset.suit]=s.value; });
    const past=$("#pPast").value.split(",").map(x=>x.trim()).filter(Boolean);
    const pos=$("#pPos").value;
    if(!suitability[pos]) suitability[pos]="good"; // η κύρια θέση πάντα «Καλά» τουλάχιστον
    const data={ name:$("#pName").value.trim()||"Παίκτης", pos, age:+$("#pAge").value||20,
      height:+$("#pHt").value||180, weight:+$("#pWt").value||75,
      pastPositions: past.length?past:[pos], suitability,
      status:$("#pStatus").value||"fit", returnDate:$("#pReturn").value||"", statusNote:$("#pStatusNote").value.trim(),
      fitness:+$("#pFit").value||90, morale:+$("#pMor").value||80, attrs, notes:$("#pNotes").value.trim() };
    if(id){ Object.assign(DB.players.find(p=>p.id===id), data); }
    else { DB.players.push({ id:"pl_"+Math.random().toString(36).slice(2,9), minutes:0,goals:0,assists:0, ...data }); }
    save(); closeModal(); renderSquad(); toast("Αποθηκεύτηκε");
  }
  function delPlayer(id){ if(!confirm("Διαγραφή παίκτη;")) return; DB.players=DB.players.filter(p=>p.id!==id); save(); closeModal(); renderSquad(); }

  /* radar SVG */
  function radarSVG(entries, color){
    const n=entries.length, cx=90,cy=90,R=72, max=20;
    const pt=(i,r)=>[cx+r*Math.cos(-Math.PI/2+i*2*Math.PI/n), cy+r*Math.sin(-Math.PI/2+i*2*Math.PI/n)];
    let grid="";
    [0.25,0.5,0.75,1].forEach(f=>{ grid+=`<polygon points="${entries.map((_,i)=>pt(i,R*f).join(",")).join(" ")}" fill="none" stroke="#2f4370" stroke-width="1"/>`; });
    entries.forEach((_,i)=>{ const[x,y]=pt(i,R); grid+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#2f4370" stroke-width="1"/>`; });
    const poly=entries.map(([_,v],i)=>pt(i,R*Math.min(v,max)/max).join(",")).join(" ");
    const labels=entries.map(([k],i)=>{ const[x,y]=pt(i,R+13); return `<text x="${x}" y="${y}" font-size="9" fill="#9fb0cc" text-anchor="middle" dominant-baseline="middle">${esc(k)}</text>`; }).join("");
    return `<svg viewBox="0 0 180 180" style="width:100%;max-width:280px">
      ${grid}<polygon points="${poly}" fill="${color}44" stroke="${color}" stroke-width="2"/>
      ${entries.map(([_,v],i)=>{const[x,y]=pt(i,R*Math.min(v,max)/max);return `<circle cx="${x}" cy="${y}" r="2.4" fill="${color}"/>`;}).join("")}
      ${labels}</svg>`;
  }

  /* ============================================================
     3) ΤΑΚΤΙΚΕΣ
     ============================================================ */
  function renderTactics(){
    if(!state.tacticId) state.tacticId = DB.tactics[0].id;
    $("#view-tactics").innerHTML = `
      <div class="sectionhead">
        <h2>♟️ Τακτικές — Πίνακας & Ανάλυση</h2>
        <div class="sub2">Βιβλιοθήκη μεγάλων προπονητών + δικές σου</div>
        <div class="sp">
          <button class="btn sm" onclick="App.openDesigner()">✏️ Σχεδιαστής Τακτικής</button>
          <button class="btn primary sm" onclick="App.newTactic()">＋ Νέα Τακτική</button>
        </div>
      </div>
      <div class="board-wrap">
        <div class="card">
          <div id="boardArea"></div>
        </div>
        <div>
          <div class="card" style="margin-bottom:16px">
            <h3>📚 Βιβλιοθήκη Τακτικών</h3>
            <div id="tacList" style="max-height:320px;overflow:auto">${DB.tactics.map(t=>`
              <div class="list-item ${t.id===state.tacticId?'sel':''}" onclick="App.openTactic('${t.id}')">
                <div class="em">${t.emoji||'⚽'}</div>
                <div class="meta"><b>${esc(t.name)}</b><small>${esc(t.coach||'')} · ${esc(t.formation)}</small></div>
                ${t.custom?'<span class="chip a">δική μου</span>':''}
              </div>`).join("")}</div>
          </div>
          <div class="card" id="tacDetail"></div>
        </div>
      </div>`;
    openTactic(state.tacticId);
  }

  function openTactic(id){
    state.tacticId=id; state.designer=null;
    const t = DB.tactics.find(x=>x.id===id); if(!t) return;
    // κάθε τακτική κρατά τα ΔΙΚΑ της πιόνια (θέσεις + ρόλοι) — δεν επηρεάζει τις άλλες
    if(!t.positions){
      t.positions = (FORMATIONS[t.formation]||t.customPositions||FORMATIONS["4-3-3"]).map(p=>({r:p.r,x:p.x,y:p.y}));
      save();
    }
    document.querySelectorAll("#tacList .list-item").forEach(el=>el.classList.remove("sel"));
    drawTactBoard(t);
    renderTacticDetail(t);
    const li=[...document.querySelectorAll("#tacList .list-item")].find(el=>el.getAttribute("onclick").includes("'"+id+"'"));
    if(li) li.classList.add("sel");
  }

  /* ετικέτες πιονιών: Θέσεις / Αριθμοί / Ονόματα */
  function bestPlayerFor(r, used){
    const order={good:0, ok:1, "":2, no:3};
    const cands=DB.players.filter(p=>!used.has(p.id)).map(p=>({p, s:(p.suitability&&p.suitability[r])||(p.pos===r?"good":"")}));
    cands.sort((a,b)=>(order[a.s]??2)-(order[b.s]??2));
    return cands[0]?cands[0].p:null;
  }
  function labelsFor(positions, xi){
    const mode=state.boardLabels; let oi=0;
    const oppLbl=()=>{ oi++; return state.oppSymbol==="x"?"✕": state.oppSymbol==="number"?String(oi):" "; };
    if(mode==="name"){ const used=new Set();
      const subs=positions.map((p,i)=>{ if(p.opp) return ""; let pl=null; if(xi&&xi[i]) pl=DB.players.find(x=>x.id===xi[i]); if(!pl) pl=bestPlayerFor(p.r,used); if(pl){used.add(pl.id); return shortName(pl.name);} return ""; });
      return {labels: positions.map(p=>p.opp?oppLbl():p.r), subs};
    }
    if(mode==="number"){ let n=0; return {labels: positions.map(p=> p.opp?oppLbl():String(++n)), subs:null}; }
    return {labels: positions.map(p=>p.opp?oppLbl():p.r), subs:null};
  }
  const LBL_NEXT={role:"number", number:"name", name:"role"};
  const LBL_TXT={role:"🔤 Θέσεις", number:"🔢 Αριθμοί", name:"👤 Ονόματα"};
  const OPPSYM_NEXT={blank:"x", x:"number", number:"blank"};
  const OPPSYM_TXT={blank:"Αντ: ●", x:"Αντ: ✕", number:"Αντ: №"};
  function cycleOppSymbol(which){ state.oppSymbol=OPPSYM_NEXT[state.oppSymbol]; redrawCurrentBoard(which); }
  function toggleOppColor(which){ state.oppColor = state.oppColor==="#64748b" ? "#111827" : "#64748b"; redrawCurrentBoard(which); }
  function redrawCurrentBoard(which){
    if(which==="play") drawPlayBoard(DB.plays.find(p=>p.id===state.playId));
    else if(which==="board") renderBoard();
    else drawTactBoard(DB.tactics.find(t=>t.id===state.tacticId));
  }
  /* Αποθήκευση ταμπλό ως εικόνα PNG */
  function downloadDataUrl(name, url){ const a=document.createElement("a"); a.href=url; a.download=name; a.click(); }
  async function saveBoardImage(kind, id){
    toast("Δημιουργία εικόνας…");
    let positions, arrows, ball, xi, nm;
    if(kind==="play"){ const p=DB.plays.find(x=>x.id===id); positions=p.tokens; arrows=p.arrows; ball=p.ball; nm=p.name; }
    else { const t=DB.tactics.find(x=>x.id===id); positions=t.positions; arrows=t.movements; ball=t.ball; xi=t.nameXI; nm=t.name; }
    const {labels,subs}=labelsFor(positions, xi);
    const url=await pitchPng(positions, {arrows:arrows||[], ball:ball||null, labels, subs, oppColor:state.oppColor});
    if(url) downloadDataUrl("TACTIX-Tamplo-"+slug(nm)+".png", url); else toast("Σφάλμα εικόνας");
  }
  /* Ρύθμιση βασικών (starters) για τα ονόματα — per τακτική t.nameXI[posIndex]=playerId */
  function setNameXI(id){
    const t=DB.tactics.find(x=>x.id===id); const xi=t.nameXI||{};
    const order={good:0, ok:1, "":2, no:3};
    const opts=(r,sel)=>{ const sc=DB.players.map(p=>({p,s:(p.suitability&&p.suitability[r])||(p.pos===r?"good":"")})); sc.sort((a,b)=>(order[a.s]??2)-(order[b.s]??2)||a.p.name.localeCompare(b.p.name));
      return `<option value="">— αυτόματο —</option>`+sc.map(({p,s})=>`<option value="${p.id}" ${sel===p.id?"selected":""}>${esc(p.name)} (${p.pos})${s==="good"?" ✓":s==="ok"?" ~":s==="no"?" ✕":""}</option>`).join(""); };
    const rows=t.positions.map((p,i)=> p.opp?"":`<div style="display:grid;grid-template-columns:46px 1fr;gap:6px;align-items:center;margin-bottom:5px">
        <span class="chip">${p.r}</span><select data-nx="${i}">${opts(p.r, xi[i])}</select></div>`).join("");
    modal(`👤 Βασικοί για ονόματα — ${esc(t.name)}`,
      `<div class="sub" style="margin-bottom:8px">Διάλεξε ποιος παίκτης εμφανίζεται σε κάθε θέση (λειτουργία «Ονόματα»). «Αυτόματο» = βάσει καταλληλότητας.</div>${rows}`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button>
       <button class="btn ghost" onclick="App.clearNameXI('${id}')">Καθαρισμός</button>
       <button class="btn primary" onclick="App.saveNameXI('${id}')">Αποθήκευση</button>`);
  }
  function saveNameXI(id){ const t=DB.tactics.find(x=>x.id===id); const xi={}; document.querySelectorAll("select[data-nx]").forEach(s=>{ if(s.value) xi[+s.dataset.nx]=s.value; }); t.nameXI=xi; state.boardLabels="name"; save(); closeModal(); drawTactBoard(t); toast("Βασικοί ορίστηκαν"); }
  function clearNameXI(id){ const t=DB.tactics.find(x=>x.id===id); delete t.nameXI; save(); closeModal(); drawTactBoard(t); }

  function drawTactBoard(t){
    const {labels,subs}=labelsFor(t.positions, t.nameXI);
    Pitch.render($("#boardArea"), t.positions, {
      arrows:t.movements||[], draggable:true, tool:state.boardTool, labels, subs, oppColor:state.oppColor,
      onMove:()=>save(),
      onToken:(i)=>assignRole(t.id,i),
      onArrow:(from,to,type)=>{ (t.movements=t.movements||[]).push({from,to,type}); save(); drawTactBoard(t); },
      onErase:(kind,idx)=>{ if(kind==="arrow") t.movements.splice(idx,1); else { const tk=t.positions[idx]; if(tk&&(tk.opp||tk.added)) t.positions.splice(idx,1); } save(); drawTactBoard(t); }
    });
    const seg = (v,ic,lbl)=>`<button class="${state.boardTool===v?'on':''}" onclick="App.boardTool('${v}')">${ic} ${lbl}</button>`;
    $("#boardArea").insertAdjacentHTML("afterbegin", `
      <div class="tools">
        <div style="font-weight:800;font-size:15px">${t.emoji||'⚽'} ${esc(t.name)}</div>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span class="chip">${esc(t.formation)}</span>
          <button class="btn sm blue" onclick="App.whiteboard('${t.id}')">🖊️ Πίνακας</button>
          <button class="btn sm blue" onclick="App.present('${t.id}')">🖥️ Προβολή</button>
          <button class="btn sm ghost" onclick="App.printTactic('${t.id}')">⇩ PDF</button>
          <button class="btn sm ghost" onclick="App.exportWordTactic('${t.id}')">⬇ Word</button>
          <button class="btn sm ghost" onclick="App.saveBoardImage('tactic','${t.id}')">📷 Εικόνα</button>
          <button class="btn sm primary" onclick="App.useTactic('${t.id}')">Βασική</button>
        </div>
      </div>
      <div class="tools">
        <div class="seg">${seg('move','🖐','Θέσεις')}${seg('run','➡️','Κίνηση')}${seg('pass','⚡','Πάσα')}<button class="${state.boardTool==='erase'?'on':''}" onclick="App.boardTool('erase')">🧽 Γόμα</button></div>
        <button class="btn sm ghost" onclick="App.addOpp('${t.id}')">＋ Αντίπαλος</button>
        <button class="btn sm ghost" onclick="App.cycleOppSymbol('tactic')" title="Σύμβολο αντιπάλων">${OPPSYM_TXT[state.oppSymbol]}</button>
        <button class="btn sm ghost" onclick="App.toggleOppColor('tactic')" title="Χρώμα αντιπάλων"><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${state.oppColor};vertical-align:middle"></span></button>
        <button class="btn sm ghost" onclick="App.cycleLabels('tactic')">${LBL_TXT[state.boardLabels]}</button>
        <button class="btn sm ghost" onclick="App.setNameXI('${t.id}')" title="Βασικοί για ονόματα">👤 Βασικοί</button>
        <button class="btn sm ghost" onclick="App.clearArrows('${t.id}')">🗑️ Βελάκια</button>
        <span class="sub" style="font-size:11.5px">${boardHint(state.boardTool)}</span>
      </div>
      <div class="legend" style="margin-bottom:8px">
        <span><i class="dotc" style="background:#e4222f"></i>Δικοί</span>
        <span><i class="dotc" style="background:#64748b"></i>Αντίπαλοι</span>
        <span><i class="dotc" style="background:#fde047"></i>Κίνηση</span>
        <span><i class="dotc" style="background:#38bdf8"></i>Πάσα</span>
      </div>`);
  }
  function boardHint(tool){
    return tool==='move'?'Σύρε πιόνι · κλικ σε πιόνι για ΡΟΛΟ':
      tool==='erase'?'Άγγιξε βέλος για σβήσιμο (ή αντίπαλο πιόνι για αφαίρεση)':
      'Σύρε πάνω στο γήπεδο για να τραβήξεις βέλος';
  }
  function boardTool(v){ state.boardTool=v; drawTactBoard(DB.tactics.find(t=>t.id===state.tacticId)); }
  function clearArrows(id){ const t=DB.tactics.find(x=>x.id===id); t.movements=[]; save(); drawTactBoard(t); toast("Καθαρίστηκαν τα βελάκια"); }
  function addOpp(id){ const t=DB.tactics.find(x=>x.id===id); (t.positions=t.positions||[]).push({r:"ΕΠ",x:50,y:52,opp:true,added:true,label:" "}); save(); drawTactBoard(t); toast("Προστέθηκε αντίπαλος (σύρε τον)"); }
  function cycleLabels(which){
    state.boardLabels=LBL_NEXT[state.boardLabels];
    if(which==='play') drawPlayBoard(DB.plays.find(p=>p.id===state.playId));
    else if(which==='board') renderBoard();
    else drawTactBoard(DB.tactics.find(t=>t.id===state.tacticId));
  }

  /* ---- Λειτουργία Προβολής (Presentation / Projector) ---- */
  const PR_SLIDES=[{k:"overview"},{k:"buildup"},{k:"attack"},{k:"defense"},{k:"transition"}];
  function present(id){
    const t=DB.tactics.find(x=>x.id===id); if(!t) return;
    if(!t.positions){ t.positions=(FORMATIONS[t.formation]||t.customPositions||FORMATIONS["4-3-3"]).map(p=>({r:p.r,x:p.x,y:p.y})); save(); }
    state.present={id, slide:0, arrows:true, tool:"move"};
    let ov=$("#present"); if(!ov){ ov=document.createElement("div"); ov.id="present"; document.body.appendChild(ov); }
    ov.classList.add("on");
    ov.ontouchstart=e=>{ ov._tx=e.changedTouches[0].clientX; };
    ov.ontouchend=e=>{ const dx=e.changedTouches[0].clientX-(ov._tx||0); if(Math.abs(dx)>50) presentNav(dx<0?1:-1); };
    document.addEventListener("keydown", presentKey);
    renderPresent();
    try{ const rf=ov.requestFullscreen||ov.webkitRequestFullscreen; if(rf){ const r=rf.call(ov); if(r&&r.catch) r.catch(()=>{}); } }catch(_){}
  }
  function renderPresent(){
    const ov=$("#present"); const {id,slide,arrows,tool}=state.present;
    const t=DB.tactics.find(x=>x.id===id); const cur=PR_SLIDES[slide];
    const ballOn=!!t.ball;
    const isOv=cur.k==="overview";
    const title=isOv?"📋 Επισκόπηση Τακτικής":PHASE_LABELS[cur.k].t;
    const dotc=isOv?"#e4222f":(cur.k==="defense"?"#ef4444":cur.k==="transition"?"#f59e0b":"#3b82f6");
    const tag=`<span class="dotc" style="width:16px;height:16px;border-radius:50%;background:${dotc};display:inline-block"></span>`;
    const bullets=isOv?[t.summary, "Στυλ: "+(t.style||[]).join(" · "), "Ένταση: "+(t.intensity||"—"), "Κλειδιά: "+(t.keyRoles||[]).join(" · ")].filter(x=>x&&!/:\s*$/.test(x)) : (t.phases[cur.k]||[]);
    ov.innerHTML=`
      <div class="pr-top">
        <div class="badge" style="width:38px;height:38px;font-size:18px">${LOGO_SVG(20)}</div>
        <div class="name">${t.emoji||""} ${esc(t.name)}</div>
        <span class="chip">${esc(t.formation)}</span>
        <span class="chip b">${esc(t.coach||"")}</span>
        <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <div class="seg">
            <button class="${tool==="move"?"on":""}" onclick="App.presentTool('move')" title="Μετακίνηση παικτών/μπάλας">🖐</button>
            <button class="${tool==="run"?"on":""}" onclick="App.presentTool('run')" title="Βέλος κίνησης">➡️</button>
            <button class="${tool==="pass"?"on":""}" onclick="App.presentTool('pass')" title="Βέλος πάσας">⚡</button>
          </div>
          <button class="btn pr-btn ${ballOn?"blue":"ghost"}" onclick="App.presentBall()" title="Εμφάνιση/κρύψιμο μπάλας">⚽ Μπάλα</button>
          <button class="btn pr-btn ghost" onclick="App.presentClear()" title="Καθαρισμός βελών">🗑️</button>
          <button class="btn pr-btn" onclick="App.presentArrows()">Βελάκια: ${arrows?"ON":"OFF"}</button>
          <button class="btn primary pr-btn" onclick="App.presentAnim()" title="Οι παίκτες τρέχουν στα βελάκια">▶ Κίνηση</button>
          <button class="btn danger pr-btn" onclick="App.presentExit()">✕ Έξοδος</button>
        </div>
      </div>
      <div class="pr-body">
        <div class="pr-pitch" id="prPitch"></div>
        <div class="pr-panel">
          <div class="pr-phase">${tag} ${esc(title)} <span class="chip b" style="font-size:14px;font-weight:700">${slide+1}/${PR_SLIDES.length}</span></div>
          <ul class="pr-list">${bullets.map(b=>`<li>${esc(b)}</li>`).join("")}</ul>
          <div class="sub" style="margin-top:10px;font-size:13px">${tool==="move"?"🖐 Σύρε παίκτες ή τη μπάλα":"Σύρε πάνω στο γήπεδο για βέλος"} · ⚽ για κίνηση με/χωρίς μπάλα</div>
        </div>
      </div>
      <div class="pr-foot">
        <button class="btn pr-btn" onclick="App.presentNav(-1)">← Προηγ.</button>
        <div class="pr-dots">${PR_SLIDES.map((s,i)=>`<span class="pr-dot ${i===slide?"on":""}" onclick="App.presentGo(${i})" title="${i===0?"Επισκόπηση":PHASE_LABELS[s.k].t}"></span>`).join("")}</div>
        <button class="btn primary pr-btn" onclick="App.presentNav(1)">Επόμ. →</button>
      </div>`;
    Pitch.render($("#prPitch"), t.positions, {
      arrows:arrows?(t.movements||[]):[], draggable:true, tool:tool, ball:t.ball||null,
      onMove:()=>save(),
      onArrow:(from,to,type)=>{ (t.movements=t.movements||[]).push({from,to,type}); save(); renderPresent(); },
      onBallMove:(b)=>{ t.ball=b; save(); }
    });
  }
  function presentTool(v){ state.present.tool=v; renderPresent(); }
  function presentBall(){ const t=DB.tactics.find(x=>x.id===state.present.id); if(t.ball) delete t.ball; else t.ball={x:50,y:50}; save(); renderPresent(); }
  function presentClear(){ const t=DB.tactics.find(x=>x.id===state.present.id); t.movements=[]; save(); renderPresent(); }

  /* ---- Animation: οι παίκτες «τρέχουν» στα βελάκια ---- */
  function animateBoard(svg, positions, arrows, ball){
    if(!svg || !arrows || !arrows.length) return;
    const movers=[], used=new Set();
    arrows.forEach(a=>{
      let bi=-1,bd=1e9; positions.forEach((p,i)=>{ if(used.has(i))return; const d=Math.hypot(p.x-a.from[0],p.y-a.from[1]); if(d<bd){bd=d;bi=i;} });
      if(bi>=0 && bd<16){ used.add(bi); const g=svg.querySelector('.tok[data-i="'+bi+'"]'); if(g) movers.push({g, s:Pitch.toXY(positions[bi].x,positions[bi].y), e:Pitch.toXY(a.to[0],a.to[1])}); }
    });
    let ballAnim=null; const ballEl=svg.querySelector('.ball');
    if(ballEl && ball){ const pass=arrows.find(a=>a.type==="pass")||arrows[0]; ballAnim={el:ballEl, s:Pitch.toXY(ball.x,ball.y), e:Pitch.toXY(pass.to[0],pass.to[1])}; }
    if(!movers.length && !ballAnim) return;
    const dur=1600, t0=performance.now();
    (function frame(now){
      const k=Math.min(1,(now-t0)/dur); const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      movers.forEach(m=>m.g.setAttribute("transform",`translate(${m.s.x+(m.e.x-m.s.x)*e},${m.s.y+(m.e.y-m.s.y)*e})`));
      if(ballAnim) ballAnim.el.setAttribute("transform",`translate(${ballAnim.s.x+(ballAnim.e.x-ballAnim.s.x)*e},${ballAnim.s.y+(ballAnim.e.y-ballAnim.s.y)*e})`);
      if(k<1) requestAnimationFrame(frame);
    })(t0);
  }
  function presentAnim(){
    if(!state.present) return;
    if(!state.present.arrows){ state.present.arrows=true; }
    renderPresent();
    const t=DB.tactics.find(x=>x.id===state.present.id);
    const svg=$("#prPitch") && $("#prPitch").querySelector("svg");
    requestAnimationFrame(()=>requestAnimationFrame(()=>animateBoard(svg, t.positions, t.movements||[], t.ball)));
  }

  /* ---- Λευκός Πίνακας (Landscape, γραφίδα) — για το ημίχρονο (τακτικές & σχέδια) ---- */
  function boardParts(){
    const b=state.board;
    if(b.kind==="play"){ const o=DB.plays.find(x=>x.id===b.id); return {o, positions:o.tokens, arrKey:"arrows", emoji:o.emoji||"📐", name:o.name, sub:(PLAY_CATS.find(c=>c.id===o.cat)||{}).t||""}; }
    const o=DB.tactics.find(x=>x.id===b.id); return {o, positions:o.positions, arrKey:"movements", emoji:o.emoji||"♟️", name:o.name, sub:o.formation};
  }
  function whiteboard(id, kind){
    kind = kind||"tactic";
    const o = kind==="play"? DB.plays.find(x=>x.id===id) : DB.tactics.find(x=>x.id===id);
    if(!o) return;
    if(kind==="tactic" && !o.positions) o.positions=(FORMATIONS[o.formation]||FORMATIONS["4-3-3"]).map(p=>({r:p.r,x:p.x,y:p.y}));
    state.board={id, kind, tool:"move"};
    let ov=$("#board"); if(!ov){ ov=document.createElement("div"); ov.id="board"; document.body.appendChild(ov); }
    ov.classList.add("on");
    renderBoard();
    try{ const rf=ov.requestFullscreen||ov.webkitRequestFullscreen;
      if(rf){ const r=rf.call(ov); if(r&&r.then){ r.then(lockLandscape).catch(lockLandscape); } else lockLandscape(); }
      else lockLandscape();
    }catch(_){ lockLandscape(); }
    window.addEventListener("resize", layoutBoard);
  }
  function lockLandscape(){ try{ if(screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(()=>{}); }catch(_){} }
  function renderBoard(){
    const ov=$("#board"); const {o, positions, arrKey, emoji, name, sub}=boardParts(); const tool=state.board.tool; const ballOn=!!o.ball;
    const seg=(v,ic)=>`<button class="${tool===v?"on":""}" onclick="App.boardWTool('${v}')">${ic}</button>`;
    const {labels,subs}=labelsFor(positions, o.nameXI);
    ov.innerHTML=`
      <div class="bd-top">
        <div class="ttl">${emoji} ${esc(name)} <span class="chip">${esc(sub)}</span></div>
        <div class="seg" style="margin-left:auto">${seg("move","🖐")}${seg("run","➡️")}${seg("pass","⚡")}${seg("erase","🧽")}</div>
        <button class="bbtn ${ballOn?"on":""}" onclick="App.boardWBall()" title="Μπάλα">⚽</button>
        <button class="bbtn" onclick="App.boardWOpp()" title="Πρόσθεσε αντίπαλο">＋🟥</button>
        <button class="bbtn" onclick="App.cycleOppSymbol('board')" title="Σύμβολο αντιπάλων">${OPPSYM_TXT[state.oppSymbol]}</button>
        <button class="bbtn" onclick="App.toggleOppColor('board')" title="Χρώμα αντιπάλων"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${state.oppColor};vertical-align:middle"></span></button>
        <button class="bbtn" onclick="App.cycleLabels('board')" title="Ετικέτες">${LBL_TXT[state.boardLabels]}</button>
        <button class="bbtn" onclick="App.boardWImage()" title="Αποθήκευση εικόνας">📷</button>
        <button class="bbtn" onclick="App.boardWUndo()" title="Αναίρεση βέλους">↶</button>
        <button class="bbtn" onclick="App.boardWClear()" title="Καθαρισμός βελών">🗑️</button>
        <button class="bbtn" style="background:#3a1420;border-color:#7f1d1d;color:#fca5a5" onclick="App.boardWExit()">✕</button>
      </div>
      <div class="bd-pitch"><div id="boardPitch"></div></div>`;
    Pitch.render($("#boardPitch"), positions, {
      arrows:o[arrKey]||[], ball:o.ball||null, draggable:true, tool:tool, labels, subs, oppColor:state.oppColor,
      onMove:()=>save(),
      onArrow:(f,to,ty)=>{ (o[arrKey]=o[arrKey]||[]).push({from:f,to,type:ty}); save(); renderBoard(); },
      onBallMove:(b)=>{ o.ball=b; save(); },
      onErase:(kind,idx)=>{ if(kind==="arrow"){ (o[arrKey]||[]).splice(idx,1); } else { const tk=positions[idx]; if(tk&&(tk.opp||tk.added)) positions.splice(idx,1); } save(); renderBoard(); }
    });
    layoutBoard();
    requestAnimationFrame(()=>requestAnimationFrame(layoutBoard));
  }
  function layoutBoard(){
    const wrap=document.querySelector("#board .bd-pitch"); const svg=document.querySelector("#board #pitch");
    if(!wrap||!svg) return;
    let CW=wrap.clientWidth, CH=wrap.clientHeight;
    if(CW<40||CH<40){ CW=window.innerWidth||document.documentElement.clientWidth||900; CH=(window.innerHeight||document.documentElement.clientHeight||600)-58; }
    CW=Math.max(80,CW); CH=Math.max(80,CH);
    let lw,lh;
    if(CW/CH>1.5){ lh=CH-8; lw=lh*1.5; } else { lw=CW-8; lh=lw/1.5; }
    lw=Math.max(60,lw); lh=Math.max(60,lh);
    svg.style.width=lh+"px"; svg.style.height=lw+"px"; svg.style.transform="rotate(90deg)";
  }
  function boardWTool(v){ state.board.tool=v; renderBoard(); }
  function boardWBall(){ const {o}=boardParts(); if(o.ball) delete o.ball; else o.ball={x:50,y:50}; save(); renderBoard(); }
  function boardWOpp(){ const {positions}=boardParts(); positions.push({r:"ΕΠ",x:50,y:52,opp:true,added:true,label:" "}); save(); renderBoard(); toast("Προστέθηκε αντίπαλος (σύρε τον)"); }
  function boardWImage(){ saveBoardImage(state.board.kind, state.board.id); }
  function boardWUndo(){ const {o,arrKey}=boardParts(); if(o[arrKey]&&o[arrKey].length){ o[arrKey].pop(); save(); renderBoard(); } }
  function boardWClear(){ const {o,arrKey}=boardParts(); o[arrKey]=[]; save(); renderBoard(); toast("Καθαρίστηκαν τα βελάκια"); }
  function boardWExit(){ const ov=$("#board"); if(ov) ov.classList.remove("on"); window.removeEventListener("resize", layoutBoard); state.board=null;
    try{ if(screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }catch(_){}
    try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(_){} }
  function presentNav(d){ state.present.slide=Math.max(0,Math.min(PR_SLIDES.length-1,state.present.slide+d)); renderPresent(); }
  function presentGo(i){ state.present.slide=i; renderPresent(); }
  function presentArrows(){ state.present.arrows=!state.present.arrows; renderPresent(); }
  function presentKey(e){
    if(!state.present) return;
    if(e.key==="ArrowRight"||e.key===" "||e.key==="PageDown"){ e.preventDefault(); presentNav(1); }
    else if(e.key==="ArrowLeft"||e.key==="PageUp"){ e.preventDefault(); presentNav(-1); }
    else if(e.key==="Escape"){ presentExit(); }
  }
  function presentExit(){
    const ov=$("#present"); if(ov) ov.classList.remove("on");
    document.removeEventListener("keydown", presentKey);
    state.present=null;
    try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(_){}
  }

  /* ---- Εξαγωγή PDF (offline, μέσω print → «Αποθήκευση ως PDF») ---- */
  function ensurePrint(html, afterRender){
    let pa=$("#printArea"); if(!pa){ pa=document.createElement("div"); pa.id="printArea"; document.body.appendChild(pa); }
    pa.innerHTML=html; document.body.classList.add("printing");
    if(afterRender) afterRender();
    setTimeout(()=>{ window.print(); }, 300);
  }
  function pHead(title, sub){ return `<div class="phead"><div class="lg">${LOGO_SVG(52)}</div><div><h1>${esc(title)}</h1><div class="psub">${esc(sub||"")}</div></div><div class="pbrand">TACTIX</div></div>`; }
  function pFoot(){ return `<div class="pfoot"><span>TACTIX — Επαγγελματικό Εργαλείο Προπονητή Ποδοσφαίρου</span><span>${new Date().toLocaleDateString("el-GR")}</span></div>`; }

  function printTactic(id){
    const t=DB.tactics.find(x=>x.id===id); if(!t) return;
    if(!t.positions) t.positions=(FORMATIONS[t.formation]||FORMATIONS["4-3-3"]).map(p=>({r:p.r,x:p.x,y:p.y}));
    const phases=["buildup","attack","defense","transition"];
    ensurePrint(`<div class="pdoc">
      ${pHead(t.name, (t.coach?t.coach+" · ":"")+(t.team?t.team+" · ":"")+"Σχηματισμός "+t.formation)}
      <div class="pgrid">
        <div class="ppitch" id="printPitch"></div>
        <div>
          <h3>Περιγραφή</h3><p>${esc(t.summary)}</p>
          <div class="pchips">${(t.style||[]).map(s=>`<span class="pchip">${esc(s)}</span>`).join("")}</div>
          <p class="pmeta"><b>Ένταση:</b> ${esc(t.intensity||"—")}<br><b>Κλειδιά:</b> ${(t.keyRoles||[]).join(", ")||"—"}</p>
        </div>
      </div>
      ${phases.map(k=>`<h3>${PHASE_LABELS[k].t}</h3><ul>${(t.phases[k]||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`).join("")}
      ${pFoot()}
    </div>`, ()=> Pitch.render($("#printPitch"), t.positions, {arrows:t.movements||[]}));
  }

  function printSessionDoc(id){
    const s=DB.sessions.find(x=>x.id===id); if(!s) return;
    const drills=s.drills.map(did=>DB.drills.find(d=>d.id===did)).filter(Boolean);
    ensurePrint(`<div class="pdoc">
      ${pHead(s.title, "Πλάνο Προπόνησης · "+(s.goal||"")+" · Σύνολο "+s.total+"′")}
      ${drills.map((d,i)=>`<div class="pdrill"><h4>${i+1}. ${esc(d.name)} — ${d.dur}′ <span style="font-weight:400;color:#666">(${esc(d.cat)} · ${esc(d.intensity)})</span></h4>
        <p><b>🎯 Στόχος:</b> ${esc(d.goal)}</p>
        ${d.setup?`<p><b>⚙️ Στήσιμο:</b> ${esc(d.setup)}</p>`:""}
        ${d.coaching&&d.coaching.length?`<b>🗣️ Coaching points:</b><ul>${d.coaching.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>`:""}
        ${d.progression?`<p><b>📈 Εξέλιξη:</b> ${esc(d.progression)}</p>`:""}</div>`).join("")}
      ${pFoot()}
    </div>`);
  }

  function printMicro(){
    ensurePrint(`<div class="pdoc">
      ${pHead("Εβδομαδιαίος Μικρόκυκλος", "Tactical Periodization · "+DB.club.name)}
      <div class="pmicro">${DB.microcycle.map(m=>`<div class="pmd"><b>${esc(m.day)} · ${esc(m.code)}</b>${esc(m.name)} — ${m.load}%<ul style="padding-left:13px;margin:3px 0">${m.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>
      ${pFoot()}
    </div>`);
  }

  function matchStarters(m){
    const base=FORMATIONS[m.formation]||FORMATIONS["4-3-3"];
    return base.map((p,i)=>{ const pid=m.lineup&&m.lineup[i]; return {r:p.r, pl: pid?DB.players.find(x=>x.id===pid):null}; });
  }
  function printMatch(id){
    const m=DB.matches.find(x=>x.id===id); if(!m) return;
    const tac=DB.tactics.find(t=>t.id===m.tacticId);
    const starters=matchStarters(m);
    const bench=(m.bench||[]).map(pid=>DB.players.find(x=>x.id===pid)).filter(Boolean);
    ensurePrint(`<div class="pdoc">
      ${pHead(DB.club.name+" "+(m.home?"vs":"@")+" "+m.opp, esc(m.comp)+" · "+fmtDate(m.date)+" · Σχηματισμός "+m.formation+(m.status==="played"?" · Αποτέλεσμα "+m.gf+"–"+m.ga:""))}
      <div class="pgrid">
        <div class="ppitch" id="printPitch"></div>
        <div>
          <h3>Ενδεκάδα</h3>
          <table><tr><th>Θέση</th><th>Παίκτης</th></tr>${starters.map(s=>`<tr><td>${s.r}</td><td>${s.pl?esc(s.pl.name):"—"}</td></tr>`).join("")}</table>
          ${bench.length?`<p style="margin-top:8px"><b>Πάγκος:</b> ${bench.map(p=>esc(p.name)+" ("+p.pos+")").join(" · ")}</p>`:""}
        </div>
      </div>
      <h3>Πλάνο</h3><p>${tac?esc(tac.name):"—"}${tac&&tac.summary?" — "+esc(tac.summary):""}</p>
      <h3>Ανάλυση Αντιπάλου</h3><p>${esc(m.oppNotes||"—")}</p>
      ${m.status==="played"&&m.scorers&&m.scorers.length?`<h3>Σκόρερ</h3><p>${m.scorers.map(esc).join(", ")}</p>`:""}
      ${pFoot()}
    </div>`, ()=> Pitch.render($("#printPitch"), matchPositions(m), {}));
  }
  async function exportWordMatch(id){
    const m=DB.matches.find(x=>x.id===id); if(!m) return;
    toast("Δημιουργία Word…");
    const tac=DB.tactics.find(t=>t.id===m.tacticId);
    const starters=matchStarters(m);
    const bench=(m.bench||[]).map(pid=>DB.players.find(x=>x.id===pid)).filter(Boolean);
    const png=await pitchPng(matchPositions(m), {});
    const title=DB.club.short+" vs "+m.opp;
    const body=`<div class="brand">TACTIX</div>
      <h1>${esc(DB.club.name)} ${m.home?"vs":"@"} ${esc(m.opp)}</h1>
      <p class="sub">${esc(m.comp)} · ${fmtDate(m.date)} · Σχηματισμός ${esc(m.formation)}${m.status==="played"?" · Αποτέλεσμα "+m.gf+"–"+m.ga:""}</p>
      ${png?`<img src="${png}" width="300" style="border:1px solid #ccc;margin:6pt 0"/>`:""}
      <h2>Ενδεκάδα</h2>
      <table><tr><th>Θέση</th><th>Παίκτης</th></tr>${starters.map(s=>`<tr><td>${s.r}</td><td>${s.pl?esc(s.pl.name):"—"}</td></tr>`).join("")}</table>
      ${bench.length?`<p><b>Πάγκος:</b> ${bench.map(p=>esc(p.name)+" ("+p.pos+")").join(" · ")}</p>`:""}
      <h2>Πλάνο</h2><p>${tac?esc(tac.name):"—"}${tac&&tac.summary?" — "+esc(tac.summary):""}</p>
      <h2>Ανάλυση Αντιπάλου</h2><p>${esc(m.oppNotes||"—")}</p>
      ${m.status==="played"&&m.scorers&&m.scorers.length?`<h2>Σκόρερ</h2><p>${m.scorers.map(esc).join(", ")}</p>`:""}
      <p class="sub">TACTIX — ${new Date().toLocaleDateString("el-GR")}</p>`;
    downloadBlob("TACTIX-Agonas-"+slug(m.opp)+".doc","application/msword", docSkeleton(title, body));
    toast("Word έτοιμο ✓");
  }

  /* ---- Εξαγωγή Word (.doc) & Excel (.xls) — offline, χωρίς βιβλιοθήκες ---- */
  function downloadBlob(name, mime, content){
    const b=new Blob(["﻿"+content],{type:mime});
    const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  function slug(s){ return (s||"").replace(/[^\wά-ώΑ-Ω0-9]+/gi,"_").replace(/_+/g,"_").slice(0,40)||"export"; }
  function docSkeleton(title, body){
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:Calibri,Arial,sans-serif;color:#111;font-size:11pt}
h1{color:#111;font-size:18pt;margin:0 0 2pt} h2{color:#c81b28;font-size:13pt;border-bottom:1px solid #e6c9cc;padding-bottom:2px;margin:12pt 0 4pt}
.sub{color:#555;font-size:9pt} .brand{color:#e4222f;font-weight:bold;font-size:14pt;letter-spacing:1px}
table{border-collapse:collapse;width:100%} td,th{border:1px solid #bbb;padding:5px;font-size:9pt} th{background:#f2d5d7;color:#111;text-align:left}
ul{margin:3pt 0}</style></head><body>${body}</body></html>`;
  }
  function svgToPng(svgString,w,h){
    return new Promise(res=>{
      try{
        const img=new Image(); const blob=new Blob([svgString],{type:"image/svg+xml;charset=utf-8"});
        const url=URL.createObjectURL(blob);
        img.onload=()=>{ try{ const c=document.createElement("canvas"); c.width=w;c.height=h; const x=c.getContext("2d");
          x.fillStyle="#12203c"; x.fillRect(0,0,w,h); x.drawImage(img,0,0,w,h); URL.revokeObjectURL(url); res(c.toDataURL("image/png")); }catch(e){ res(""); } };
        img.onerror=()=>{ URL.revokeObjectURL(url); res(""); };
        img.src=url;
      }catch(e){ res(""); }
    });
  }
  function pitchPng(positions, opts){
    const div=document.createElement("div"); div.style.cssText="position:fixed;left:-9999px;top:0;width:440px";
    document.body.appendChild(div);
    Pitch.render(div, positions, opts||{});
    const svg=div.querySelector("svg"); svg.setAttribute("width",440); svg.setAttribute("height",660);
    svg.setAttribute("xmlns","http://www.w3.org/2000/svg");
    const s=new XMLSerializer().serializeToString(svg);
    document.body.removeChild(div);
    return svgToPng(s,440,660);
  }
  const tacticPng = t => pitchPng(t.positions, {arrows:t.movements||[], ball:t.ball||null});
  async function exportWordTactic(id){
    const t=DB.tactics.find(x=>x.id===id); if(!t) return;
    if(!t.positions) t.positions=(FORMATIONS[t.formation]||FORMATIONS["4-3-3"]).map(p=>({r:p.r,x:p.x,y:p.y}));
    toast("Δημιουργία Word…");
    const png=await tacticPng(t);
    const phases=["buildup","attack","defense","transition"];
    const body=`<div class="brand">TACTIX</div>
      <h1>${esc(t.name)}</h1>
      <p class="sub">${esc(t.coach||"")} · ${esc(t.team||"")} · Σχηματισμός ${esc(t.formation)}</p>
      ${png?`<img src="${png}" width="320" style="border:1px solid #ccc;margin:6pt 0"/>`:""}
      <h2>Περιγραφή</h2><p>${esc(t.summary)}</p>
      <p><b>Στυλ:</b> ${(t.style||[]).join(", ")}<br><b>Ένταση:</b> ${esc(t.intensity||"—")}<br><b>Κλειδιά:</b> ${(t.keyRoles||[]).join(", ")||"—"}</p>
      ${phases.map(k=>`<h2>${PHASE_LABELS[k].t}</h2><ul>${(t.phases[k]||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`).join("")}
      <p class="sub">TACTIX — ${new Date().toLocaleDateString("el-GR")}</p>`;
    downloadBlob("TACTIX-Taktiki-"+slug(t.name)+".doc","application/msword", docSkeleton(t.name, body));
    toast("Word έτοιμο ✓");
  }
  function exportWordSession(id){
    const s=DB.sessions.find(x=>x.id===id); if(!s) return;
    const drills=s.drills.map(did=>DB.drills.find(d=>d.id===did)).filter(Boolean);
    const body=`<div class="brand">TACTIX</div><h1>${esc(s.title)}</h1>
      <p class="sub">Πλάνο Προπόνησης · ${esc(s.goal||"")} · Σύνολο ${s.total}′</p>
      ${drills.map((d,i)=>`<h2>${i+1}. ${esc(d.name)} — ${d.dur}′</h2>
        <p><b>Στόχος:</b> ${esc(d.goal)}</p>${d.setup?`<p><b>Στήσιμο:</b> ${esc(d.setup)}</p>`:""}
        ${d.coaching&&d.coaching.length?`<b>Coaching points:</b><ul>${d.coaching.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>`:""}
        ${d.progression?`<p><b>Εξέλιξη:</b> ${esc(d.progression)}</p>`:""}`).join("")}
      <p class="sub">TACTIX — ${new Date().toLocaleDateString("el-GR")}</p>`;
    downloadBlob("TACTIX-Proponisi-"+slug(s.title)+".doc","application/msword", docSkeleton(s.title, body));
    toast("Word έτοιμο ✓");
  }
  function exportWordMicro(){
    const body=`<div class="brand">TACTIX</div><h1>Εβδομαδιαίος Μικρόκυκλος</h1>
      <p class="sub">Tactical Periodization · ${esc(DB.club.name)}</p>
      <table><tr><th>Ημέρα</th><th>Κωδ.</th><th>Θέμα</th><th>Φορτίο</th><th>Περιεχόμενο</th></tr>
      ${DB.microcycle.map(m=>`<tr><td>${esc(m.day)}</td><td>${esc(m.code)}</td><td>${esc(m.name)}</td><td>${m.load}%</td><td>${m.items.map(esc).join("; ")}</td></tr>`).join("")}</table>
      <p class="sub">TACTIX — ${new Date().toLocaleDateString("el-GR")}</p>`;
    downloadBlob("TACTIX-Mikrokyklos.doc","application/msword", docSkeleton("Μικρόκυκλος", body));
    toast("Word έτοιμο ✓");
  }
  function exportExcelRoster(){
    const rows=[...DB.players].sort((a,b)=>POS_ORDER.indexOf(a.pos)-POS_ORDER.indexOf(b.pos));
    const head=["Παίκτης","Θέση","Ηλικία","Ύψος (cm)","Βάρος (kg)","OVR","Φυσ.κατ. %","Ηθικό %","Λεπτά","Γκολ","Ασίστ","Θέσεις (έχει παίξει)","Καλά","Μέτρια","Καθόλου","Σημειώσεις"];
    const suit=(p,lvl)=>Object.keys(p.suitability||{}).filter(k=>p.suitability[k]===lvl).join(" ");
    const body=`<h1>Ρόστερ — ${esc(DB.club.name)}</h1><p class="sub">TACTIX · ${new Date().toLocaleDateString("el-GR")}</p>
      <table><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr>
      ${rows.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.pos}</td><td>${p.age}</td><td>${p.height||""}</td><td>${p.weight||""}</td><td>${ovr(p)}</td><td>${p.fitness||""}</td><td>${p.morale||""}</td><td>${p.minutes||0}</td><td>${p.goals||0}</td><td>${p.assists||0}</td><td>${(p.pastPositions||[]).join(" ")}</td><td>${suit(p,"good")}</td><td>${suit(p,"ok")}</td><td>${suit(p,"no")}</td><td>${esc(p.notes||"")}</td></tr>`).join("")}</table>`;
    downloadBlob("TACTIX-Roster.xls","application/vnd.ms-excel", docSkeleton("Ρόστερ", body));
    toast("Excel έτοιμο ✓");
  }
  function exportExcelDrills(){
    const head=["Άσκηση","Κατηγορία","Λεπτά","Ένταση","Παίκτες","Στόχος","Στήσιμο","Coaching points","Εξέλιξη"];
    const body=`<h1>Βιβλιοθήκη Ασκήσεων</h1><p class="sub">TACTIX · ${new Date().toLocaleDateString("el-GR")}</p>
      <table><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr>
      ${DB.drills.map(d=>`<tr><td>${esc(d.name)}</td><td>${esc(d.cat)}</td><td>${d.dur}</td><td>${esc(d.intensity)}</td><td>${esc(d.players||"")}</td><td>${esc(d.goal)}</td><td>${esc(d.setup||"")}</td><td>${(d.coaching||[]).join("; ")}</td><td>${esc(d.progression||"")}</td></tr>`).join("")}</table>`;
    downloadBlob("TACTIX-Askiseis.xls","application/vnd.ms-excel", docSkeleton("Ασκήσεις", body));
    toast("Excel έτοιμο ✓");
  }

  function assignRole(tacticId,i){
    const t=DB.tactics.find(x=>x.id===tacticId); const pos=t.positions[i];
    const roles=POSITION_ROLES[pos.r]||[];
    modal(`Ρόλος θέσης — ${ROLE_NAMES[pos.r]||pos.r} <span class="chip">${esc(pos.r)}</span>`,
      `<div class="sub" style="margin-bottom:10px">Διάλεξε υποκατηγορία ρόλου (όπως στον αληθινό κόσμο):</div>
       ${roles.map(r=>`<div class="list-item ${pos.roleCode===r.code?'sel':''}" onclick="App.setRole('${tacticId}',${i},'${r.code}')">
          <div class="em" style="font-size:13px;font-weight:800">${esc(r.code)}</div>
          <div class="meta"><b>${esc(r.name)}</b><small>${esc(r.desc)}</small></div>
          ${pos.roleCode===r.code?'<span class="chip g">✓</span>':''}</div>`).join("")}
       <div style="margin-top:8px"><button class="btn ghost sm" onclick="App.setRole('${tacticId}',${i},'')">✕ Καθαρισμός ρόλου</button></div>`,
      `<button class="btn primary" onclick="App.closeModal()">Κλείσιμο</button>`);
  }
  function setRole(tid,i,code){
    const t=DB.tactics.find(x=>x.id===tid); const pos=t.positions[i];
    const r=(POSITION_ROLES[pos.r]||[]).find(x=>x.code===code);
    if(code){ pos.roleCode=code; pos.roleName=r?r.name:code; } else { delete pos.roleCode; delete pos.roleName; }
    save(); closeModal(); drawTactBoard(t);
  }

  function renderTacticDetail(t){
    const tabs = ["buildup","attack","defense","transition"];
    $("#tacDetail").innerHTML = `
      <h3>🔎 Ανάλυση κατά Φάση</h3>
      <div class="sub" style="margin-bottom:10px">${esc(t.summary)}</div>
      <div class="pill-row" style="margin-bottom:12px">${(t.style||[]).map(s=>`<span class="chip g">${esc(s)}</span>`).join("")}</div>
      <div class="tabs">${tabs.map(k=>`<button class="${k===state.drawTab?'on':''}" onclick="App.tacTab('${t.id}','${k}')">${PHASE_LABELS[k].t}</button>`).join("")}</div>
      <div class="detail-block">
        <span class="phase-tag ${PHASE_LABELS[state.drawTab].c}">${PHASE_LABELS[state.drawTab].t}</span>
        <ul style="margin-top:10px">${(t.phases[state.drawTab]||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div class="detail-block"><h4>🔑 Κλειδιά</h4><div class="pill-row">${(t.keyRoles||[]).map(r=>`<span class="chip b">${esc(r)}</span>`).join("")}</div></div>
      ${t.custom?`<div style="margin-top:10px"><button class="btn danger sm" onclick="App.delTactic('${t.id}')">Διαγραφή τακτικής</button></div>`:''}`;
  }
  function tacTab(id,k){ state.drawTab=k; renderTacticDetail(DB.tactics.find(t=>t.id===id)); }
  function useTactic(id){ const t=DB.tactics.find(x=>x.id===id); DB.club.formation=t.formation; save(); toast("Ορίστηκε ως βασική τακτική: "+t.name); }

  function newTactic(){ openDesigner(true); }

  /* ---- Σχεδιαστής τακτικής (draggable) ---- */
  function openDesigner(blank){
    const t = blank? null : DB.tactics.find(x=>x.id===state.tacticId);
    const formation = t? t.formation : "4-3-3";
    const basePos = (t && t.positions) ? t.positions : (FORMATIONS[formation]||FORMATIONS["4-3-3"]);
    state.designer = { positions: basePos.map(p=>({...p,label:p.r})), formation, arrows: t?JSON.parse(JSON.stringify(t.movements||[])):[] };
    state.dTool="move";
    $("#view-tactics").innerHTML = `
      <div class="sectionhead">
        <h2>✏️ Σχεδιαστής Τακτικής</h2>
        <div class="sub2">Σύρε πιόνια · κλικ σε πιόνι για ρόλο · τράβα βελάκια κίνησης/πάσας</div>
        <div class="sp"><button class="btn sm" onclick="App.renderTactics()">← Πίσω</button></div>
      </div>
      <div class="board-wrap">
        <div class="card">
          <div class="tools">
            <label style="margin:0">Σχηματισμός:</label>
            <select id="dForm" style="max-width:180px" onchange="App.designerForm(this.value)">
              ${Object.keys(FORMATIONS).map(f=>`<option ${f===formation?'selected':''}>${f}</option>`).join("")}</select>
          </div>
          <div class="tools">
            <div class="seg" id="dSeg"></div>
            <button class="btn sm ghost" onclick="App.dClearArrows()">🗑️ Βελάκια</button>
            <span class="sub" id="dHint" style="font-size:11.5px"></span>
          </div>
          <div id="designerBoard"></div>
          <div class="legend" style="margin-top:8px">
            <span><i class="dotc" style="background:#fde047"></i>Κίνηση</span>
            <span><i class="dotc" style="background:#38bdf8"></i>Πάσα</span>
            <span><i class="dotc" style="background:#ff8a8a"></i>Ρόλος</span>
          </div>
        </div>
        <div class="card">
          <h3>💾 Αποθήκευση Τακτικής</h3>
          <div class="field"><label>Όνομα</label><input id="tName" value="${t?esc(t.name):'Νέα τακτική μου'}"></div>
          <div class="row">
            <div class="field"><label>Προπονητής</label><input id="tCoach" value="${t?esc(t.coach):'Ο Προπονητής μου'}"></div>
            <div class="field"><label>Ένταση</label><input id="tInt" value="${t?esc(t.intensity):'Υψηλή'}"></div>
          </div>
          <div class="field"><label>Στυλ (χωρισμένα με κόμμα)</label><input id="tStyle" value="${t?esc((t.style||[]).join(', ')):'Κατοχή, Πίεση'}"></div>
          <div class="field"><label>Περιγραφή</label><textarea id="tSum">${t?esc(t.summary):''}</textarea></div>
          <div class="field"><label>Ανάπτυξη (μία γραμμή ανά σημείο)</label><textarea id="tBuild">${t?esc((t.phases.buildup||[]).join('\n')):''}</textarea></div>
          <div class="field"><label>Επίθεση</label><textarea id="tAtt">${t?esc((t.phases.attack||[]).join('\n')):''}</textarea></div>
          <div class="field"><label>Άμυνα</label><textarea id="tDef">${t?esc((t.phases.defense||[]).join('\n')):''}</textarea></div>
          <div class="field"><label>Μεταβάσεις</label><textarea id="tTr">${t?esc((t.phases.transition||[]).join('\n')):''}</textarea></div>
          <button class="btn primary" onclick="App.saveTactic()">💾 Αποθήκευση ως δική μου</button>
        </div>
      </div>`;
    drawDesigner();
  }
  function designerForm(f){ state.designer.formation=f; state.designer.positions=FORMATIONS[f].map(p=>({...p,label:p.r})); state.designer.arrows=[]; drawDesigner(); }
  function drawDesigner(){
    const d=state.designer;
    Pitch.render($("#designerBoard"), d.positions, {
      draggable:true, tool:state.dTool, arrows:d.arrows,
      onMove:()=>{},
      onToken:(i)=>designerRole(i),
      onArrow:(from,to,type)=>{ d.arrows.push({from,to,type}); drawDesigner(); }
    });
    const seg=(v,ic,lbl)=>`<button class="${state.dTool===v?'on':''}" onclick="App.dTool('${v}')">${ic} ${lbl}</button>`;
    const sg=$("#dSeg"); if(sg) sg.innerHTML=seg('move','🖐','Θέσεις')+seg('run','➡️','Κίνηση')+seg('pass','⚡','Πάσα');
    const h=$("#dHint"); if(h) h.textContent = state.dTool==='move'?'Σύρε πιόνι · κλικ για ρόλο':'Σύρε πάνω στο γήπεδο για βέλος';
  }
  function dTool(v){ state.dTool=v; drawDesigner(); }
  function dClearArrows(){ state.designer.arrows=[]; drawDesigner(); }
  function designerRole(i){
    const pos=state.designer.positions[i];
    const roles=POSITION_ROLES[pos.r]||[];
    modal(`Ρόλος θέσης — ${ROLE_NAMES[pos.r]||pos.r} <span class="chip">${esc(pos.r)}</span>`,
      `<div class="sub" style="margin-bottom:10px">Διάλεξε υποκατηγορία ρόλου:</div>
       ${roles.map(r=>`<div class="list-item ${pos.roleCode===r.code?'sel':''}" onclick="App.setDesignerRole(${i},'${r.code}')">
          <div class="em" style="font-size:13px;font-weight:800">${esc(r.code)}</div>
          <div class="meta"><b>${esc(r.name)}</b><small>${esc(r.desc)}</small></div></div>`).join("")}
       <div style="margin-top:8px"><button class="btn ghost sm" onclick="App.setDesignerRole(${i},'')">✕ Καθαρισμός</button></div>`,
      `<button class="btn primary" onclick="App.closeModal()">Κλείσιμο</button>`);
  }
  function setDesignerRole(i,code){
    const pos=state.designer.positions[i];
    const r=(POSITION_ROLES[pos.r]||[]).find(x=>x.code===code);
    if(code){ pos.roleCode=code; pos.roleName=r?r.name:code; } else { delete pos.roleCode; delete pos.roleName; }
    closeModal(); drawDesigner();
  }
  function saveTactic(){
    const d=state.designer;
    const lines = s => (s.value||"").split("\n").map(x=>x.trim()).filter(Boolean);
    const t = {
      id:"cust_"+Math.random().toString(36).slice(2,8), custom:true,
      name:$("#tName").value.trim()||"Νέα τακτική", coach:$("#tCoach").value.trim(), team:DB.club.name,
      formation:d.formation, emoji:"⭐", intensity:$("#tInt").value.trim(),
      style:$("#tStyle").value.split(",").map(x=>x.trim()).filter(Boolean),
      summary:$("#tSum").value.trim(),
      phases:{ buildup:lines($("#tBuild")), attack:lines($("#tAtt")), defense:lines($("#tDef")), transition:lines($("#tTr")) },
      movements: JSON.parse(JSON.stringify(d.arrows||[])), keyRoles:[]
    };
    // κρατάμε τις ακριβείς θέσεις + ρόλους της τακτικής
    const pos = d.positions.map(p=>{ const o={r:p.r,x:p.x,y:p.y}; if(p.roleCode){o.roleCode=p.roleCode;o.roleName=p.roleName;} return o; });
    t.positions = pos;
    t.customPositions = pos;
    FORMATIONS["★ "+t.name] = pos.map(p=>({r:p.r,x:p.x,y:p.y}));
    t.formation = "★ "+t.name;
    DB.tactics.push(t); save(); toast("Η τακτική αποθηκεύτηκε!"); state.tacticId=t.id; renderTactics();
  }
  function delTactic(id){ if(!confirm("Διαγραφή τακτικής;"))return; DB.tactics=DB.tactics.filter(t=>t.id!==id); state.tacticId=DB.tactics[0].id; save(); renderTactics(); }

  /* ============================================================
     3β) ΣΧΕΔΙΑ / PLAYBOOK
     ============================================================ */
  function renderPlaybook(){
    const inCat = DB.plays.filter(p=>p.cat===state.playCat);
    if(!state.playId || !inCat.some(p=>p.id===state.playId)) state.playId = inCat[0] && inCat[0].id;
    $("#view-playbook").innerHTML = `
      <div class="sectionhead">
        <h2>📐 Σχέδια — Playbook</h2>
        <div class="sub2">Στημένες · Άμυνα (1v1/2v2/3v3) · Συνεργασίες · Πίεση · Build-up</div>
        <div class="sp"><button class="btn primary sm" onclick="App.newPlay()">＋ Νέο Σχέδιο</button></div>
      </div>
      <div class="tabs">${PLAY_CATS.map(c=>`<button class="${c.id===state.playCat?'on':''}" onclick="App.playCat('${c.id}')">${c.ic} ${c.t}</button>`).join("")}</div>
      <div class="board-wrap">
        <div class="card"><div id="playBoard"></div></div>
        <div>
          <div class="card" style="margin-bottom:16px">
            <h3>📋 Σχέδια — ${esc((PLAY_CATS.find(c=>c.id===state.playCat)||{}).t||"")}</h3>
            <div id="playList" style="max-height:300px;overflow:auto">${inCat.map(p=>`
              <div class="list-item ${p.id===state.playId?'sel':''}" onclick="App.openPlay('${p.id}')">
                <div class="em">${p.emoji||'📐'}</div>
                <div class="meta"><b>${esc(p.name)}</b><small>${esc(p.sub||'')}</small></div>
                ${p.custom?'<span class="chip a">δικό μου</span>':''}
              </div>`).join("")||'<div class="empty">Κανένα σχέδιο</div>'}</div>
          </div>
          <div class="card" id="playDetail"></div>
        </div>
      </div>`;
    if(state.playId) openPlay(state.playId);
  }
  function playCat(c){ state.playCat=c; state.playId=null; renderPlaybook(); }
  function openPlay(id){
    state.playId=id; const p=DB.plays.find(x=>x.id===id); if(!p) return;
    drawPlayBoard(p);
    $("#playDetail").innerHTML = `
      <h3>${p.emoji||'📐'} ${esc(p.name)}</h3>
      <div class="pill-row" style="margin-bottom:8px"><span class="chip b">${esc((PLAY_CATS.find(c=>c.id===p.cat)||{}).t||'')}</span>${p.sub?`<span class="chip">${esc(p.sub)}</span>`:''}</div>
      <div class="sub" style="margin-bottom:10px">${esc(p.desc||'')}</div>
      <div class="detail-block"><h4>🗣️ Coaching Points</h4><ul>${(p.coaching||[]).map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div>
      ${p.custom?`<div style="margin-top:8px"><button class="btn danger sm" onclick="App.delPlay('${p.id}')">Διαγραφή σχεδίου</button></div>`:''}`;
    document.querySelectorAll("#playList .list-item").forEach(el=>el.classList.toggle("sel", el.getAttribute("onclick").includes("'"+id+"'")));
  }
  function drawPlayBoard(p){
    Pitch.render($("#playBoard"), p.tokens, {
      arrows:p.arrows||[], ball:p.ball||null, draggable:true, tool:state.playTool, oppColor:state.oppColor,
      onMove:()=>save(),
      onArrow:(from,to,type)=>{ (p.arrows=p.arrows||[]).push({from,to,type}); save(); drawPlayBoard(p); },
      onBallMove:(b)=>{ p.ball=b; save(); },
      onErase:(kind,idx)=>{ if(kind==="arrow"){ (p.arrows||[]).splice(idx,1); } else { const tk=p.tokens[idx]; if(tk&&(tk.opp||tk.added)) p.tokens.splice(idx,1); } save(); drawPlayBoard(p); }
    });
    const seg=(v,ic,lbl)=>`<button class="${state.playTool===v?'on':''}" onclick="App.playTool('${v}')">${ic} ${lbl}</button>`;
    $("#playBoard").insertAdjacentHTML("afterbegin", `
      <div class="tools">
        <div style="font-weight:800;font-size:14px">${p.emoji||'📐'} ${esc(p.name)}</div>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button class="btn sm blue" onclick="App.whiteboard('${p.id}','play')">🖊️ Πίνακας</button>
          <button class="btn sm blue" onclick="App.presentPlay('${p.id}')">🖥️ Προβολή</button>
          <button class="btn sm ghost" onclick="App.printPlay('${p.id}')">⇩ PDF</button>
          <button class="btn sm ghost" onclick="App.exportWordPlay('${p.id}')">⬇ Word</button>
          <button class="btn sm ghost" onclick="App.saveBoardImage('play','${p.id}')">📷 Εικόνα</button>
        </div>
      </div>
      <div class="tools">
        <div class="seg">${seg('move','🖐','Πιόνια')}${seg('run','➡️','Κίνηση')}${seg('pass','⚡','Πάσα')}<button class="${state.playTool==='erase'?'on':''}" onclick="App.playTool('erase')">🧽 Γόμα</button></div>
        <button class="btn sm ghost" onclick="App.playBall('${p.id}')">⚽ Μπάλα</button>
        <button class="btn sm ghost" onclick="App.playAddOpp('${p.id}')">＋ Αντίπαλος</button>
        <button class="btn sm ghost" onclick="App.toggleOppColor('play')" title="Χρώμα αντιπάλων"><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${state.oppColor};vertical-align:middle"></span> Αντ.</button>
        <button class="btn sm ghost" onclick="App.playClear('${p.id}')">🗑️ Βελάκια</button>
      </div>
      <div class="legend" style="margin-bottom:8px">
        <span><i class="dotc" style="background:#e4222f"></i>Δικοί</span>
        <span><i class="dotc" style="background:#64748b"></i>Αντίπαλοι</span>
        <span><i class="dotc" style="background:#fde047"></i>Κίνηση</span>
        <span><i class="dotc" style="background:#38bdf8"></i>Πάσα</span>
      </div>`);
  }
  function playTool(v){ state.playTool=v; drawPlayBoard(DB.plays.find(p=>p.id===state.playId)); }
  function playBall(id){ const p=DB.plays.find(x=>x.id===id); if(p.ball) delete p.ball; else p.ball={x:50,y:50}; save(); drawPlayBoard(p); }
  function playClear(id){ const p=DB.plays.find(x=>x.id===id); p.arrows=[]; save(); drawPlayBoard(p); toast("Καθαρίστηκαν τα βελάκια"); }
  function playAddOpp(id){ const p=DB.plays.find(x=>x.id===id); (p.tokens=p.tokens||[]).push({r:"ΕΠ",x:50,y:52,opp:true,added:true,label:" "}); save(); drawPlayBoard(p); toast("Προστέθηκε αντίπαλος (σύρε τον)"); }
  function newPlay(){
    modal("＋ Νέο Σχέδιο", `
      <div class="field"><label>Όνομα</label><input id="npName" placeholder="π.χ. Κόρνερ — δικό μου"></div>
      <div class="row"><div class="field"><label>Κατηγορία</label><select id="npCat">${PLAY_CATS.map(c=>`<option value="${c.id}" ${c.id===state.playCat?'selected':''}>${c.t}</option>`).join("")}</select></div>
        <div class="field"><label>Υποκατηγορία</label><input id="npSub" placeholder="π.χ. Κόρνερ επίθεση"></div></div>
      <div class="field"><label>Περιγραφή</label><textarea id="npDesc"></textarea></div>
      <div class="field"><label>Coaching points (μία γραμμή ανά σημείο)</label><textarea id="npCoach"></textarea></div>
      <div class="sub">Ξεκινά με 4 δικούς + 2 αντιπάλους + μπάλα — μετά σύρε πιόνια & τράβα βελάκια.</div>`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button><button class="btn primary" onclick="App.savePlay()">Δημιουργία</button>`);
  }
  function savePlay(){
    const cat=$("#npCat").value;
    const p={ id:"play_"+Math.random().toString(36).slice(2,8), custom:true, cat, sub:$("#npSub").value.trim()||"", emoji:"⭐",
      name:$("#npName").value.trim()||"Νέο σχέδιο", desc:$("#npDesc").value.trim(),
      coaching:$("#npCoach").value.split("\n").map(x=>x.trim()).filter(Boolean),
      tokens:[{r:"ΣΤ",x:40,y:40,label:"1"},{r:"ΚΜ",x:55,y:50,label:"2"},{r:"ΔΕ",x:70,y:62,label:"3"},{r:"ΕΠ",x:50,y:72,label:"4"},
        {opp:true,r:"ΣΤ",x:48,y:60,label:""},{opp:true,r:"ΣΤ",x:62,y:70,label:""}],
      arrows:[], ball:{x:40,y:40} };
    DB.plays.push(p); save(); closeModal(); state.playCat=cat; state.playId=p.id; renderPlaybook(); toast("Το σχέδιο δημιουργήθηκε");
  }
  function delPlay(id){ if(!confirm("Διαγραφή σχεδίου;"))return; DB.plays=DB.plays.filter(p=>p.id!==id); state.playId=null; save(); renderPlaybook(); }

  /* Προβολή σχεδίου (fullscreen, single diagram + coaching, next/prev στην κατηγορία) */
  function presentPlay(id){
    const p=DB.plays.find(x=>x.id===id); if(!p) return;
    state.presentPlay={id, cat:p.cat};
    let ov=$("#present"); if(!ov){ ov=document.createElement("div"); ov.id="present"; document.body.appendChild(ov); }
    ov.classList.add("on");
    ov.ontouchstart=e=>{ ov._tx=e.changedTouches[0].clientX; };
    ov.ontouchend=e=>{ const dx=e.changedTouches[0].clientX-(ov._tx||0); if(Math.abs(dx)>50) presentPlayNav(dx<0?1:-1); };
    document.addEventListener("keydown", presentPlayKey);
    renderPresentPlay();
    try{ const rf=ov.requestFullscreen||ov.webkitRequestFullscreen; if(rf){ const r=rf.call(ov); if(r&&r.catch) r.catch(()=>{}); } }catch(_){}
  }
  function renderPresentPlay(){
    const ov=$("#present"); const list=DB.plays.filter(p=>p.cat===state.presentPlay.cat);
    const idx=list.findIndex(p=>p.id===state.presentPlay.id); const p=list[idx];
    ov.innerHTML=`
      <div class="pr-top">
        <div class="badge" style="width:38px;height:38px">${LOGO_SVG(20)}</div>
        <div class="name">${p.emoji||'📐'} ${esc(p.name)}</div>
        <span class="chip">${esc((PLAY_CATS.find(c=>c.id===p.cat)||{}).t||'')}</span>
        ${p.sub?`<span class="chip b">${esc(p.sub)}</span>`:''}
        <div style="margin-left:auto"><button class="btn danger pr-btn" onclick="App.presentPlayExit()">✕ Έξοδος</button></div>
      </div>
      <div class="pr-body">
        <div class="pr-pitch" id="prPlayPitch"></div>
        <div class="pr-panel">
          <div class="pr-phase">${esc(p.name)} <span class="chip b" style="font-size:14px">${idx+1}/${list.length}</span></div>
          <div class="sub" style="font-size:clamp(14px,1.7vw,22px);margin-bottom:12px">${esc(p.desc||'')}</div>
          <ul class="pr-list">${(p.coaching||[]).map(c=>`<li>${esc(c)}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="pr-foot">
        <button class="btn pr-btn" onclick="App.presentPlayNav(-1)">← Προηγ.</button>
        <div class="pr-dots">${list.map((s,i)=>`<span class="pr-dot ${i===idx?'on':''}" onclick="App.presentPlayGo(${i})"></span>`).join("")}</div>
        <button class="btn primary pr-btn" onclick="App.presentPlayNav(1)">Επόμ. →</button>
      </div>`;
    Pitch.render($("#prPlayPitch"), p.tokens, {arrows:p.arrows||[], ball:p.ball||null});
  }
  function presentPlayNav(d){ const list=DB.plays.filter(p=>p.cat===state.presentPlay.cat); let i=list.findIndex(p=>p.id===state.presentPlay.id)+d; i=Math.max(0,Math.min(list.length-1,i)); state.presentPlay.id=list[i].id; renderPresentPlay(); }
  function presentPlayGo(i){ const list=DB.plays.filter(p=>p.cat===state.presentPlay.cat); state.presentPlay.id=list[i].id; renderPresentPlay(); }
  function presentPlayKey(e){ if(!state.presentPlay) return; if(e.key==="ArrowRight"||e.key===" "){ e.preventDefault(); presentPlayNav(1);} else if(e.key==="ArrowLeft"){ e.preventDefault(); presentPlayNav(-1);} else if(e.key==="Escape"){ presentPlayExit(); } }
  function presentPlayExit(){ const ov=$("#present"); if(ov) ov.classList.remove("on"); document.removeEventListener("keydown", presentPlayKey); state.presentPlay=null; try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(_){} }

  function printPlay(id){
    const p=DB.plays.find(x=>x.id===id); if(!p) return;
    ensurePrint(`<div class="pdoc">
      ${pHead(p.name, (PLAY_CATS.find(c=>c.id===p.cat)||{}).t+(p.sub?" · "+p.sub:""))}
      <div class="pgrid">
        <div class="ppitch" id="printPitch"></div>
        <div><h3>Περιγραφή</h3><p>${esc(p.desc||"")}</p>
          <h3>Coaching Points</h3><ul>${(p.coaching||[]).map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div>
      </div>${pFoot()}
    </div>`, ()=> Pitch.render($("#printPitch"), p.tokens, {arrows:p.arrows||[], ball:p.ball||null}));
  }
  async function exportWordPlay(id){
    const p=DB.plays.find(x=>x.id===id); if(!p) return;
    toast("Δημιουργία Word…");
    const png=await pitchPng(p.tokens, {arrows:p.arrows||[], ball:p.ball||null});
    const body=`<div class="brand">TACTIX</div><h1>${esc(p.name)}</h1>
      <p class="sub">${esc((PLAY_CATS.find(c=>c.id===p.cat)||{}).t||"")}${p.sub?" · "+esc(p.sub):""}</p>
      ${png?`<img src="${png}" width="300" style="border:1px solid #ccc;margin:6pt 0"/>`:""}
      <h2>Περιγραφή</h2><p>${esc(p.desc||"")}</p>
      <h2>Coaching Points</h2><ul>${(p.coaching||[]).map(c=>`<li>${esc(c)}</li>`).join("")}</ul>
      <p class="sub">TACTIX — ${new Date().toLocaleDateString("el-GR")}</p>`;
    downloadBlob("TACTIX-Sxedio-"+slug(p.name)+".doc","application/msword", docSkeleton(p.name, body));
    toast("Word έτοιμο ✓");
  }

  /* ============================================================
     4) ΠΡΟΠΟΝΗΣΕΙΣ
     ============================================================ */
  let trainTab="library";
  function renderTraining(){
    $("#view-training").innerHTML = `
      <div class="sectionhead">
        <h2>🏋️ Προπονήσεις & Περιοδισμός</h2>
        <div class="sp">
          <button class="btn sm ghost" onclick="App.exportExcelDrills()">⬇ Excel ασκήσεων</button>
          <button class="btn primary sm" onclick="App.newDrill()">＋ Νέα Άσκηση</button>
        </div>
      </div>
      <div class="tabs">
        <button class="${trainTab==='library'?'on':''}" onclick="App.trainTab('library')">📋 Βιβλιοθήκη Ασκήσεων</button>
        <button class="${trainTab==='micro'?'on':''}" onclick="App.trainTab('micro')">📅 Μικρόκυκλος</button>
        <button class="${trainTab==='session'?'on':''}" onclick="App.trainTab('session')">🗂️ Πλάνο Προπόνησης</button>
      </div>
      <div id="trainBody"></div>`;
    trainBody();
  }
  function trainTabSet(t){ trainTab=t; renderTraining(); }
  function trainBody(){
    if(trainTab==="library"){
      $("#trainBody").innerHTML = `<div class="grid g3">${DB.drills.map(d=>`
        <div class="card" style="cursor:pointer" onclick="App.viewDrill('${d.id}')">
          <h3>${esc(d.name)} <span class="tag">${d.dur}′</span></h3>
          <div class="pill-row" style="margin-bottom:8px"><span class="chip b">${esc(d.cat)}</span><span class="chip ${d.intensity.includes('κρα')?'r':'a'}">${esc(d.intensity)}</span>${d.src?'<span class="chip p">📖 πηγή</span>':''}</div>
          <div class="sub">${esc(d.goal)}</div>
          <div class="pill-row" style="margin-top:8px">${(d.tags||[]).map(x=>`<span class="chip">${esc(x)}</span>`).join("")}</div>
        </div>`).join("")}</div>`;
    } else if(trainTab==="micro"){
      $("#trainBody").innerHTML = `<div class="card">
        <h3>📅 Εβδομαδιαίος Μικρόκυκλος (Tactical Periodization) <span class="tag" style="margin-left:auto;display:flex;gap:6px"><button class="btn sm ghost" onclick="App.printMicro()">⇩ PDF</button><button class="btn sm ghost" onclick="App.exportWordMicro()">⬇ Word</button></span></h3>
        <div class="sub" style="margin-bottom:12px">Κατανομή φορτίου με peak στο MD-3 (72ω πριν τον αγώνα) και σταδιακή αποφόρτιση προς τον αγώνα. Κλικ σε ημέρα για επεξεργασία.</div>
        <div class="micro">${DB.microcycle.map((m,i)=>`
          <div class="md" style="cursor:pointer" onclick="App.editMicro(${i})">
            <div class="dh"><span>${esc(m.day)}</span><span>${esc(m.code)}</span></div>
            <div class="dname">${esc(m.name)}</div>
            <div class="load-bar"><i style="width:${m.load}%;background:${m.color}"></i></div>
            <div style="font-size:10px;color:var(--dim);margin-bottom:4px">Φορτίο ${m.load}%</div>
            <ul>${m.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
          </div>`).join("")}</div>
        <div class="detail-block" style="margin-top:16px">
          <h4>Αρχές Περιοδισμού</h4>
          <ul>
            <li><b>MD+1</b> (αποθεραπεία): πολύ χαμηλό φορτίο, recovery + video.</li>
            <li><b>MD-4</b> (δύναμη/ένταση): μικροί χώροι, εκρηκτικά, υπο-αρχές παιχνιδιού.</li>
            <li><b>MD-3</b> (peak): μεγαλύτερος όγκος & τακτική σε μεγάλους χώρους (11v11).</li>
            <li><b>MD-2</b> (ταχύτητα): μεταβάσεις, ταχύτητα, τελείωμα.</li>
            <li><b>MD-1</b> (ενεργοποίηση): χαμηλός όγκος, στημένες, πλάνο αγώνα.</li>
          </ul>
        </div></div>`;
    } else {
      const list = DB.sessions;
      $("#trainBody").innerHTML = `<div class="grid g2">
        <div class="card">
          <h3>🗂️ Δημιουργία Πλάνου Προπόνησης</h3>
          <div class="field"><label>Τίτλος / Ημέρα</label><input id="sTitle" placeholder="π.χ. Τρίτη MD-4 — Ένταση"></div>
          <div class="field"><label>Στόχος συνεδρίας</label><input id="sGoal" placeholder="π.χ. πίεση & μεταβάσεις"></div>
          <label>Επίλεξε ασκήσεις:</label>
          <div style="max-height:240px;overflow:auto;margin-top:6px">${DB.drills.map(d=>`
            <label class="list-item" style="cursor:pointer">
              <input type="checkbox" value="${d.id}" class="sDrill" style="width:auto;flex:0 0 auto">
              <div class="meta"><b>${esc(d.name)}</b><small>${d.dur}′ · ${esc(d.cat)}</small></div></label>`).join("")}</div>
          <button class="btn primary" style="margin-top:10px" onclick="App.saveSession()">💾 Αποθήκευση πλάνου</button>
        </div>
        <div class="card">
          <h3>📁 Αποθηκευμένα Πλάνα <span class="tag">${list.length}</span></h3>
          ${list.length? list.map(s=>`
            <div class="list-item">
              <div class="em">🗂️</div>
              <div class="meta"><b>${esc(s.title)}</b><small>${s.drills.length} ασκ. · ${s.total}′ · ${esc(s.goal||'')}</small></div>
              <button class="btn sm" onclick="App.viewSession('${s.id}')">Άνοιγμα</button>
              <button class="btn sm ghost" onclick="App.printSessionDoc('${s.id}')">⇩ PDF</button>
              <button class="btn sm danger" onclick="App.delSession('${s.id}')">✕</button>
            </div>`).join("")
            : `<div class="empty"><div class="big">🗂️</div>Δεν υπάρχουν πλάνα ακόμη.</div>`}
        </div></div>`;
    }
  }
  function viewDrill(id){
    const d=DB.drills.find(x=>x.id===id);
    modal(`${esc(d.name)}`, `
      <div class="pill-row" style="margin-bottom:12px">
        <span class="chip b">${esc(d.cat)}</span><span class="chip">${d.dur}′</span>
        <span class="chip a">${esc(d.intensity)}</span><span class="chip">${esc(d.players)} παίκτες</span></div>
      ${d.src?`<div class="detail-block"><h4>📖 Πηγή μεθοδολογίας</h4><div class="sub">${esc(d.src)}</div></div>`:''}
      <div class="detail-block"><h4>🎯 Στόχος</h4><div class="sub">${esc(d.goal)}</div></div>
      <div class="detail-block"><h4>⚙️ Στήσιμο</h4><div class="sub">${esc(d.setup)}</div></div>
      <div class="detail-block"><h4>🗣️ Coaching Points</h4><ul>${(d.coaching||[]).map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div>
      ${d.progression?`<div class="detail-block"><h4>📈 Εξέλιξη</h4><div class="sub">${esc(d.progression)}</div></div>`:''}`,
      `${d.custom?`<button class="btn danger" onclick="App.delDrill('${d.id}')">Διαγραφή</button>`:''}
       <button class="btn primary" onclick="App.closeModal()">Κλείσιμο</button>`);
  }
  function newDrill(){
    modal("Νέα Άσκηση", `
      <div class="field"><label>Όνομα</label><input id="dName"></div>
      <div class="row"><div class="field"><label>Κατηγορία</label><input id="dCat" value="Τακτική"></div>
        <div class="field" style="max-width:100px"><label>Λεπτά</label><input type="number" id="dDur" value="15"></div>
        <div class="field"><label>Ένταση</label><input id="dInt" value="Μεσαία"></div></div>
      <div class="field"><label>Παίκτες</label><input id="dPl" value="8+"></div>
      <div class="field"><label>🎯 Στόχος</label><textarea id="dGoal"></textarea></div>
      <div class="field"><label>⚙️ Στήσιμο</label><textarea id="dSetup"></textarea></div>
      <div class="field"><label>🗣️ Coaching points (μία γραμμή ανά σημείο)</label><textarea id="dCoach"></textarea></div>
      <div class="field"><label>📈 Εξέλιξη</label><input id="dProg"></div>`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button>
       <button class="btn primary" onclick="App.saveDrill()">Αποθήκευση</button>`);
  }
  function saveDrill(){
    DB.drills.push({ id:"cust_"+Math.random().toString(36).slice(2,8), custom:true,
      name:$("#dName").value.trim()||"Άσκηση", cat:$("#dCat").value.trim(), dur:+$("#dDur").value||15,
      intensity:$("#dInt").value.trim(), players:$("#dPl").value.trim(),
      goal:$("#dGoal").value.trim(), setup:$("#dSetup").value.trim(),
      coaching:$("#dCoach").value.split("\n").map(x=>x.trim()).filter(Boolean),
      progression:$("#dProg").value.trim(), tags:[] });
    save(); closeModal(); renderTraining(); toast("Η άσκηση αποθηκεύτηκε");
  }
  function delDrill(id){ if(!confirm("Διαγραφή;"))return; DB.drills=DB.drills.filter(d=>d.id!==id); save(); closeModal(); renderTraining(); }
  function saveSession(){
    const ids=[...document.querySelectorAll(".sDrill:checked")].map(c=>c.value);
    if(!ids.length){ toast("Επίλεξε τουλάχιστον μία άσκηση"); return; }
    const drills=ids.map(id=>DB.drills.find(d=>d.id===id));
    DB.sessions.push({ id:"s_"+Math.random().toString(36).slice(2,8), title:$("#sTitle").value.trim()||"Προπόνηση",
      goal:$("#sGoal").value.trim(), drills:ids, total:drills.reduce((a,d)=>a+(d.dur||0),0) });
    save(); renderTraining(); toast("Πλάνο αποθηκεύτηκε");
  }
  function viewSession(id){
    const s=DB.sessions.find(x=>x.id===id);
    const drills=s.drills.map(did=>DB.drills.find(d=>d.id===did)).filter(Boolean);
    modal(`🗂️ ${esc(s.title)}`, `<div class="sub" style="margin-bottom:12px">${esc(s.goal||'')} · Σύνολο ${s.total}′</div>
      ${drills.map((d,i)=>`<div class="detail-block"><h4>${i+1}. ${esc(d.name)} — ${d.dur}′</h4>
        <div class="sub">${esc(d.goal)}</div>
        <ul style="margin-top:6px">${(d.coaching||[]).slice(0,3).map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div>`).join("")}`,
      `<button class="btn" onclick="App.printSessionDoc('${id}')">⇩ PDF</button>
       <button class="btn" onclick="App.exportWordSession('${id}')">⬇ Word</button>
       <button class="btn primary" onclick="App.closeModal()">Κλείσιμο</button>`);
  }
  function delSession(id){ DB.sessions=DB.sessions.filter(s=>s.id!==id); save(); renderTraining(); }
  function printSession(id){ window.print(); }
  function editMicro(i){
    const m=DB.microcycle[i];
    modal(`📅 ${esc(m.day)} (${esc(m.code)})`, `
      <div class="row"><div class="field"><label>Θέμα</label><input id="mName" value="${esc(m.name)}"></div>
        <div class="field" style="max-width:120px"><label>Φορτίο %</label><input type="number" id="mLoad" value="${m.load}"></div></div>
      <div class="field"><label>Περιεχόμενο (μία γραμμή ανά σημείο)</label><textarea id="mItems" style="min-height:120px">${m.items.join("\n")}</textarea></div>`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button>
       <button class="btn primary" onclick="App.saveMicro(${i})">Αποθήκευση</button>`);
  }
  function saveMicro(i){
    const m=DB.microcycle[i]; m.name=$("#mName").value.trim(); m.load=Math.max(0,Math.min(100,+$("#mLoad").value||0));
    m.color=loadColor(m.load); m.items=$("#mItems").value.split("\n").map(x=>x.trim()).filter(Boolean);
    save(); closeModal(); renderTraining();
  }

  /* ============================================================
     5) ΑΓΩΝΕΣ
     ============================================================ */
  function renderMatches(){
    const up=DB.matches.filter(m=>m.status==="upcoming").sort((a,b)=>a.date.localeCompare(b.date));
    const pl=DB.matches.filter(m=>m.status==="played").sort((a,b)=>b.date.localeCompare(a.date));
    $("#view-matches").innerHTML = `
      <div class="sectionhead"><h2>⚽ Match Center</h2>
        <div class="sp"><button class="btn primary sm" onclick="App.editMatch()">＋ Νέος Αγώνας</button></div></div>
      <div class="grid g2">
        <div class="card"><h3>🗓️ Προσεχείς</h3>
          ${up.length?up.map(matchRow).join(""):'<div class="empty">Κανένας προγραμματισμένος</div>'}</div>
        <div class="card"><h3>📊 Αποτελέσματα</h3>
          ${pl.length?pl.map(matchRow).join(""):'<div class="empty">Κανένα αποτέλεσμα</div>'}</div>
      </div>`;
  }
  function matchRow(m){
    const res = m.status==="played"? `<b style="font-size:16px;color:${m.gf>m.ga?'#22d3ee':m.gf<m.ga?'#ef4444':'#f59e0b'}">${m.gf}–${m.ga}</b>` : `<span class="chip b">${fmtDate(m.date)}</span>`;
    return `<div class="list-item" onclick="App.openMatch('${m.id}')">
      <div class="em">${m.status==='played'?'📊':'⚽'}</div>
      <div class="meta"><b>${esc(DB.club.short)} ${m.home?'🆚':'@'} ${esc(m.opp)}</b><small>${esc(m.comp)} · ${esc(m.formation)}</small></div>
      ${res}</div>`;
  }
  function shortName(n){ n=(n||"").trim(); const parts=n.split(/\s+/); return parts.length>1?parts[parts.length-1]:n; }
  function matchPositions(m){
    const base=FORMATIONS[m.formation]||FORMATIONS["4-3-3"];
    return base.map((p,i)=>{ const pid=m.lineup&&m.lineup[i]; const pl=pid?DB.players.find(x=>x.id===pid):null;
      return {r:p.r, x:p.x, y:p.y, name: pl?shortName(pl.name):undefined}; });
  }
  function lineupCount(m){ return m.lineup? Object.keys(m.lineup).filter(k=>m.lineup[k]).length : 0; }

  function openMatch(id){
    const m=DB.matches.find(x=>x.id===id);
    const tac=DB.tactics.find(t=>t.id===m.tacticId);
    const hasLine=lineupCount(m)>0;
    modal(`${esc(DB.club.short)} ${m.home?'vs':'@'} ${esc(m.opp)}`, `
      <div class="pill-row" style="margin-bottom:12px"><span class="chip b">${esc(m.comp)}</span>
        <span class="chip">${fmtDate(m.date)}</span><span class="chip">${esc(m.formation)}</span>
        ${m.status==='played'?`<span class="chip ${m.gf>m.ga?'g':m.gf<m.ga?'r':'a'}">${m.gf}–${m.ga}</span>`:'<span class="chip a">επερχόμενος</span>'}</div>
      <div class="detail-block"><h4>♟️ Πλάνο</h4><div class="sub">${tac?esc(tac.name):'—'}</div></div>
      ${hasLine?`<div class="detail-block"><h4>👥 Σύνθεση (${lineupCount(m)}/11)</h4><div id="matchPitch"></div>
        ${m.bench&&m.bench.length?`<div class="sub" style="margin-top:6px"><b>Πάγκος:</b> ${m.bench.map(pid=>{const p=DB.players.find(x=>x.id===pid);return p?esc(shortName(p.name)):'';}).filter(Boolean).join(', ')}</div>`:''}</div>`
        :`<div class="detail-block"><h4>👥 Σύνθεση</h4><div class="sub">Δεν έχει οριστεί ενδεκάδα. Πάτησε «Σύνθεση».</div></div>`}
      <div class="detail-block"><h4>🕵️ Ανάλυση Αντιπάλου</h4><div class="sub">${esc(m.oppNotes||'—')}</div></div>
      ${m.status==='played'&&m.scorers&&m.scorers.length?`<div class="detail-block"><h4>⚽ Σκόρερ</h4><div class="sub">${m.scorers.map(esc).join(", ")}</div></div>`:''}
      <div class="row" style="margin-top:8px">
        <button class="btn sm" onclick="App.editLineup('${m.id}')">👥 Σύνθεση/Lineup</button>
        <button class="btn sm" onclick="App.editMatchStats('${m.id}')">📊 Στατιστικά Παικτών</button>
        <button class="btn sm ghost" onclick="App.printMatch('${m.id}')">⇩ PDF Αγώνα</button>
        <button class="btn sm ghost" onclick="App.exportWordMatch('${m.id}')">⬇ Word Αγώνα</button>
      </div>`,
      `<button class="btn danger" onclick="App.delMatch('${m.id}')">Διαγραφή</button>
       <button class="btn" onclick="App.editMatch('${m.id}')">✎ Επεξεργασία</button>
       ${m.status==='upcoming'?`<button class="btn primary" onclick="App.resultMatch('${m.id}')">Αποτέλεσμα</button>`:''}`);
    if(hasLine) Pitch.render($("#matchPitch"), matchPositions(m), {});
  }

  function editLineup(matchId){
    const m=DB.matches.find(x=>x.id===matchId);
    const base=FORMATIONS[m.formation]||FORMATIONS["4-3-3"];
    const order={good:0, ok:1, "":2, no:3};
    const avic=p=>isAvailable(p)?(p.status==="doubtful"?"⚠️ ":""):((STATUS[p.status]||STATUS.fit).ic+" ");
    const opts=(r,sel)=>{
      const scored=DB.players.map(p=>({p, s:(p.suitability&&p.suitability[r])||(p.pos===r?"good":""), un:isAvailable(p)?0:1}));
      scored.sort((a,b)=>a.un-b.un || (order[a.s]??2)-(order[b.s]??2) || a.p.name.localeCompare(b.p.name));
      return `<option value="">— κενό —</option>`+scored.map(({p,s})=>`<option value="${p.id}" ${sel===p.id?"selected":""}>${avic(p)}${esc(p.name)} (${p.pos})${s==="good"?" ✓":s==="ok"?" ~":s==="no"?" ✕":""}</option>`).join("");
    };
    const rows=base.map((pp,i)=>`<div style="display:grid;grid-template-columns:46px 1fr;gap:6px;align-items:center;margin-bottom:5px">
        <span class="chip">${pp.r}</span>
        <select data-slot="${i}">${opts(pp.r, m.lineup&&m.lineup[i])}</select></div>`).join("");
    const outNow=DB.players.filter(p=>!isAvailable(p));
    modal(`👥 Σύνθεση — ${esc(DB.club.short)} vs ${esc(m.opp)} <span class="chip">${esc(m.formation)}</span>`,
      `${outNow.length?`<div class="sub" style="margin-bottom:8px;color:#fca5a5">🚑 Εκτός: ${outNow.map(p=>esc(shortName(p.name))+" ("+(STATUS[p.status]||STATUS.fit).t+")").join(", ")}</div>`:""}
       <div class="detail-block"><h4>Ενδεκάδα (✓ Καλά · ~ Μέτρια · ✕ Ακατάλληλος · 🚑/🟥 μη διαθέσιμος)</h4>${rows}</div>
       <div class="detail-block"><h4>Πάγκος (Ctrl/Cmd+κλικ για πολλαπλή επιλογή)</h4>
         <select multiple size="6" id="benchSel" style="height:auto">${DB.players.slice().sort((a,b)=>(isAvailable(a)?0:1)-(isAvailable(b)?0:1)).map(p=>`<option value="${p.id}" ${(m.bench||[]).includes(p.id)?"selected":""}>${avic(p)}${esc(p.name)} (${p.pos})</option>`).join("")}</select></div>`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button>
       <button class="btn primary" onclick="App.saveLineup('${matchId}')">Αποθήκευση</button>`);
  }
  function saveLineup(id){
    const m=DB.matches.find(x=>x.id===id);
    const lineup={}; document.querySelectorAll("select[data-slot]").forEach(s=>{ if(s.value) lineup[+s.dataset.slot]=s.value; });
    m.lineup=lineup; m.bench=[...($("#benchSel").selectedOptions||[])].map(o=>o.value);
    save(); closeModal(); openMatch(id); toast("Η σύνθεση αποθηκεύτηκε");
  }

  function editMatchStats(id){
    const m=DB.matches.find(x=>x.id===id);
    const starters = m.lineup? Object.values(m.lineup) : [];
    const parts = [...new Set([...starters, ...(m.bench||[])])];
    const list = (parts.length? parts.map(pid=>DB.players.find(p=>p.id===pid)) : DB.players.slice()).filter(Boolean);
    const ps = m.playerStats||{};
    const row=(p)=>{ const s=ps[p.id]||{}; const isStarter=starters.includes(p.id);
      return `<div style="display:grid;grid-template-columns:1fr 58px 42px 42px 52px;gap:5px;align-items:center;margin-bottom:4px" data-pid="${p.id}">
        <span style="font-size:12.5px"><b>${esc(shortName(p.name))}</b> <span class="chip" style="padding:1px 6px">${p.pos}</span></span>
        <input type="number" class="st-min" placeholder="λεπτά" value="${s.min!=null?s.min:(isStarter?90:'')}" title="Λεπτά">
        <input type="number" class="st-g" placeholder="⚽" value="${s.g!=null?s.g:''}" title="Γκολ">
        <input type="number" class="st-a" placeholder="🅰" value="${s.a!=null?s.a:''}" title="Ασίστ">
        <input type="number" step="0.1" min="1" max="10" class="st-r" placeholder="βαθ." value="${s.rating!=null?s.rating:''}" title="Βαθμ. 1-10">
      </div>`; };
    modal(`📊 Στατιστικά — ${esc(DB.club.short)} vs ${esc(m.opp)}`,
      `<div class="sub" style="margin-bottom:8px">Λεπτά · Γκολ · Ασίστ · Βαθμολογία (1-10). Τροφοδοτούν αυτόματα τα «Αναλυτικά».</div>
       <div style="display:grid;grid-template-columns:1fr 58px 42px 42px 52px;gap:5px;font-size:10px;color:var(--dim);font-weight:700;margin-bottom:4px">
         <span>ΠΑΙΚΤΗΣ</span><span>ΛΕΠΤΑ</span><span>⚽</span><span>🅰</span><span>ΒΑΘ.</span></div>
       ${list.map(row).join("")}
       ${list.length===DB.players.length?'<div class="sub" style="margin-top:6px;font-size:11px">Δεν έχει οριστεί σύνθεση — εμφανίζονται όλοι οι παίκτες.</div>':''}`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button>
       <button class="btn primary" onclick="App.saveMatchStats('${id}')">Αποθήκευση</button>`);
  }
  function saveMatchStats(id){
    const m=DB.matches.find(x=>x.id===id); const ps={};
    document.querySelectorAll("[data-pid]").forEach(rowEl=>{
      const pid=rowEl.dataset.pid;
      const min=+rowEl.querySelector(".st-min").value||0, g=+rowEl.querySelector(".st-g").value||0,
            a=+rowEl.querySelector(".st-a").value||0, rating=+rowEl.querySelector(".st-r").value||0;
      if(min||g||a||rating) ps[pid]={min,g,a,rating};
    });
    m.playerStats=ps;
    if(m.status!=="played"){ /* κρατάμε το status· τα στατιστικά μετρούν μόνο σε played */ }
    recomputeStats(); save(); closeModal(); openMatch(id); toast("Τα στατιστικά αποθηκεύτηκαν");
  }
  function editMatch(id){
    const m=id?DB.matches.find(x=>x.id===id):null;
    modal(m?"Επεξεργασία Αγώνα":"Νέος Αγώνας",`
      <div class="row"><div class="field"><label>Αντίπαλος</label><input id="mOpp" value="${m?esc(m.opp):''}"></div>
        <div class="field" style="max-width:140px"><label>Ημερομηνία</label><input type="date" id="mDate" value="${m?m.date:nextSaturday()}"></div></div>
      <div class="row"><div class="field"><label>Διοργάνωση</label><input id="mComp" value="${m?esc(m.comp):'Πρωτάθλημα'}"></div>
        <div class="field" style="max-width:120px"><label>Έδρα</label><select id="mHome"><option value="1" ${!m||m.home?'selected':''}>Εντός</option><option value="0" ${m&&!m.home?'selected':''}>Εκτός</option></select></div></div>
      <div class="row"><div class="field"><label>Σχηματισμός</label><select id="mForm">${Object.keys(FORMATIONS).map(f=>`<option ${m&&m.formation===f?'selected':''}>${f}</option>`).join("")}</select></div>
        <div class="field"><label>Τακτική</label><select id="mTac">${DB.tactics.map(t=>`<option value="${t.id}" ${m&&m.tacticId===t.id?'selected':''}>${esc(t.name)}</option>`).join("")}</select></div></div>
      <div class="field"><label>🕵️ Ανάλυση αντιπάλου</label><textarea id="mNotes">${m?esc(m.oppNotes):''}</textarea></div>`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button><button class="btn primary" onclick="App.saveMatch('${id||''}')">Αποθήκευση</button>`);
  }
  function saveMatch(id){
    const data={ opp:$("#mOpp").value.trim()||"Αντίπαλος", date:$("#mDate").value, comp:$("#mComp").value.trim(),
      home:$("#mHome").value==="1", formation:$("#mForm").value, tacticId:$("#mTac").value, oppNotes:$("#mNotes").value.trim() };
    if(id){ Object.assign(DB.matches.find(m=>m.id===id), data); }
    else{ DB.matches.push({ id:"m_"+Math.random().toString(36).slice(2,8), status:"upcoming", gf:null,ga:null,scorers:[],lineup:[], ...data }); }
    save(); closeModal(); renderMatches(); toast("Αποθηκεύτηκε");
  }
  function resultMatch(id){
    const m=DB.matches.find(x=>x.id===id);
    modal("Καταχώρηση Αποτελέσματος",`
      <div class="row"><div class="field"><label>${esc(DB.club.short)} (γκολ)</label><input type="number" id="rGf" value="0"></div>
        <div class="field"><label>${esc(m.opp)} (γκολ)</label><input type="number" id="rGa" value="0"></div></div>
      <div class="field"><label>Σκόρερ (χωρισμένα με κόμμα)</label><input id="rSc" placeholder="π.χ. Κωνσταντίνου 2, Χρήστου"></div>`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button><button class="btn primary" onclick="App.saveResult('${id}')">Καταχώρηση</button>`);
  }
  function saveResult(id){
    const m=DB.matches.find(x=>x.id===id);
    m.gf=+$("#rGf").value||0; m.ga=+$("#rGa").value||0; m.status="played";
    m.scorers=$("#rSc").value.split(",").map(x=>x.trim()).filter(Boolean);
    save(); closeModal(); renderMatches(); toast("Αποτέλεσμα καταχωρήθηκε");
  }
  function delMatch(id){ if(!confirm("Διαγραφή αγώνα;"))return; DB.matches=DB.matches.filter(m=>m.id!==id); save(); closeModal(); renderMatches(); }

  /* ============================================================
     6) ΑΝΑΛΥΤΙΚΑ
     ============================================================ */
  function renderAnalytics(){
    const players=DB.players;
    if(!state.cmpA) state.cmpA=players[0]&&players[0].id;
    if(!state.cmpB) state.cmpB=players[1]&&players[1].id;
    const a=players.find(p=>p.id===state.cmpA), b=players.find(p=>p.id===state.cmpB);
    const played=DB.matches.filter(m=>m.status==="played");
    const gf=played.reduce((s,m)=>s+(m.gf||0),0), ga=played.reduce((s,m)=>s+(m.ga||0),0);
    const topScorers=[...players].sort((x,y)=>((y.goals||0)*2+(y.assists||0))-((x.goals||0)*2+(x.assists||0))).slice(0,5);
    const topRated=[...players].filter(p=>p.avgRating>0).sort((x,y)=>y.avgRating-x.avgRating).slice(0,6);

    // team attribute averages by line
    const lineAvg = keys => Math.round(avg(players.filter(p=>keys.includes(p.pos)).map(ovr))||0);

    $("#view-analytics").innerHTML = `
      <div class="sectionhead"><h2>📊 Αναλυτικά</h2></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="kpi"><div class="ic">⚽</div><div class="stat"><b>${gf}</b><span>Γκολ υπέρ (${played.length} αγ.)</span></div></div>
        <div class="kpi"><div class="ic">🥅</div><div class="stat"><b>${ga}</b><span>Γκολ κατά</span></div></div>
        <div class="kpi"><div class="ic">➕</div><div class="stat"><b>${gf-ga>=0?'+':''}${gf-ga}</b><span>Διαφορά</span></div></div>
        <div class="kpi"><div class="ic">📉</div><div class="stat"><b>${played.length?(ga/played.length).toFixed(1):'0'}</b><span>Γκολ κατά/αγ.</span></div></div>
      </div>

      <div class="grid g2">
        <div class="card">
          <h3>⚖️ Σύγκριση Παικτών</h3>
          <div class="row" style="margin-bottom:12px">
            <div><label>Παίκτης Α (κόκκινο)</label><select onchange="App.setCmp('A',this.value)">${players.map(p=>`<option value="${p.id}" ${p.id===state.cmpA?'selected':''}>${esc(p.name)} (${p.pos})</option>`).join("")}</select></div>
            <div><label>Παίκτης Β (μπλε)</label><select onchange="App.setCmp('B',this.value)">${players.map(p=>`<option value="${p.id}" ${p.id===state.cmpB?'selected':''}>${esc(p.name)} (${p.pos})</option>`).join("")}</select></div>
          </div>
          ${a&&b?compareRadar(a,b):'<div class="empty">Επίλεξε παίκτες</div>'}
        </div>
        <div>
          <div class="card" style="margin-bottom:16px">
            <h3>📈 Μ.Ο. Αξιολόγησης ανά Γραμμή</h3>
            <div class="mini-bars">
              ${lineBar("Τερματοφύλακας", lineAvg(["ΤΦ"]))}
              ${lineBar("Άμυνα", lineAvg(["ΣΤ","ΔΑ","ΑΑ"]))}
              ${lineBar("Μεσαία γραμμή", lineAvg(["ΑΜ","ΚΜ","10"]))}
              ${lineBar("Επίθεση", lineAvg(["ΔΕ","ΑΕ","ΕΠ","F9"]))}
            </div>
          </div>
          <div class="card" style="margin-bottom:16px">
            <h3>👟 Top Σκόρερ / Ασίστ</h3>
            ${topScorers.some(p=>p.goals||p.assists)? `<table><tbody>${topScorers.filter(p=>p.goals||p.assists).map((p,i)=>`
              <tr><td>${i+1}. <b>${esc(p.name)}</b></td><td class="right">${p.goals||0} ⚽ / ${p.assists||0} 🅰️</td></tr>`).join("")}</tbody></table>`
              : '<div class="empty">Καμία καταγραφή. Άνοιξε έναν αγώνα → «📊 Στατιστικά Παικτών».</div>'}
          </div>
          <div class="card">
            <h3>⭐ Μέση Βαθμολογία & Φόρμα</h3>
            ${topRated.length? `<table><tbody>${topRated.map((p,i)=>`
              <tr><td>${i+1}. <b>${esc(p.name)}</b> <span class="sub" style="font-size:11px">(${p.matches} αγ.)</span></td>
                <td class="right"><b style="color:${ratingColor(p.avgRating)};font-size:15px">${p.avgRating.toFixed(1)}</b></td>
                <td class="right" style="white-space:nowrap">${(p.form||[]).map(r=>`<span title="${r}" style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-left:2px;background:${ratingColor(r)}"></span>`).join("")}</td></tr>`).join("")}</tbody></table>
              <div class="legend" style="margin-top:8px"><span><i class="dotc" style="background:#fbbf24"></i>≥8</span><span><i class="dotc" style="background:#38bdf8"></i>≥7</span><span><i class="dotc" style="background:#f59e0b"></i>≥6</span><span><i class="dotc" style="background:#ef4444"></i>&lt;6</span></div>`
              : '<div class="empty">Καμία βαθμολογία ακόμη. Καταχώρησε στατιστικά ανά αγώνα.</div>'}
          </div>
        </div>
      </div>`;
  }
  function lineBar(name,v){ return `<div class="mb"><b style="text-align:left;color:var(--txt)">${name}</b><div class="attr-bar"><i style="width:${v/20*100}%;background:${attrColor(v)}"></i></div><b>${v}</b></div>`; }
  function setCmp(w,id){ if(w==='A')state.cmpA=id; else state.cmpB=id; renderAnalytics(); }
  function compareRadar(a,b){
    const keys=[...new Set([...Object.keys(a.attrs),...Object.keys(b.attrs)])].slice(0,8);
    const n=keys.length,cx=110,cy=110,R=88,max=20;
    const pt=(i,r)=>[cx+r*Math.cos(-Math.PI/2+i*2*Math.PI/n),cy+r*Math.sin(-Math.PI/2+i*2*Math.PI/n)];
    let grid="";[0.25,.5,.75,1].forEach(f=>grid+=`<polygon points="${keys.map((_,i)=>pt(i,R*f).join(",")).join(" ")}" fill="none" stroke="#2f4370"/>`);
    const poly=o=>keys.map((k,i)=>pt(i,R*Math.min(o.attrs[k]||0,max)/max).join(",")).join(" ");
    const labels=keys.map((k,i)=>{const[x,y]=pt(i,R+14);return `<text x="${x}" y="${y}" font-size="9" fill="#9fb0cc" text-anchor="middle" dominant-baseline="middle">${esc(k)}</text>`;}).join("");
    return `<div class="center"><svg viewBox="0 0 220 220" style="width:100%;max-width:340px">${grid}
      <polygon points="${poly(a)}" fill="#e4222f33" stroke="#e4222f" stroke-width="2"/>
      <polygon points="${poly(b)}" fill="#3b82f633" stroke="#3b82f6" stroke-width="2"/>${labels}</svg>
      <div class="legend" style="justify-content:center"><span><i class="dotc" style="background:#e4222f"></i>${esc(a.name)} (OVR ${ovr(a)})</span><span><i class="dotc" style="background:#3b82f6"></i>${esc(b.name)} (OVR ${ovr(b)})</span></div></div>`;
  }

  /* ============================================================
     7) ΠΡΟΓΡΑΜΜΑ
     ============================================================ */
  function renderSchedule(){
    // συνδυασμός αγώνων + custom events
    const items=[
      ...DB.matches.map(m=>({date:m.date, type:'match', title:`${DB.club.short} ${m.home?'vs':'@'} ${m.opp}`, sub:`${m.comp} · ${m.formation}`+(m.status==='played'?` · ${m.gf}–${m.ga}`:''), ic:'⚽'})),
      ...DB.events.map(e=>({...e, ic:e.type==='training'?'🏋️':'📌'}))
    ].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    $("#view-schedule").innerHTML = `
      <div class="sectionhead"><h2>📅 Πρόγραμμα</h2>
        <div class="sp"><button class="btn primary sm" onclick="App.addEvent()">＋ Γεγονός</button></div></div>
      <div class="card">${items.length?items.map(it=>`
        <div class="list-item"><div class="em">${it.ic}</div>
          <div class="meta"><b>${esc(it.title)}</b><small>${esc(it.sub||'')}</small></div>
          <span class="chip b">${fmtDate(it.date)}</span></div>`).join(""):'<div class="empty"><div class="big">📅</div>Κενό πρόγραμμα</div>'}</div>`;
  }
  function addEvent(){
    modal("Νέο Γεγονός",`
      <div class="field"><label>Τίτλος</label><input id="eTitle"></div>
      <div class="row"><div class="field"><label>Τύπος</label><select id="eType"><option value="training">Προπόνηση</option><option value="other">Άλλο</option></select></div>
        <div class="field"><label>Ημερομηνία</label><input type="date" id="eDate" value="${new Date().toISOString().slice(0,10)}"></div></div>
      <div class="field"><label>Σημείωση</label><input id="eSub"></div>`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button><button class="btn primary" onclick="App.saveEvent()">Αποθήκευση</button>`);
  }
  function saveEvent(){ DB.events.push({date:$("#eDate").value,type:$("#eType").value,title:$("#eTitle").value.trim()||"Γεγονός",sub:$("#eSub").value.trim()}); save(); closeModal(); renderSchedule(); }

  /* ============================================================
     8) ΑΚΑΔΗΜΙΑ ΤΑΚΤΙΚΗΣ (γνώση)
     ============================================================ */
  function renderAcademy(){
    $("#view-academy").innerHTML = `
      <div class="sectionhead"><h2>🎓 Ακαδημία Τακτικής</h2>
        <div class="sub2">Έννοιες, αρχές & μεθοδολογία — για τον επαγγελματία προπονητή</div></div>
      <div class="grid g2">
        ${acaCard("⚙️","Οι 4 Φάσεις του Παιχνιδιού",[
          "<b>Οργανωμένη Επίθεση</b> — έχεις τη μπάλα, ο αντίπαλος οργανωμένος.",
          "<b>Οργανωμένη Άμυνα</b> — δεν έχεις τη μπάλα, στήνεις το μπλοκ.",
          "<b>Θετική Μετάβαση</b> — μόλις κέρδισες τη μπάλα (επίθεση σε αταξία).",
          "<b>Αρνητική Μετάβαση</b> — μόλις έχασες τη μπάλα (counter-press / επαναφορά)."])}
        ${acaCard("🧩","Positional Play (Juego de Posición)",[
          "Κατάληψη χώρου με κανόνες: max 3 σε γραμμή, όχι 2 στην ίδια λωρίδα.",
          "Ημι-χώροι (halfspaces): οι πιο επικίνδυνες ζώνες δημιουργίας.",
          "Αριθμητική υπεροχή γύρω από τη μπάλα (τρίγωνα, δεύτερη γραμμή πάσας).",
          "Στόχος: να τραβήξεις τον αντίπαλο και να παίξεις ανάμεσα στις γραμμές."])}
        ${acaCard("🔥","Gegenpressing (Counter-Press)",[
          "Πιο ευάλωτος ο αντίπαλος στα πρώτα 3-5'' μετά την ανάκτηση.",
          "Άμεση πίεση από τους κοντινούς 3-4 παίκτες.",
          "Cover shadow: κλείνεις γραμμή πάσας ενώ τρέχεις στον κάτοχο.",
          "«Η ανάκτηση είναι η καλύτερη δημιουργία ευκαιρίας» (Klopp)."])}
        ${acaCard("🛡️","Χαμηλό Μπλοκ & Άμυνα Ζώνης",[
          "Δύο γραμμές των 4 σε απόσταση 10-12μ, συλλογική μετακίνηση (block-shift).",
          "Υπερασπίζεσαι τον χώρο, όχι τον παίκτη· κλείνεις πρώτα το κέντρο.",
          "Οδηγείς τον αντίπαλο στις πλάγιες — εκεί στήνεις την παγίδα.",
          "Ισορροπία μετάβασης (rest-defense) πάντα οργανωμένη."])}
        ${acaCard("🔁","Ανεστραμμένος Μπακ (Inverted Fullback)",[
          "Στην κατοχή μπαίνει στο κέντρο ως 2ο «6άρι» → βάση 3-2.",
          "Δίνει αριθμητική υπεροχή στο κέντρο & έλεγχο τέμπο.",
          "Βελτιώνει την ισορροπία μετάβασης (rest-defense).",
          "Καθιερώθηκε από Guardiola (Lahm, Cancelo, Stones), υιοθέτησαν Arteta, Slot."])}
        ${acaCard("📅","Tactical Periodization (Vítor Frade)",[
          "Ποτέ χωριστά φυσικό/τεχνικό/τακτικό/ψυχολογικό — όλα μαζί μέσα από το παιχνίδι.",
          "Peak φορτίου στο MD-3 (72ω πριν), σταδιακή αποφόρτιση προς τον αγώνα.",
          "Οι ασκήσεις αναπαράγουν καταστάσεις αγώνα (specificity).",
          "Δημοφιλής μέσω Mourinho· ρίζες στο FC Porto."])}
        ${acaCard("📚","Υπάρχουν «Επίσημες» Προπονήσεις;",[
          "<b>Όχι απευθείας από τους ίδιους.</b> Οι Guardiola/Klopp/Simeone δεν δημοσιεύουν τα επίσημα session plans τους.",
          "Υπάρχουν όμως <b>αναλύσεις & αναπαραστάσεις από UEFA-licensed προπονητές</b>, βασισμένες στις πραγματικές μεθόδους τους.",
          "Βιβλία/βίντεο: SoccerTutor («85 Pep passing exercises», «80 Klopp combinations»), «Possession with Purpose» (120 sessions), «Coaching Transition Play» (Simeone/Guardiola/Klopp/Mourinho/Ranieri).",
          "Στην ενότητα <b>Προπονήσεις</b> βρίσκεις ασκήσεις βασισμένες σε αυτές τις δημοσιευμένες μεθοδολογίες (με σήμανση πηγής 📖)."])}
      </div>
      <div class="card" style="margin-top:16px">
        <h3>📐 Οι Ζώνες του Γηπέδου</h3>
        <div class="board-wrap">
          <div>${zonesSVG()}</div>
          <div class="detail-block">
            <h4>Λωρίδες (κάθετα)</h4>
            <ul><li>2 πλάγιες (wide) — πλάτος & σέντρες</li>
            <li>2 ημι-χώροι (halfspaces) — κλειδί δημιουργίας</li>
            <li>1 κεντρική — έλεγχος & τελείωμα</li></ul>
            <h4>Ζώνες (οριζόντια)</h4>
            <ul><li>Αμυντικό τρίτο — ασφάλεια, ανάπτυξη</li>
            <li>Μεσαίο τρίτο — δημιουργία, μεταβάσεις</li>
            <li>Επιθετικό τρίτο — τελική πάσα, τελείωμα</li></ul>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>📖 Πηγές & Περαιτέρω Μελέτη</h3>
        <div class="sub">Οι έννοιες βασίζονται σε δημόσια τακτική βιβλιογραφία & ανάλυση:</div>
        <ul class="sub" style="margin-top:8px">
          <li>Guardiola — Tactical Strategy & Philosophy (josep-guardiola.com)</li>
          <li>Tactical Periodization — Barça Innovation Hub (barcainnovationhub.fcbarcelona.com)</li>
          <li>Total Football Analysis — Modern European tactics</li>
          <li>The Football Analyst — Inverted Fullbacks Explained</li>
        </ul>
      </div>`;
  }
  function acaCard(ic,title,items){ return `<div class="card"><h3>${ic} ${esc(title)}</h3><ul class="detail-block" style="margin:0;padding-left:18px">${items.map(x=>`<li style="margin-bottom:6px;font-size:13px;line-height:1.5">${x}</li>`).join("")}</ul></div>`; }
  function zonesSVG(){
    let s=`<svg viewBox="0 0 100 150" style="width:100%;max-width:280px;border-radius:10px">`;
    s+=`<rect x="0" y="0" width="100" height="150" fill="#12203c"/>`;
    // vertical lanes
    const lanes=[0,20,37,63,80,100], colors=["#ffffff08","#e4222f22","#f59e0b22","#e4222f22","#ffffff08"];
    for(let i=0;i<5;i++) s+=`<rect x="${lanes[i]}" y="0" width="${lanes[i+1]-lanes[i]}" height="150" fill="${colors[i]}"/>`;
    for(let i=1;i<5;i++) s+=`<line x1="${lanes[i]}" y1="0" x2="${lanes[i]}" y2="150" stroke="#ffffff44" stroke-dasharray="2 2"/>`;
    // horizontal thirds
    [50,100].forEach(y=>s+=`<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="#ffffff66"/>`);
    s+=`<text x="28.5" y="75" fill="#fff" font-size="6" text-anchor="middle" transform="rotate(-90 28.5 75)">ΗΜΙ-ΧΩΡΟΣ</text>`;
    s+=`<text x="71.5" y="75" fill="#fff" font-size="6" text-anchor="middle" transform="rotate(-90 71.5 75)">ΗΜΙ-ΧΩΡΟΣ</text>`;
    s+=`<text x="50" y="76" fill="#fff" font-size="6" text-anchor="middle" transform="rotate(-90 50 76)">ΚΕΝΤΡΟ</text>`;
    s+=`</svg>`;
    return s;
  }

  /* ============================================================
     Club / Export / Import
     ============================================================ */
  function editClub(){
    modal("Ρυθμίσεις Ομάδας",`
      <div class="row"><div class="field"><label>Όνομα</label><input id="cName" value="${esc(DB.club.name)}"></div>
        <div class="field" style="max-width:100px"><label>Αρκτικόλεξο</label><input id="cShort" value="${esc(DB.club.short)}" maxlength="4"></div></div>
      <div class="field"><label>Βασικός σχηματισμός</label><select id="cForm">${Object.keys(FORMATIONS).map(f=>`<option ${f===DB.club.formation?'selected':''}>${f}</option>`).join("")}</select></div>`,
      `<button class="btn" onclick="App.closeModal()">Άκυρο</button><button class="btn primary" onclick="App.saveClub()">Αποθήκευση</button>`);
  }
  function saveClub(){ DB.club.name=$("#cName").value.trim()||"Η Ομάδα μου"; DB.club.short=($("#cShort").value.trim()||"FC").toUpperCase(); DB.club.formation=$("#cForm").value; save(); closeModal(); syncHeader(); go(state.view); }
  function syncHeader(){ $("#clubName").textContent=DB.club.name; $("#clubDot").textContent=DB.club.short.slice(0,3); }

  function exportData(){
    const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="tactix-"+new Date().toISOString().slice(0,10)+".json"; a.click(); toast("Εξήχθη");
  }
  function importData(ev){
    const f=ev.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>{ try{ DB=JSON.parse(r.result); save(); syncHeader(); go("dashboard"); toast("Εισήχθη επιτυχώς"); }catch(e){ toast("Σφάλμα αρχείου"); } };
    r.readAsText(f); ev.target.value="";
  }

  /* ---------- init ---------- */
  /* ---------- Γέφυρα από DATA COACH 360° (αρχείο ή ίδιο origin μέσω Coach Hub) ---------- */
  const DC_INBOX = "dc360_bridge_inbox";
  const normNm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim();
  function applyDataCoach(b){
    if(!b || b.format!=="datacoach360-bridge"){ toast("Μη έγκυρο αρχείο DATA COACH"); return false; }
    const repl = $("#dcRepl") && $("#dcRepl").checked;
    if(repl){ const keep=new Set((b.players||[]).map(x=>normNm(x.name))); DB.players = DB.players.filter(x=>keep.has(normNm(x.name))); }
    let added=0, updated=0; const idByName={};
    (b.players||[]).forEach(src=>{
      let pl = DB.players.find(x=>normNm(x.name)===normNm(src.name));
      if(pl){ updated++; Object.assign(pl, { pos:src.pos, age:src.age, attrs:src.attrs, suitability:src.suitability,
                pastPositions:[...new Set([...(pl.pastPositions||[]), src.pos])], minutes:src.minutes, goals:src.goals, assists:src.assists, notes:src.notes }); }
      else { pl = p(src.name, src.pos, src.age, src.attrs, { suitability:src.suitability, pastPositions:[src.pos] });
             Object.assign(pl, { minutes:src.minutes, goals:src.goals, assists:src.assists, notes:src.notes }); DB.players.push(pl); added++; }
      pl.dc = true; idByName[normNm(src.name)] = pl.id;
    });
    let t = DB.tactics.find(x=>x.id===b.tacticId);
    // Δικό σου σύστημα από το DATA COACH → νέα τακτική στο TACTIX
    if(!t && b.customTactic){
      const ct = b.customTactic, fname = "★ "+ct.name, pos = ct.positions.map(q=>({ r:q.r, x:q.x, y:q.y, roleCode:q.roleCode, roleName:q.roleName }));
      FORMATIONS[fname] = pos.map(q=>({ r:q.r, x:q.x, y:q.y }));
      t = { id:ct.id, custom:true, name:ct.name, coach:ct.coach||"", team:DB.club.name, formation:fname, emoji:"⭐", intensity:"",
            style:Object.entries(ct.tags||{}).filter(([,v])=>v>=.7).map(([k])=>({pos:"Κατοχή",press:"Πίεση",direct:"Κάθετο",counter:"Μετάβαση",width:"Πλάτος",central:"Κέντρο",aerial:"Σέντρες",int:"Ένταση",bait:"Δόλωμα πίεσης"})[k]||k),
            summary:"Σύστημα από το DATA COACH 360° (βάση σχηματισμού "+ct.formation+").", phases:{buildup:[],attack:[],defense:[],transition:[]}, movements:[], keyRoles:[],
            positions:pos, customPositions:pos };
      DB.tactics.push(t);
    }
    // ρόλος (FM κωδικός) σε κάθε θέση της τακτικής, όπως ορίστηκε στο DATA COACH
    if(t && b.xi && b.xi.length){
      if(!t.positions) t.positions = (FORMATIONS[t.formation]||t.customPositions||FORMATIONS["4-3-3"]).map(q=>({r:q.r,x:q.x,y:q.y}));
      b.xi.forEach(s=>{ const q=t.positions[s.i]; if(q && !q.opp && s.role){ q.roleCode=s.role; if(s.roleName) q.roleName=s.roleName; } });
    }
    const xiIds = (b.xi||[]).map(s=>s.name ? idByName[normNm(s.name)]||null : null);
    if(t){ const nx={}; xiIds.forEach((id,i)=>{ if(id) nx[i]=id; }); t.nameXI = nx; }
    if(b.formation){ DB.club.formation = t ? t.formation : b.formation; }
    if(b.club && b.club.name && DB.club.name==="Η Ομάδα μου") DB.club.name = b.club.name;
    if(b.opponent){
      const o=b.opponent; let m = DB.matches.find(x=>x.status==="upcoming" && normNm(x.opp)===normNm(o.name));
      if(!m){ m = { id:"m_dc_"+Date.now(), opp:o.name, date:o.date, home:true, comp:"Πρωτάθλημα", gf:null, ga:null, status:"upcoming", scorers:[], lineup:[] }; DB.matches.push(m); }
      Object.assign(m, { formation:t ? t.formation : b.formation, tacticId:b.tacticId, oppNotes:o.notes, lineup:xiIds.filter(Boolean).length===11?xiIds:m.lineup||[] });
    }
    DB.dcBridge = { at:b.at, tacticId:b.tacticId, drills:(b.opponent&&b.opponent.drills)||[] };
    save(); try{ syncHeader(); }catch(_){} go(state.view||"squad");
    toast(`DATA COACH ✔ ${updated} ενημερώθηκαν · ${added} νέοι${t?" · 11άδα στο «"+t.name.slice(0,28)+"»":""}`);
    return true;
  }
  function importDataCoach(){
    let inbox=null; try{ inbox=JSON.parse(localStorage.getItem(DC_INBOX)); }catch(_){}
    const inboxHTML = inbox ? `<div class="card" style="margin-bottom:12px"><b>⚡ Βρέθηκαν δεδομένα από το DATA COACH</b><div style="color:var(--mut);font-size:13px;margin:6px 0">${(inbox.players||[]).length} παίκτες · σύστημα ${inbox.formation||""} · ${inbox.opponent?"αγώνας vs "+inbox.opponent.name:"χωρίς αγώνα"} · ${new Date(inbox.at).toLocaleString("el-GR")}</div><button class="btn primary sm" onclick="App.importDataCoachInbox()">Εισαγωγή τώρα</button></div>` : "";
    modal("🔗 Εισαγωγή από DATA COACH 360°", `${inboxHTML}
      <p style="color:var(--mut);font-size:13px">Επίλεξε το αρχείο <b>DATACOACH_to_TACTIX_….json</b> (DATA COACH → «Σύνδεση TACTIX» → «Λήψη αρχείου»). Οι παίκτες με ίδιο όνομα ενημερώνονται, οι νέοι προστίθενται· ορίζεται η 11άδα της τακτικής και ο επόμενος αγώνας με το report αντιπάλου.</p>
${(()=>{ const u = location.hostname.endsWith("github.io") ? "/datacoach-360/#bridge" : location.pathname.startsWith("/tactix") ? "/datacoach/#bridge" : ""; return u ? `<p><a class="btn sm" href="${u}" target="_blank" rel="noopener">📊 Άνοιγμα DATA COACH 360° → Σύνδεση TACTIX</a></p>` : ""; })()}
      <label style="display:block;margin:10px 0;font-size:13px"><input type="checkbox" id="dcRepl"> Αντικατάσταση ρόστερ (αφαίρεση παικτών που δεν υπάρχουν στο DATA COACH)</label>
      <input type="file" id="dcFile" accept=".json">`, `<button class="btn" onclick="App.closeModal()">Κλείσιμο</button>`);
    $("#dcFile").onchange = e=>{ const f=e.target.files[0]; if(!f) return; f.text().then(t=>{ try{ if(applyDataCoach(JSON.parse(t))) closeModal(); }catch(_){ toast("Μη έγκυρο JSON"); } }); };
  }
  function importDataCoachInbox(){ try{ const b=JSON.parse(localStorage.getItem(DC_INBOX)); if(applyDataCoach(b)){ localStorage.removeItem(DC_INBOX); closeModal(); } }catch(_){ toast("Σφάλμα"); } }
  function checkDataCoachInbox(){
    try{ const b=JSON.parse(localStorage.getItem(DC_INBOX)); if(b && (!DB.dcBridge || DB.dcBridge.at!==b.at)) setTimeout(()=>toast("🔗 Νέα δεδομένα από DATA COACH — Ρόστερ → «🔗 DATA COACH»"), 900); }catch(_){}
  }

  /* ---------- Οθόνη: ύψος κεφαλίδας, πλήρης οθόνη, περιστροφή συσκευής ---------- */
  function syncHeaderHeight(){ const h=document.querySelector("header"); if(h) document.documentElement.style.setProperty("--hdr", h.offsetHeight+"px"); }
  function fullscreen(){
    const d=document, el=d.documentElement;
    if(d.fullscreenElement||d.webkitFullscreenElement) (d.exitFullscreen||d.webkitExitFullscreen).call(d);
    else { const req=el.requestFullscreen||el.webkitRequestFullscreen; if(req) Promise.resolve(req.call(el)).catch(()=>toast("Η πλήρης οθόνη δεν υποστηρίζεται εδώ")); else toast("Πρόσθεσε το TACTIX στην αρχική οθόνη για πλήρη οθόνη"); }
  }
  function initScreen(){
    syncHeaderHeight();
    if(window.ResizeObserver){ const h=document.querySelector("header"); if(h) new ResizeObserver(syncHeaderHeight).observe(h); }
    let t; const land=()=>matchMedia("(orientation: landscape)").matches; let last=land();
    const redraw=()=>{ syncHeaderHeight(); const l=land(); if(l===last) return; last=l; if($("#modalBg").classList.contains("open")) return; const y=scrollY; try{ go(state.view); }catch(_){} requestAnimationFrame(()=>scrollTo(0,y)); };
    addEventListener("resize",()=>{ clearTimeout(t); t=setTimeout(redraw,220); });
    addEventListener("orientationchange",()=>setTimeout(redraw,300));
    const fs=$("#fsBtn"); if(fs && !(document.fullscreenEnabled||document.webkitFullscreenEnabled)) fs.style.display="none";
    document.addEventListener("fullscreenchange",()=>{ if(fs) fs.textContent=document.fullscreenElement?"🗗":"⛶"; });
  }

  function init(){
    load(); renderNav(); syncHeader(); checkDataCoachInbox(); initScreen();
    // λογότυπο κεφαλίδας + favicon
    const bl=$("#brandLogo"); if(bl) bl.innerHTML=LOGO_SVG();
    try{ const fav=$("#favicon"); if(fav) fav.href="data:image/svg+xml;utf8,"+encodeURIComponent(LOGO_SVG(64)); }catch(_){}
    // PWA service worker (offline cache) — δουλεύει σε http(s)/localhost, όχι σε file://
    try{ if("serviceWorker" in navigator && location.protocol!=="file:") navigator.serviceWorker.register("sw.js").catch(()=>{}); }catch(_){}
    $("#clubPill").onclick=editClub;
    $("#modalBg").addEventListener("click",e=>{ if(e.target===$("#modalBg")) closeModal(); });
    go("dashboard");
  }

  return {
    init, go, closeModal, export:exportData, import:importData, fullscreen, importDataCoach, importDataCoachInbox,
    // squad
    viewPlayer, editPlayer, savePlayer, delPlayer, addAttrRow, cycleStatus,
    // tactics
    renderTactics, openTactic, tacTab, useTactic, newTactic, openDesigner, designerForm, saveTactic, delTactic,
    boardTool, clearArrows, setRole, dTool, dClearArrows, setDesignerRole, addOpp, cycleLabels,
    cycleOppSymbol, toggleOppColor, saveBoardImage, setNameXI, saveNameXI, clearNameXI,
    present, presentNav, presentGo, presentArrows, presentExit, presentTool, presentBall, presentClear, presentAnim,
    whiteboard, boardWTool, boardWBall, boardWOpp, boardWImage, boardWUndo, boardWClear, boardWExit,
    renderPlaybook, playCat, openPlay, playTool, playBall, playClear, playAddOpp, newPlay, savePlay, delPlay,
    presentPlay, presentPlayNav, presentPlayGo, presentPlayExit, printPlay, exportWordPlay,
    printTactic, printSessionDoc, printMicro,
    exportWordTactic, exportWordSession, exportWordMicro, exportExcelRoster, exportExcelDrills,
    // training
    trainTab:trainTabSet, viewDrill, newDrill, saveDrill, delDrill, saveSession, viewSession, delSession, printSession, editMicro, saveMicro,
    // matches
    openMatch, editMatch, saveMatch, resultMatch, saveResult, delMatch, editLineup, saveLineup, printMatch, exportWordMatch, editMatchStats, saveMatchStats,
    // analytics
    setCmp,
    // schedule
    addEvent, saveEvent,
    // club
    editClub, saveClub
  };
})();
document.addEventListener("DOMContentLoaded", App.init);
