// ==================================
// SOC Ops Simulator — app.js
// Main application (no build tools)
// ==================================

import { nowISO, uid, debounce, toast, downloadText, readFileAsText, getRoute, setRoute, safeJsonParse } from "./utils.js";
import { ASSETS, PLAYBOOKS, seedAlerts, seedLogs, generateAlert } from "./data_seed.js";
import {
  renderDashboard,
  renderAlerts,
  renderAlertDetail,
  renderCases,
  renderCaseDetail,
  renderLogs,
  renderTools,
  renderPlaybooks,
  renderPlaybookDetail,
  renderSettings
} from "./components.js";

// ---------- State ----------
const STORAGE_KEY = "soc_sim_state_v1";
const PREF_KEY = "soc_sim_prefs_v1";

const defaultState = () => ({
  version: 1,
  createdAt: nowISO(),
  alerts: seedAlerts(16),
  logs: seedLogs(240),
  assets: ASSETS,
  cases: [],
  playbooks: PLAYBOOKS,
  savedQueries: [
    {id: uid("sq"), name:"High + Entra", query:'severity:high AND source:"Entra ID"'},
    {id: uid("sq"), name:"Phish", query:"phishing OR technique:phishing"},
    {id: uid("sq"), name:"New alerts", query:"status:new"},
  ],
  ui: {
    alertQuery: "",
    logQuery: "",
    selectedAlertId: null,
    selectedCaseId: null,
    selectedPlaybookId: null
  }
});

let state = loadState() ?? defaultState();
let prefs = loadPrefs() ?? { generatorOn: true, demoSeedOn: true };

// ---------- DOM ----------
const view = document.getElementById("view");
const toastHost = document.getElementById("toastHost");

const navButtons = [...document.querySelectorAll(".nav-item")];
const qSearch = document.getElementById("qSearch");
const qAsset = document.getElementById("qAsset");
const assetResults = document.getElementById("assetResults");
const savedQueriesHost = document.getElementById("savedQueries");

const btnGen = document.getElementById("btnGen");
const genState = document.getElementById("genState");
const btnExport = document.getElementById("btnExport");
const btnImport = document.getElementById("btnImport");
const fileImport = document.getElementById("fileImport");
const btnCmd = document.getElementById("btnCmd");

const chipHigh = document.getElementById("chipHigh");
const chipMed = document.getElementById("chipMed");
const chipLow = document.getElementById("chipLow");
const chipNew = document.getElementById("chipNew");
const btnSaveQuery = document.getElementById("btnSaveQuery");

// Modals
const backdrop = document.getElementById("backdrop");
const modalCmd = document.getElementById("modalCmd");
const cmdInput = document.getElementById("cmdInput");
const cmdList = document.getElementById("cmdList");
const cmdClose = document.getElementById("cmdClose");
const modalConfirm = document.getElementById("modalConfirm");
const confirmTitle = document.getElementById("confirmTitle");
const confirmBody = document.getElementById("confirmBody");
const confirmOk = document.getElementById("confirmOk");
const confirmCancel = document.getElementById("confirmCancel");
const confirmClose = document.getElementById("confirmClose");

function showToast(x){ toast(toastHost, x); }

// ---------- Render + Routing ----------
function setActiveNav(route){
  navButtons.forEach(b=> b.classList.toggle("active", b.dataset.route === route));
}

