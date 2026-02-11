// ===============================
// SOC Ops Simulator — utils.js
// Local-only helpers (no network)
// ===============================

export const nowISO = () => new Date().toISOString();

export function uid(prefix="id"){
  // Fast unique-ish id (good enough for local sim)
  const a = Math.random().toString(16).slice(2);
  const b = Date.now().toString(16);
  return `${prefix}_${b}_${a}`;
}

export function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

export function fmtTime(iso){
  const d = new Date(iso);
  const pad = (x)=> String(x).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function humanAge(iso){
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms/1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h/24);
  return `${d}d`;
}

export function escapeHtml(s=""){
  return s.replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

export function debounce(fn, ms=180){
  let t=null;
  return (...args)=>{
    clearTimeout(t);
    t=setTimeout(()=>fn(...args), ms);
  };
}

export function toast(host, {title, body, meta=[], tone="ok"}){
  const el = document.createElement("div");
  el.className="toast";
  const dot = tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  el.innerHTML = `
    <div class="t-title"><span class="t-dot" style="background:${dot}"></span>${escapeHtml(title)}</div>
    <div class="t-body">${escapeHtml(body || "")}</div>
    <div class="t-meta">${meta.map(m=>`<span>${escapeHtml(m)}</span>`).join("")}</div>
  `;
  host.appendChild(el);
  setTimeout(()=>{
    el.style.opacity="0";
    el.style.transform="translateY(6px)";
    el.style.transition="opacity .2s ease, transform .2s ease";
  }, 4200);
  setTimeout(()=> el.remove(), 4600);
}

export function downloadText(filename, text, mime="application/json"){
  const blob = new Blob([text], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 2500);
}

export function readFileAsText(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result || ""));
    r.onerror = ()=> reject(r.error || new Error("Failed to read file"));
    r.readAsText(file);
  });
}

export function setRoute(route){
  history.pushState({route}, "", `#${route}`);
  window.dispatchEvent(new Event("hashchange"));
}

export function getRoute(){
  const h = (location.hash || "#dashboard").slice(1);
  return h || "dashboard";
}

export function copyToClipboard(text){
  return navigator.clipboard?.writeText(text) ?? Promise.reject(new Error("Clipboard not available"));
}

// Small query language: tokens like field:value and free text.
// Supports AND/OR/NOT, parentheses are not supported (kept simple).
export function parseQuery(q){
  q = (q || "").trim();
  if (!q) return {terms:[], ops:[]};

  // Split but keep quoted strings
  const tokens = [];
  let cur = "", inQ = false;
  for (let i=0;i<q.length;i++){
    const ch = q[i];
    if (ch === '"'){ inQ = !inQ; continue; }
    if (!inQ && /\s/.test(ch)){
      if (cur) tokens.push(cur), cur="";
    } else cur += ch;
  }
  if (cur) tokens.push(cur);

  const ops = [];
  const terms = [];

  for (const t of tokens){
    const up = t.toUpperCase();
    if (up === "AND" || up === "OR" || up === "NOT"){
      ops.push(up);
    } else {
      const m = t.match(/^([a-zA-Z_]+):(.*)$/);
      if (m){
        terms.push({field:m[1].toLowerCase(), value:m[2].toLowerCase()});
      } else {
        terms.push({field:null, value:t.toLowerCase()});
      }
    }
  }
  return {terms, ops};
}

export function matchQuery(obj, q){
  const {terms, ops} = parseQuery(q);
  if (!terms.length) return true;

  // Evaluate left-to-right with ops; NOT negates next term.
  let result = true;
  let pendingOp = "AND";
  let negateNext = false;

  const evalTerm = (term)=>{
    const v = term.value;
    if (!v) return true;

    const hay = (field)=> String(obj[field] ?? "").toLowerCase();
    if (!term.field){
      // free text: search across key fields
      const bag = [
        hay("title"),
        hay("summary"),
        hay("source"),
        hay("severity"),
        hay("user"),
        hay("host"),
        hay("tactic"),
        hay("technique"),
        (obj.tags||[]).join(" ").toLowerCase(),
      ].join(" • ");
      return bag.includes(v);
    }
    // fielded
    if (term.field === "tag" || term.field === "tags"){
      return (obj.tags||[]).join(" ").toLowerCase().includes(v);
    }
    return hay(term.field).includes(v);
  };

  let opIndex = 0;
  for (let i=0;i<terms.length;i++){
    // If there are more ops than terms it's fine; we read as we go
    const nextOp = ops[opIndex] || pendingOp;
    if (nextOp === "NOT"){
      negateNext = !negateNext;
      opIndex++;
    }

    const term = terms[i];
    let ok = evalTerm(term);
    if (negateNext) ok = !ok, negateNext = false;

    if (i === 0){
      result = ok;
    } else {
      const op = pendingOp;
      if (op === "AND") result = result && ok;
      else if (op === "OR") result = result || ok;
    }

    // advance pending op if the next token is AND/OR
    const peek = ops[opIndex];
    if (peek === "AND" || peek === "OR"){
      pendingOp = peek;
      opIndex++;
    } else {
      pendingOp = "AND";
    }
  }

  return result;
}

export function safeJsonParse(s){
  try { return {ok:true, value: JSON.parse(s)}; }
  catch(e){ return {ok:false, error: e}; }
}

export function deepClone(x){ return JSON.parse(JSON.stringify(x)); }
