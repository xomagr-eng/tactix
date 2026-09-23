/* ============================================================
   TACTIX — Σχεδίαση Γηπέδου (SVG, offline, χωρίς libs)
   viewBox 0..100 (x) · 0..150 (y). Επίθεση προς τα πάνω.
   ============================================================ */
const Pitch = (() => {
  const VB_W = 100, VB_H = 150;
  const X0 = 5, X1 = 95;        // πλάτος αγωνιστικού
  const Y0 = 6, Y1 = 144;       // μήκος (πάνω=αντίπαλος)

  const fx = dx => X0 + (dx/100)*(X1-X0);
  const fy = dy => Y1 - (dy/100)*(Y1-Y0);   // dy 0 = κάτω (δικό μας)
  const inv = (px,py) => ({
    x: Math.max(2, Math.min(98, ((px-X0)/(X1-X0))*100)),
    y: Math.max(2, Math.min(98, ((Y1-py)/(Y1-Y0))*100))
  });

  const roleColor = r => {
    if(r==="ΤΦ") return "#fbbf24";                     // ΤΦ — κίτρινο
    if(["ΣΤ","ΔΑ","ΑΑ"].includes(r)) return "#3b82f6"; // άμυνα — μπλε
    if(["ΑΜ","ΚΜ","10"].includes(r)) return "#e2e8f0"; // μεσαία — λευκό/ασημί
    return "#e4222f"; // επίθεση (ΔΕ,ΑΕ,ΕΠ,F9) — κόκκινο
  };

  function fieldSVG(){
    const L = "rgba(255,255,255,.55)", G1="#16264a", G2="#12203c";
    let s = "";
    // ριγέ chalkboard (σκούρο, χωρίς πράσινο)
    for(let i=0;i<7;i++){
      const y = Y0 + i*((Y1-Y0)/7);
      s += `<rect x="${X0}" y="${y}" width="${X1-X0}" height="${(Y1-Y0)/7}" fill="${i%2?G1:G2}"/>`;
    }
    const line = (x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${L}" stroke-width=".5"/>`;
    const rect = (x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${L}" stroke-width=".5"/>`;
    // περίγραμμα
    s += rect(X0,Y0,X1-X0,Y1-Y0);
    // σέντρα
    s += line(X0,(Y0+Y1)/2,X1,(Y0+Y1)/2);
    s += `<circle cx="50" cy="${(Y0+Y1)/2}" r="9" fill="none" stroke="${L}" stroke-width=".5"/>`;
    s += `<circle cx="50" cy="${(Y0+Y1)/2}" r=".9" fill="${L}"/>`;
    // περιοχές (πάνω = αντίπαλος, κάτω = δικό μας)
    const boxW=38, boxWx=(100-boxW)/2, boxH=18, sixW=18, sixWx=(100-sixW)/2, sixH=7;
    // κάτω
    s += rect(fx(boxWx),Y1-boxH,fx(boxWx+boxW)-fx(boxWx),boxH);
    s += rect(fx(sixWx),Y1-sixH,fx(sixWx+sixW)-fx(sixWx),sixH);
    s += `<circle cx="50" cy="${Y1-12}" r=".9" fill="${L}"/>`;
    // πάνω
    s += rect(fx(boxWx),Y0,fx(boxWx+boxW)-fx(boxWx),boxH);
    s += rect(fx(sixWx),Y0,fx(sixWx+sixW)-fx(sixWx),sixH);
    s += `<circle cx="50" cy="${Y0+12}" r=".9" fill="${L}"/>`;
    // τέρματα
    s += `<rect x="43" y="${Y0-1.5}" width="14" height="1.5" fill="${L}"/>`;
    s += `<rect x="43" y="${Y1}" width="14" height="1.5" fill="${L}"/>`;
    return s;
  }

  function tokenSVG(pl, i, num, labelOverride, subOverride, oppColor){
    const c = pl.opp ? (oppColor||"#64748b") : roleColor(pl.r);
    const x = fx(pl.x), y = fy(pl.y);
    const label = (labelOverride!=null) ? labelOverride : (pl.label ? pl.label : (num!=null? num : (pl.r||i))) ;
    const sub = (subOverride!=null && subOverride!=="")
      ? `<text y="9.2" text-anchor="middle" font-size="3.1" font-weight="700" fill="#fff" style="paint-order:stroke;stroke:#0b1220;stroke-width:.7px">${esc(subOverride)}</text>`
      : (pl.roleCode ? `<text y="9.1" text-anchor="middle" font-size="3.5" font-weight="800" fill="#ff8a8a" style="paint-order:stroke;stroke:#0b1220;stroke-width:.9px">${esc(pl.roleCode)}</text>`
        : (pl.name ? `<text y="9.2" text-anchor="middle" font-size="3.1" font-weight="700" fill="#fff" style="paint-order:stroke;stroke:#0b1220;stroke-width:.7px">${esc(pl.name)}</text>` : ""));
    return `<g class="tok" data-i="${i}" transform="translate(${x},${y})">
      <circle r="4.4" fill="${c}" stroke="#0b1220" stroke-width=".6"/>
      <text y="1.4" text-anchor="middle" font-size="4" font-weight="800" fill="#fff" style="paint-order:stroke;stroke:#0b1220;stroke-width:.9px">${label}</text>
      ${sub}
    </g>`;
  }

  function arrowsSVG(arrows){
    if(!arrows||!arrows.length) return "";
    let s = `<defs>
      <marker id="ah" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#fde047"/></marker>
      <marker id="ah2" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#38bdf8"/></marker>
    </defs>`;
    arrows.forEach(a=>{
      const x1=fx(a.from[0]),y1=fy(a.from[1]),x2=fx(a.to[0]),y2=fy(a.to[1]);
      const pass = a.type==="pass";
      const col = pass?"#38bdf8":"#fde047";
      const dash = pass?'stroke-dasharray="2 2"':'';
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width=".9" ${dash} marker-end="url(#${pass?'ah2':'ah'})"/>`;
    });
    return s;
  }

  function render(container, positions, opts={}){
    const svg = `<svg id="pitchSVG" viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg">
      ${fieldSVG()}
      ${arrowsSVG(opts.arrows)}
      ${positions.map((pl,i)=>tokenSVG(pl,i,opts.numbers?pl.num:undefined, opts.labels?opts.labels[i]:undefined, opts.subs?opts.subs[i]:undefined, opts.oppColor)).join("")}
      ${opts.ball?ballSVG(opts.ball):""}
    </svg>`;
    container.innerHTML = svg;
    const el = container.querySelector("#pitchSVG");
    el.setAttribute("id","pitch");
    if(opts.draggable || opts.onToken || opts.onArrow || opts.ball) enableInteract(el, positions, opts);
    return el;
  }

  function ballSVG(b){
    const x=fx(b.x), y=fy(b.y);
    return `<g class="ball" style="cursor:grab" transform="translate(${x},${y})">
      <circle r="3.2" fill="#fff" stroke="#0b1220" stroke-width=".6"/>
      <path d="M0,-3.2 L1.9,-1 L1.15,1.7 L-1.15,1.7 L-1.9,-1 Z" fill="#111"/>
      <circle r="3.2" fill="none" stroke="#0b1220" stroke-width=".4"/>
    </g>`;
  }

  /* Διαδραστικότητα: σύρσιμο πιόνια (move), σχεδίαση βελών (run/pass),
     κλικ σε πιόνι για ρόλο (onToken). Το εργαλείο ορίζεται από opts.tool. */
  function enableInteract(svg, positions, opts){
    const tool = opts.tool || "move";
    const SVGNS = "http://www.w3.org/2000/svg";
    const pt = svg.createSVGPoint();
    const toSVG = (evt)=>{ pt.x=evt.clientX; pt.y=evt.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    let active=null, activeBall=false, moved=false, aStart=null, preview=null;
    const canDrag = opts.draggable || opts.ball;

    svg.querySelectorAll(".tok").forEach(g=>{
      g.addEventListener("pointerdown", e=>{
        if(tool!=="move") return;          // στα βέλη αγνόησε το πιόνι
        active=g; activeBall=false; moved=false;
        try{ g.setPointerCapture(e.pointerId); }catch(_){}
        e.stopPropagation();
      });
    });
    const ballEl=svg.querySelector(".ball");
    if(ballEl){ ballEl.addEventListener("pointerdown", e=>{
        if(tool!=="move") return;
        active=ballEl; activeBall=true; moved=false;
        try{ ballEl.setPointerCapture(e.pointerId); }catch(_){}
        e.stopPropagation();
      });
    }

    svg.addEventListener("pointerdown", e=>{
      if(active) return;
      if(tool==="run" || tool==="pass"){ aStart=toSVG(e); moved=false; }
    });

    svg.addEventListener("pointermove", e=>{
      const p=toSVG(e);
      if(active && canDrag){ active.setAttribute("transform",`translate(${p.x},${p.y})`); moved=true; }
      else if(aStart){ moved=true; drawPreview(aStart,p); }
    });

    svg.addEventListener("pointerup", e=>{
      const p=toSVG(e);
      if(tool==="erase"){ eraseHit(p); return; }
      if(active){
        if(activeBall){
          if(moved){ const d=inv(p.x,p.y); opts.onBallMove&&opts.onBallMove({x:Math.round(d.x),y:Math.round(d.y)}); }
          active=null; activeBall=false; return;
        }
        const i=+active.dataset.i;
        if(opts.draggable && moved){ const d=inv(p.x,p.y); positions[i].x=Math.round(d.x); positions[i].y=Math.round(d.y); opts.onMove&&opts.onMove(i,positions[i]); }
        else if(!moved && opts.onToken){ opts.onToken(i); }
        active=null;
      } else if(aStart){
        if(moved && opts.onArrow){
          const a=inv(aStart.x,aStart.y), b=inv(p.x,p.y);
          if(Math.hypot(b.x-a.x,b.y-a.y)>3) opts.onArrow([Math.round(a.x),Math.round(a.y)],[Math.round(b.x),Math.round(b.y)], tool==="pass"?"pass":"run");
        }
        aStart=null; removePreview();
      }
    });

    function drawPreview(a,b){
      removePreview();
      preview=document.createElementNS(SVGNS,"line");
      preview.setAttribute("x1",a.x); preview.setAttribute("y1",a.y);
      preview.setAttribute("x2",b.x); preview.setAttribute("y2",b.y);
      preview.setAttribute("stroke", tool==="pass"?"#38bdf8":"#fde047");
      preview.setAttribute("stroke-width",".9");
      if(tool==="pass") preview.setAttribute("stroke-dasharray","2 2");
      svg.appendChild(preview);
    }
    function removePreview(){ if(preview){ preview.remove(); preview=null; } }

    /* Γόμα: αγγίζεις κοντά σε βέλος → σβήσιμο· κοντά σε αντίπαλο/πρόσθετο πιόνι → αφαίρεση */
    function segDist(px,py, x1,y1, x2,y2){
      const dx=x2-x1, dy=y2-y1; const L2=dx*dx+dy*dy;
      let t = L2? ((px-x1)*dx+(py-y1)*dy)/L2 : 0; t=Math.max(0,Math.min(1,t));
      const cx=x1+t*dx, cy=y1+t*dy; return Math.hypot(px-cx,py-cy);
    }
    function eraseHit(p){
      // κοντινότερο αφαιρέσιμο πιόνι (opp ή added)
      let tMin=1e9, tIdx=-1;
      positions.forEach((pl,i)=>{ if(pl.opp||pl.added){ const d=Math.hypot(p.x-fx(pl.x), p.y-fy(pl.y)); if(d<tMin){tMin=d;tIdx=i;} } });
      // κοντινότερο βέλος
      let aMin=1e9, aIdx=-1;
      (opts.arrows||[]).forEach((a,i)=>{ const d=segDist(p.x,p.y, fx(a.from[0]),fy(a.from[1]), fx(a.to[0]),fy(a.to[1])); if(d<aMin){aMin=d;aIdx=i;} });
      if(tIdx>=0 && tMin<5 && tMin<=aMin){ opts.onErase&&opts.onErase("token",tIdx); }
      else if(aIdx>=0 && aMin<3.5){ opts.onErase&&opts.onErase("arrow",aIdx); }
    }
  }

  function esc(s){return (s+"").replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));}

  return { render, roleColor };
})();