function render(){
  const route = getRoute();
  setActiveNav(route);

  // Keep sidebar search in sync with alertQuery
  if (route === "alerts" || route === "dashboard" || route === "cases" || route === "logs" || route === "tools" || route === "playbooks" || route === "settings"){
    if (qSearch.value !== state.ui.alertQuery) qSearch.value = state.ui.alertQuery || "";
  }

  if (route === "dashboard"){
    renderDashboard({
      state, host: view,
      onNav: (r)=> setRoute(r),
      onSelectAlert: (id)=>{
        state.ui.selectedAlertId = id;
        persist();
        setRoute("alerts");
        // open detail immediately
        setTimeout(()=> openAlert(id), 0);
      },
      onNewCaseFromAlert: (id)=> newCaseFromAlert(id),
    });
    return;
  }

  if (route === "alerts"){
    // If we have a selected alert, show detail view
    if (state.ui.selectedAlertId){
      renderAlertDetail({
        state, host: view, alertId: state.ui.selectedAlertId,
        onBack: ()=>{
          state.ui.selectedAlertId = null;
          persist();
          render();
        },
        onUpdateAlert: (id, patch)=>{
          updateAlert(id, patch);
          showToast({title:"Saved", body:"Alert updated.", meta:["Alerts"]});
          render();
        },
        onNewCaseFromAlert: (id)=> newCaseFromAlert(id),
      });
      return;
    }

    renderAlerts({
      state, host: view,
      alertQuery: state.ui.alertQuery,
      onSelectAlert: (id)=> openAlert(id),
      onTriage: (id)=> {
        updateAlert(id, {status:"triage", timeline: addTimeline(id, {type:"status", msg:"Moved to triage."})});
        showToast({title:"Triage", body:"Alert moved to triage.", meta:[id.slice(0,10)]});
        render();
      },
      onAssignToCase: (id)=> newCaseFromAlert(id),
    });
    return;
  }

  if (route === "cases"){
    if (state.ui.selectedCaseId){
      renderCaseDetail({
        state, host: view, caseId: state.ui.selectedCaseId,
        onBack: ()=>{
          state.ui.selectedCaseId = null;
          persist();
          render();
        },
        onUpdateCase: (id, patch)=>{
          updateCase(id, patch);
          showToast({title:"Saved", body:"Case updated.", meta:["Cases"]});
          render();
        },
        onOpenAlert: (alertId)=>{
          state.ui.selectedAlertId = alertId;
          persist();
          setRoute("alerts");
        }
      });
      return;
    }

    renderCases({
      state, host: view,
      onOpenCase: (id)=>{
        state.ui.selectedCaseId = id;
        persist();
        render();
      },
      onNewCase: ()=> newCaseWizard(),
    });
    return;
  }

  if (route === "logs"){
    renderLogs({
      state, host: view,
      logQuery: state.ui.logQuery,
      onSaveQuery: ()=> saveCurrentQuery("logs"),
      onOpenAlertFromLog: (log)=>{
        const al = logToAlert(log);
        state.alerts.unshift(al);
        state.ui.selectedAlertId = al.id;
        persist();
        showToast({title:"Pivot created", body:"Created alert from log pivot.", meta:[log.source, log.severity]});
        setRoute("alerts");
      }
    });
    return;
  }

  if (route === "tools"){
    renderTools({
      state, host: view,
      onToast: (x)=> showToast(x)
    });
    return;
  }

  if (route === "playbooks"){
    if (state.ui.selectedPlaybookId){
      renderPlaybookDetail({
        state, host: view, playbookId: state.ui.selectedPlaybookId,
        onBack: ()=>{
          state.ui.selectedPlaybookId = null;
          persist();
          render();
        }
      });
      return;
    }
    renderPlaybooks({
      state, host: view,
      onOpenPlaybook: (id)=>{
        state.ui.selectedPlaybookId = id;
        persist();
        render();
      }
    });
    return;
  }

  if (route === "settings"){
    renderSettings({
      state, host: view,
      onReset: ()=> confirm("Reset simulator state?", "This clears alerts, cases, and saved queries.", ()=>{
        state = defaultState();
        if (!prefs.demoSeedOn){
          // If demo is off, start clean
          state.alerts = [];
          state.logs = [];
          state.savedQueries = [];
        }
        persist(true);
        showToast({title:"Reset complete", body:"Simulator state cleared.", meta:["Settings"]});
        setRoute("dashboard");
      }),
      onToggleDemoData: ()=>{
        prefs.demoSeedOn = !prefs.demoSeedOn;
        savePrefs();
        showToast({title:"Demo seed toggled", body:`Demo data seed is now ${prefs.demoSeedOn ? "ON" : "OFF"}.`, meta:["Settings"]});
      }
    });
    return;
  }

  // fallback
  setRoute("dashboard");
}

window.addEventListener("hashchange", render);
window.addEventListener("popstate", render);

// ---------- Sidebar wiring ----------
navButtons.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    state.ui.selectedAlertId = null;
    state.ui.selectedCaseId = null;
    state.ui.selectedPlaybookId = null;
    persist();
    setRoute(btn.dataset.route);
  });
});

qSearch.addEventListener("input", debounce(()=>{
  state.ui.alertQuery = qSearch.value || "";
  persist();
  if (getRoute() !== "alerts") return;
  render();
}, 140));

// Focus shortcut: "/" focuses alert search
window.addEventListener("keydown", (e)=>{
  const isCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
  if (isCmdK){
    e.preventDefault();
    openCmd();
  }
  if (e.key === "Escape"){
    closeCmd();
    closeConfirm();
  }
  if (!e.ctrlKey && !e.metaKey && e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA"){
    e.preventDefault();
    qSearch.focus();
  }
  if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "g"){
    // Toggle generator
    toggleGenerator();
  }
});

chipHigh.addEventListener("click", ()=> setAlertQuery("severity:high"));
chipMed.addEventListener("click", ()=> setAlertQuery("severity:medium"));
chipLow.addEventListener("click", ()=> setAlertQuery("severity:low"));
chipNew.addEventListener("click", ()=> setAlertQuery("status:new"));

function setAlertQuery(q){
  state.ui.alertQuery = q;
  qSearch.value = q;
  persist();
  setRoute("alerts");
}

// Asset lookup (local)
qAsset.addEventListener("input", debounce(()=>{
  const q = (qAsset.value || "").trim().toLowerCase();
  const hits = !q ? [] : state.assets.filter(a=> `${a.host} ${a.owner} ${a.dept}`.toLowerCase().includes(q)).slice(0,5);
  assetResults.innerHTML = hits.map(a=>`
    <div class="mini-item">
      <div class="mini-left">
        <div class="mini-title">${a.host} <span class="badge">${a.os}</span></div>
        <div class="mini-sub">${a.owner} • ${a.dept} • criticality=${a.criticality}</div>
      </div>
      <div class="mini-act">
        <button class="icon-btn" data-copy="${a.host}" title="Copy hostname">⧉</button>
      </div>
    </div>
  `).join("") || `<div class="tiny muted">No matches.</div>`;

  assetResults.querySelectorAll("[data-copy]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(btn.getAttribute("data-copy"));
        showToast({title:"Copied", body:"Hostname copied.", meta:["Assets"]});
      }catch(e){
        showToast({title:"Clipboard blocked", body:"Browser blocked clipboard access.", meta:["Tip: use HTTPS"], tone:"warn"});
      }
    });
  });
}, 140));

function renderSavedQueries(){
  savedQueriesHost.innerHTML = (state.savedQueries || []).map(sq=>`
    <div class="mini-item" data-id="${sq.id}">
      <div class="mini-left">
        <div class="mini-title">${sq.name}</div>
        <div class="mini-sub"><span class="kbd">${sq.query}</span></div>
      </div>
      <div class="mini-act">
        <button class="icon-btn btnRun" title="Run">↗</button>
        <button class="icon-btn btnDel" title="Delete">🗑</button>
      </div>
    </div>
  `).join("") || `<div class="tiny muted">No saved queries.</div>`;

  savedQueriesHost.querySelectorAll(".mini-item").forEach(row=>{
    const id = row.getAttribute("data-id");
    const sq = state.savedQueries.find(x=>x.id===id);
    row.querySelector(".btnRun")?.addEventListener("click", ()=>{
      state.ui.alertQuery = sq.query;
      qSearch.value = sq.query;
      persist();
      setRoute("alerts");
    });
    row.querySelector(".btnDel")?.addEventListener("click", ()=>{
      confirm("Delete saved query?", `"${sq.name}" will be removed.`, ()=>{
        state.savedQueries = state.savedQueries.filter(x=>x.id!==id);
        persist();
        renderSavedQueries();
        showToast({title:"Deleted", body:"Saved query removed.", meta:["Queries"]});
      });
    });
  });
}

btnSaveQuery.addEventListener("click", ()=> saveCurrentQuery("alerts"));

function saveCurrentQuery(from){
  const q = from === "logs" ? (state.ui.logQuery || "") : (state.ui.alertQuery || "");
  if (!q.trim()){
    showToast({title:"Nothing to save", body:"Add a query first.", meta:["Saved queries"], tone:"warn"});
    return;
  }
  const name = prompt("Saved query name:", "My query");
  if (!name) return;
  state.savedQueries.unshift({id: uid("sq"), name, query: q.trim()});
  persist();
  renderSavedQueries();
  showToast({title:"Saved", body:"Query saved.", meta:["Saved queries"]});
}

// ---------- Generator + persistence ----------
function updateGenUI(){
  genState.textContent = prefs.generatorOn ? "ON" : "OFF";
  btnGen.querySelector(".dot").style.background = prefs.generatorOn ? "var(--accent)" : "rgba(245,248,246,0.35)";
  btnGen.querySelector(".dot").style.boxShadow = prefs.generatorOn
    ? "0 0 0 4px rgba(11,225,122,0.12), 0 0 22px rgba(11,225,122,0.35)"
    : "0 0 0 4px rgba(245,248,246,0.08), 0 0 14px rgba(0,0,0,0.35)";
}

btnGen.addEventListener("click", toggleGenerator);
function toggleGenerator(){
  prefs.generatorOn = !prefs.generatorOn;
  savePrefs();
  updateGenUI();
  showToast({title:"Generator toggled", body:`Generator is now ${prefs.generatorOn ? "ON" : "OFF"}.`, meta:["Topbar"]});
}

let genTimer = null;
function startGenerator(){
  stopGenerator();
  genTimer = setInterval(()=>{
    if (!prefs.generatorOn) return;
    // Occasionally spike high severity
    const spike = Math.random() < 0.14;
    const a = generateAlert({forceSeverity: spike ? "high" : null});
    state.alerts.unshift(a);

    // Add correlated log entry
    state.logs.unshift({
      id: uid("log"),
      ts: nowISO(),
      source: a.source,
      severity: a.severity,
      action: `Alert generated: ${a.title}`,
      user: a.user,
      host: a.host,
      tactic: a.tactic,
      technique: a.technique,
      details: a.summary,
      tags: a.tags
    });

    // Trim to keep fast
    state.alerts = state.alerts.slice(0, 180);
    state.logs = state.logs.slice(0, 500);

    persist();

    // Only toast if user isn't typing
    if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA"){
      showToast({
        title: "New alert",
        body: a.title,
        meta: [a.severity.toUpperCase(), a.source],
        tone: a.severity === "high" ? "danger" : a.severity === "medium" ? "warn" : "ok"
      });
    }

    // If on alerts list view, rerender lightly
    const route = getRoute();
    if (route === "alerts" && !state.ui.selectedAlertId) render();
    if (route === "dashboard") render();
  }, 3600);
}

function stopGenerator(){
  if (genTimer) clearInterval(genTimer);
  genTimer = null;
}

function persist(force=false){
  // Avoid writing too often when not needed
  if (!force){
    // no-op placeholder for future throttling; already small
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function savePrefs(){ localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }
function loadPrefs(){
  const raw = localStorage.getItem(PREF_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ---------- Alert + Case actions ----------
function openAlert(id){
  state.ui.selectedAlertId = id;
  persist();
  render();
}

function addTimeline(alertId, evt){
  const a = state.alerts.find(x=>x.id===alertId);
  const tl = a?.timeline || [];
  return [...tl, {ts: nowISO(), ...evt}];
}

function updateAlert(id, patch){
  state.alerts = state.alerts.map(a=>{
    if (a.id !== id) return a;
    const out = {...a, ...patch};
    // If status changes, add a timeline entry
    if (patch.status && patch.status !== a.status){
      out.timeline = [...(out.timeline||[]), {ts: nowISO(), type:"status", msg:`Status changed: ${a.status} → ${patch.status}`}];
    }
    return out;
  });
  persist();
}

function newCaseFromAlert(alertId){
  const a = state.alerts.find(x=>x.id===alertId);
  if (!a){
    showToast({title:"Alert not found", body:"Cannot create case.", meta:["Cases"], tone:"warn"});
    return;
  }
  const title = `Case: ${a.title}`;
  const summary = `Investigate ${a.severity} alert from ${a.source} for user=${a.user} host=${a.host}.`;
  const c = {
    id: uid("case"),
    createdAt: nowISO(),
    title,
    summary,
    owner: "analyst",
    status: "new",
    priority: a.severity === "high" ? "high" : a.severity === "medium" ? "medium" : "low",
    alertIds: [alertId],
    notes: [],
    timeline: [
      {ts: nowISO(), type:"created", msg:"Case created from alert."}
    ]
  };
  state.cases.unshift(c);

  // Move alert to triage
  updateAlert(alertId, {status:"triage"});

  state.ui.selectedCaseId = c.id;
  state.ui.selectedAlertId = null;
  persist();
  showToast({title:"Case created", body: c.title, meta:[c.priority.toUpperCase(), "linked 1 alert"]});
  setRoute("cases");
}

function newCaseWizard(){
  const title = prompt("Case title:", "Case: Investigation");
  if (!title) return;
  const summary = prompt("Case summary:", "What happened, what's the scope, what's next?") || "";
  const c = {
    id: uid("case"),
    createdAt: nowISO(),
    title,
    summary,
    owner: "analyst",
    status: "new",
    priority: "medium",
    alertIds: [],
    notes: [],
    timeline: [{ts: nowISO(), type:"created", msg:"Manual case created."}]
  };
  state.cases.unshift(c);
  state.ui.selectedCaseId = c.id;
  persist();
  showToast({title:"Case created", body:"Manual case opened.", meta:["Cases"]});
  render();
}

function updateCase(id, patch){
  state.cases = state.cases.map(c=>{
    if (c.id !== id) return c;
    const out = {...c, ...patch};
    if (patch.status && patch.status !== c.status){
      out.timeline = [...(out.timeline||[]), {ts: nowISO(), type:"status", msg:`Status changed: ${c.status} → ${patch.status}`}];
    }
    return out;
  });
  persist();
}

function logToAlert(log){
  // Convert a log event into a synthetic alert to demo correlation skills.
  const title = `Log Pivot: ${log.action}`;
  return {
    id: uid("al"),
    createdAt: nowISO(),
    source: log.source,
    severity: log.severity,
    status: "new",
    title,
    summary: `pivot_from_log id=${log.id} ${log.details}`,
    user: log.user,
    host: log.host,
    tactic: log.tactic,
    technique: log.technique,
    tags: [log.tactic, log.technique, log.source, log.severity, "pivot"],
    evidence: {
      ip: "0.0.0.0",
      geo: "N/A",
      asn: "N/A",
      hash: "N/A",
      url: "N/A",
      mailFrom: "N/A",
    },
    notes: [],
    timeline: [
      {ts: nowISO(), type:"created", msg:"Alert created from log pivot (simulation)."},
    ]
  };
}

// ---------- Export / Import ----------
btnExport.addEventListener("click", ()=>{
  const payload = JSON.stringify({state, prefs}, null, 2);
  downloadText(`soc_sim_snapshot_${new Date().toISOString().slice(0,10)}.json`, payload);
  showToast({title:"Exported", body:"Snapshot downloaded as JSON.", meta:["Topbar"]});
});

btnImport.addEventListener("click", ()=> fileImport.click());
fileImport.addEventListener("change", async ()=>{
  const file = fileImport.files?.[0];
  if (!file) return;
  const text = await readFileAsText(file);
  const parsed = safeJsonParse(text);
  if (!parsed.ok){
    showToast({title:"Import failed", body:"Invalid JSON.", meta:["Topbar"], tone:"danger"});
    return;
  }
  const incoming = parsed.value;
  if (!incoming?.state){
    showToast({title:"Import failed", body:"Missing state property.", meta:["Topbar"], tone:"danger"});
    return;
  }
  state = incoming.state;
  prefs = incoming.prefs ?? prefs;
  savePrefs();
  persist(true);
  showToast({title:"Imported", body:"Snapshot restored.", meta:["Topbar"]});
  fileImport.value = "";
  renderSavedQueries();
  updateGenUI();
  render();
});

// ---------- Command palette ----------
btnCmd.addEventListener("click", openCmd);
cmdClose.addEventListener("click", closeCmd);
backdrop.addEventListener("click", ()=>{ closeCmd(); closeConfirm(); });

const commands = [
  {title:"Go: Dashboard", desc:"Open shift snapshot overview", run: ()=> setRoute("dashboard"), kbd:"D"},
  {title:"Go: Alerts", desc:"View alert queue", run: ()=> { state.ui.selectedAlertId=null; persist(); setRoute("alerts"); }, kbd:"A"},
  {title:"Go: Cases", desc:"Open case management", run: ()=> { state.ui.selectedCaseId=null; persist(); setRoute("cases"); }, kbd:"C"},
  {title:"Go: Log Explorer", desc:"Search events and pivot", run: ()=> setRoute("logs"), kbd:"L"},
  {title:"Go: Tools", desc:"Defensive analysis tools", run: ()=> setRoute("tools"), kbd:"T"},
  {title:"Go: Playbooks", desc:"Blue-team runbooks", run: ()=> setRoute("playbooks"), kbd:"P"},
  {title:"Export Snapshot", desc:"Download state as JSON", run: ()=> btnExport.click(), kbd:"E"},
  {title:"Import Snapshot", desc:"Restore state from JSON", run: ()=> btnImport.click(), kbd:"I"},
  {title:"Toggle Generator", desc:"Pause/resume alert generator", run: ()=> toggleGenerator(), kbd:"G"},
  {title:"New Case", desc:"Create a manual case", run: ()=> { setRoute("cases"); setTimeout(()=> newCaseWizard(), 0); }, kbd:"N"},
  {title:"Clear Alert Search", desc:"Reset the alert query", run: ()=> setAlertQuery(""), kbd:"X"},
];

function openCmd(){
  backdrop.classList.remove("hidden");
  modalCmd.classList.remove("hidden");
  cmdInput.value = "";
  renderCmdList(commands);
  setTimeout(()=> cmdInput.focus(), 0);
}
function closeCmd(){
  modalCmd.classList.add("hidden");
  if (modalConfirm.classList.contains("hidden")) backdrop.classList.add("hidden");
}

cmdInput.addEventListener("input", debounce(()=>{
  const q = cmdInput.value.trim().toLowerCase();
  const filtered = !q ? commands : commands.filter(c=> (c.title + " " + c.desc).toLowerCase().includes(q));
  renderCmdList(filtered);
}, 80));

cmdInput.addEventListener("keydown", (e)=>{
  const items = [...cmdList.querySelectorAll(".cmd-item")];
  const active = cmdList.querySelector(".cmd-item.active");
  const idx = Math.max(0, items.findIndex(x=>x===active));
  if (e.key === "ArrowDown"){
    e.preventDefault();
    items.forEach(x=> x.classList.remove("active"));
    (items[idx+1] || items[0])?.classList.add("active");
  }
  if (e.key === "ArrowUp"){
    e.preventDefault();
    items.forEach(x=> x.classList.remove("active"));
    (items[idx-1] || items[items.length-1])?.classList.add("active");
  }
  if (e.key === "Enter"){
    e.preventDefault();
    (active || items[0])?.click();
  }
});

function renderCmdList(list){
  cmdList.innerHTML = list.map((c,i)=>`
    <div class="cmd-item ${i===0 ? "active" : ""}">
      <div class="cmd-left">
        <div class="cmd-title">${c.title}</div>
        <div class="cmd-desc">${c.desc}</div>
      </div>
      <div class="kbd">${c.kbd || ""}</div>
    </div>
  `).join("") || `<div class="tiny muted">No commands.</div>`;

  [...cmdList.querySelectorAll(".cmd-item")].forEach((el, idx)=>{
    el.addEventListener("click", ()=>{
      const c = list[idx];
      closeCmd();
      c.run();
      showToast({title:"Command executed", body:c.title, meta:["Palette"]});
    });
  });
}

// ---------- Confirm modal ----------
let confirmCb = null;
function confirm(title, body, cb){
  confirmTitle.textContent = title;
  confirmBody.textContent = body;
  confirmCb = cb;

  backdrop.classList.remove("hidden");
  modalConfirm.classList.remove("hidden");
}
function closeConfirm(){
  modalConfirm.classList.add("hidden");
  if (modalCmd.classList.contains("hidden")) backdrop.classList.add("hidden");
  confirmCb = null;
}
confirmCancel.addEventListener("click", closeConfirm);
confirmClose.addEventListener("click", closeConfirm);
confirmOk.addEventListener("click", ()=>{
  const cb = confirmCb;
  closeConfirm();
  cb?.();
});

// ---------- Initial boot ----------
function boot(){
  // If demo seed is OFF and this is first load, wipe seeds for a clean slate
  if (!prefs.demoSeedOn){
    state.alerts = state.alerts || [];
    state.logs = state.logs || [];
  }

  renderSavedQueries();
  updateGenUI();
  startGenerator();
  render();

  showToast({
    title:"Simulator ready",
    body:"Dashboard loaded. Use Ctrl/⌘+K for commands.",
    meta:["Local-only", prefs.generatorOn ? "Generator ON" : "Generator OFF"]
  });
}

boot();
