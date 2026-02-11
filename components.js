// ===================================
// SOC Ops Simulator — components.js
// DOM render helpers for each route
// ===================================

import { escapeHtml, fmtTime, humanAge, matchQuery, copyToClipboard, toast } from "./utils.js";

export function renderDashboard({state, host, onNav, onSelectAlert, onNewCaseFromAlert}){
  const { alerts, cases, logs } = state;

  const openAlerts = alerts.filter(a=> a.status !== "closed");
  const newAlerts = alerts.filter(a=> a.status === "new");
  const hiAlerts = alerts.filter(a=> a.severity === "high" && a.status !== "closed");
  const activeCases = cases.filter(c=> c.status !== "closed");

  const kpis = [
    {label:"Open Alerts", value: openAlerts.length, tone: openAlerts.length > 18 ? "warn" : "ok"},
    {label:"New", value: newAlerts.length, tone: newAlerts.length > 10 ? "warn" : "ok"},
    {label:"High", value: hiAlerts.length, tone: hiAlerts.length > 6 ? "danger" : "warn"},
    {label:"Active Cases", value: activeCases.length, tone: activeCases.length > 4 ? "warn" : "ok"},
  ];

  const recentAlerts = [...alerts].sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)).slice(0,7);
  const recentLogs = [...logs].slice(0,9);

  host.innerHTML = `
    <div class="grid3">
      <div class="card">
        <div class="card-title">
          <div class="h2">Shift Snapshot</div>
          <span class="badge ok">Simulated</span>
        </div>
        <div class="grid2">
          ${kpis.map(k=>`
            <div class="kpi">
              <div class="label">${escapeHtml(k.label)}</div>
              <div class="value">${escapeHtml(String(k.value))}</div>
              <div class="spark"><i></i></div>
              <span class="badge ${k.tone === "danger" ? "danger" : k.tone === "warn" ? "warn" : "ok"}">
                ${k.tone === "danger" ? "High risk" : k.tone === "warn" ? "Watch" : "Stable"}
              </span>
            </div>
          `).join("")}
        </div>
        <div class="divider"></div>
        <div class="row">
          <button class="btn btn-primary" id="goAlerts">Open Alerts</button>
          <button class="btn btn-ghost" id="goLogs">Log Explorer</button>
          <button class="btn btn-ghost" id="goCases">Cases</button>
        </div>
        <div class="tiny muted" style="margin-top:10px;">
          Everything here is <strong>local</strong> in your browser. No network calls.
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <div class="h2">Newest Alerts</div>
          <span class="badge">${escapeHtml(String(recentAlerts.length))} shown</span>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Age</th><th>Severity</th><th>Title</th><th>Source</th>
            </tr>
          </thead>
          <tbody>
            ${recentAlerts.map(a=>`
              <tr data-id="${a.id}" class="rowAlert">
                <td>${escapeHtml(humanAge(a.createdAt))}</td>
                <td>${pill(a.severity)}</td>
                <td>${escapeHtml(a.title)}</td>
                <td>${escapeHtml(a.source)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="tiny muted" style="margin-top:10px;">Click an alert to open detail + start a case.</div>
      </div>

      <div class="card">
        <div class="card-title">
          <div class="h2">Recent Events</div>
          <span class="badge">Last ${escapeHtml(String(recentLogs.length))}</span>
        </div>
        <div class="codebox">
          <pre>${recentLogs.map(l=>`[${fmtTime(l.ts)}] ${l.source} ${l.severity.toUpperCase()} user=${l.user} host=${l.host} • ${l.action}`).join("\n")}</pre>
        </div>
        <div class="divider"></div>
        <div class="row">
          <button class="btn btn-ghost" id="copyLogs">Copy</button>
          <button class="btn btn-ghost" id="goPlaybooks">Playbooks</button>
        </div>
      </div>
    </div>
  `;

  host.querySelector("#goAlerts")?.addEventListener("click", ()=> onNav("alerts"));
  host.querySelector("#goLogs")?.addEventListener("click", ()=> onNav("logs"));
  host.querySelector("#goCases")?.addEventListener("click", ()=> onNav("cases"));
  host.querySelector("#goPlaybooks")?.addEventListener("click", ()=> onNav("playbooks"));

  host.querySelectorAll(".rowAlert").forEach(row=>{
    row.addEventListener("click", ()=>{
      const id = row.getAttribute("data-id");
      onSelectAlert(id);
    });
  });

  host.querySelector("#copyLogs")?.addEventListener("click", async ()=>{
    try{
      await copyToClipboard(recentLogs.map(l=>`[${fmtTime(l.ts)}] ${l.source} ${l.severity.toUpperCase()} user=${l.user} host=${l.host} • ${l.action}`).join("\n"));
      toast(document.getElementById("toastHost"), {title:"Copied", body:"Recent events copied to clipboard.", meta:["Dashboard"]});
    }catch(e){
      toast(document.getElementById("toastHost"), {title:"Clipboard blocked", body:"Your browser blocked clipboard access.", meta:["Tip: use HTTPS"], tone:"warn"});
    }
  });
}

export function renderAlerts({state, host, alertQuery, onSelectAlert, onTriage, onAssignToCase}){
  const q = (alertQuery || "").trim();
  const filtered = state.alerts
    .filter(a=> matchQuery(a, q))
    .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));

  const counts = {
    total: filtered.length,
    new: filtered.filter(a=>a.status==="new").length,
    triage: filtered.filter(a=>a.status==="triage").length,
    hi: filtered.filter(a=>a.severity==="high").length,
  };

  host.innerHTML = `
    <div class="card">
      <div class="card-title">
        <div class="h2">Alerts</div>
        <span class="badge">${escapeHtml(String(counts.total))} results</span>
      </div>

      <div class="row" style="margin-bottom:10px;">
        <span class="pill new">New: ${escapeHtml(String(counts.new))}</span>
        <span class="pill">Triage: ${escapeHtml(String(counts.triage))}</span>
        <span class="pill hi">High: ${escapeHtml(String(counts.hi))}</span>
        ${q ? `<span class="badge">Query: <span class="kbd">${escapeHtml(q)}</span></span>` : `<span class="badge">No query</span>`}
      </div>

      <table class="table" id="alertsTable">
        <thead>
          <tr>
            <th>Age</th><th>Status</th><th>Severity</th><th>Title</th><th>User</th><th>Host</th><th>Source</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(a=>`
            <tr data-id="${a.id}">
              <td>${escapeHtml(humanAge(a.createdAt))}</td>
              <td>${pill(a.status === "new" ? "new" : a.status)}</td>
              <td>${pill(a.severity)}</td>
              <td><strong>${escapeHtml(a.title)}</strong><div class="tiny muted">${escapeHtml(a.tactic)} • ${escapeHtml(a.technique)}</div></td>
              <td>${escapeHtml(a.user)}</td>
              <td>${escapeHtml(a.host)}</td>
              <td>${escapeHtml(a.source)}</td>
              <td>
                <div class="mini-act">
                  <button class="icon-btn btnOpen" title="Open">↗</button>
                  <button class="icon-btn btnTriage" title="Move to Triage">✓</button>
                  <button class="icon-btn btnCase" title="Create case from alert">＋</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      ${filtered.length === 0 ? `<div class="tiny muted" style="margin-top:10px;">No alerts match your query.</div>` : ``}
    </div>
  `;

  const table = host.querySelector("#alertsTable");
  table?.addEventListener("click", (e)=>{
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const id = row.getAttribute("data-id");
    if (e.target.classList.contains("btnOpen")) onSelectAlert(id);
    else if (e.target.classList.contains("btnTriage")) onTriage(id);
    else if (e.target.classList.contains("btnCase")) onAssignToCase(id);
    else onSelectAlert(id);
  });
}

export function renderAlertDetail({state, host, alertId, onBack, onUpdateAlert, onNewCaseFromAlert}){
  const a = state.alerts.find(x=>x.id===alertId);
  if (!a){
    host.innerHTML = `<div class="card"><div class="h2">Alert not found</div><div class="tiny muted">It may have been deleted.</div></div>`;
    return;
  }

  const ev = a.evidence || {};
  const notes = a.notes || [];
  const timeline = a.timeline || [];

  host.innerHTML = `
    <div class="card">
      <div class="card-title">
        <div>
          <div class="h2">${escapeHtml(a.title)}</div>
          <div class="tiny muted">${escapeHtml(a.tactic)} • ${escapeHtml(a.technique)} • <span class="kbd">${escapeHtml(a.id)}</span></div>
        </div>
        <div class="row">
          ${pill(a.status)}
          ${pill(a.severity)}
          <span class="badge">${escapeHtml(fmtTime(a.createdAt))}</span>
        </div>
      </div>

      <div class="grid2">
        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Context</div><span class="badge">${escapeHtml(a.source)}</span></div>
          <div class="tiny muted">User</div>
          <div><strong>${escapeHtml(a.user)}</strong></div>
          <div class="tiny muted" style="margin-top:8px;">Host</div>
          <div><strong>${escapeHtml(a.host)}</strong></div>
          <div class="tiny muted" style="margin-top:8px;">Summary</div>
          <div class="codebox" style="margin-top:6px;"><pre>${escapeHtml(a.summary)}</pre></div>

          <div class="divider"></div>

          <div class="row">
            <button class="btn btn-ghost" id="btnBack">← Back</button>
            <button class="btn btn-primary" id="btnCase">Create Case</button>
          </div>
        </div>

        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Evidence (Sim)</div><span class="badge warn">Do not use real PII</span></div>
          <table class="table">
            <tbody>
              ${rowKV("IP", ev.ip)}
              ${rowKV("Geo", ev.geo)}
              ${rowKV("ASN", ev.asn)}
              ${rowKV("Hash", ev.hash)}
              ${rowKV("URL", ev.url)}
              ${rowKV("Mail From", ev.mailFrom)}
            </tbody>
          </table>
          <div class="row" style="margin-top:10px;">
            <button class="btn btn-ghost" id="copyEvidence">Copy</button>
            <button class="btn btn-ghost" id="toTools">Open Tools</button>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="grid2">
        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Disposition</div><span class="badge">Update workflow</span></div>
          <div class="row">
            <label class="label" style="width:100%;">Status</label>
            <select class="input" id="statusSel">
              ${["new","triage","in-progress","contained","closed"].map(s=>`<option value="${s}" ${s===a.status?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>
          <div class="row" style="margin-top:10px;">
            <label class="label" style="width:100%;">Severity</label>
            <select class="input" id="sevSel">
              ${["low","medium","high"].map(s=>`<option value="${s}" ${s===a.severity?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>
          <div class="row" style="margin-top:10px;">
            <button class="btn btn-primary" id="btnSave">Save</button>
            <button class="btn btn-ghost" id="btnAddNote">Add Note</button>
          </div>
          <div class="tiny muted" style="margin-top:10px;">This builds portfolio proof of triage discipline (status + notes + timeline).</div>
        </div>

        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Timeline</div><span class="badge">${escapeHtml(String(timeline.length))} events</span></div>
          <div class="codebox">
            <pre>${timeline.map(t=>`[${fmtTime(t.ts)}] ${t.type.toUpperCase()} • ${t.msg}`).join("\n")}</pre>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="card" style="padding:12px;">
        <div class="card-title"><div class="h2">Notes</div><span class="badge">${escapeHtml(String(notes.length))}</span></div>
        ${notes.length ? `<div class="codebox"><pre>${escapeHtml(notes.map(n=>`- ${fmtTime(n.ts)} • ${n.body}`).join("\n"))}</pre></div>` : `<div class="tiny muted">No notes yet.</div>`}
      </div>
    </div>
  `;

  host.querySelector("#btnBack")?.addEventListener("click", onBack);
  host.querySelector("#btnCase")?.addEventListener("click", ()=> onNewCaseFromAlert(alertId));

  host.querySelector("#toTools")?.addEventListener("click", ()=>{
    window.location.hash="#tools";
    window.dispatchEvent(new Event("hashchange"));
  });

  host.querySelector("#btnSave")?.addEventListener("click", ()=>{
    const status = host.querySelector("#statusSel").value;
    const severity = host.querySelector("#sevSel").value;
    onUpdateAlert(alertId, {status, severity});
  });

  host.querySelector("#btnAddNote")?.addEventListener("click", ()=>{
    const body = prompt("Add a note (simulation):");
    if (!body) return;
    onUpdateAlert(alertId, {
      notes: [...notes, {ts: new Date().toISOString(), body}],
      timeline: [...timeline, {ts: new Date().toISOString(), type:"note", msg:"Analyst note added."}]
    });
  });

  host.querySelector("#copyEvidence")?.addEventListener("click", async ()=>{
    const text = [
      `Alert: ${a.title}`,
      `User: ${a.user}  Host: ${a.host}`,
      `Source: ${a.source}  Severity: ${a.severity}  Status: ${a.status}`,
      `Evidence:`,
      `  IP: ${ev.ip}`,
      `  Geo: ${ev.geo}`,
      `  ASN: ${ev.asn}`,
      `  Hash: ${ev.hash}`,
      `  URL: ${ev.url}`,
      `  MailFrom: ${ev.mailFrom}`,
    ].join("\n");
    try{
      await copyToClipboard(text);
      toast(document.getElementById("toastHost"), {title:"Copied", body:"Evidence summary copied.", meta:["Alert detail"]});
    }catch(e){
      toast(document.getElementById("toastHost"), {title:"Clipboard blocked", body:"Browser blocked clipboard access.", meta:["Tip: use HTTPS"], tone:"warn"});
    }
  });
}

export function renderCases({state, host, onOpenCase, onNewCase}){
  const list = [...state.cases].sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));

  host.innerHTML = `
    <div class="card">
      <div class="card-title">
        <div class="h2">Cases</div>
        <div class="row">
          <span class="badge">${escapeHtml(String(list.length))} total</span>
          <button class="btn btn-primary" id="btnNewCase">+ New Case</button>
        </div>
      </div>

      <table class="table" id="casesTable">
        <thead>
          <tr>
            <th>Age</th><th>Status</th><th>Priority</th><th>Case</th><th>Owner</th><th>Linked Alerts</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${list.map(c=>`
            <tr data-id="${c.id}">
              <td>${escapeHtml(humanAge(c.createdAt))}</td>
              <td>${pill(c.status)}</td>
              <td>${pill(c.priority)}</td>
              <td><strong>${escapeHtml(c.title)}</strong><div class="tiny muted">${escapeHtml(c.summary||"")}</div></td>
              <td>${escapeHtml(c.owner || "analyst")}</td>
              <td>${escapeHtml(String((c.alertIds||[]).length))}</td>
              <td><button class="icon-btn btnOpen">↗</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      ${list.length === 0 ? `<div class="tiny muted" style="margin-top:10px;">No cases yet. Create your first one to show workflow maturity.</div>` : ``}
    </div>
  `;

  host.querySelector("#btnNewCase")?.addEventListener("click", onNewCase);

  host.querySelector("#casesTable")?.addEventListener("click", (e)=>{
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const id = row.getAttribute("data-id");
    onOpenCase(id);
  });
}

export function renderCaseDetail({state, host, caseId, onBack, onUpdateCase, onOpenAlert}){
  const c = state.cases.find(x=>x.id===caseId);
  if (!c){
    host.innerHTML = `<div class="card"><div class="h2">Case not found</div><div class="tiny muted">It may have been deleted.</div></div>`;
    return;
  }
  const linked = (c.alertIds||[]).map(id=> state.alerts.find(a=>a.id===id)).filter(Boolean);
  const notes = c.notes || [];
  const tl = c.timeline || [];

  host.innerHTML = `
    <div class="card">
      <div class="card-title">
        <div>
          <div class="h2">${escapeHtml(c.title)}</div>
          <div class="tiny muted"><span class="kbd">${escapeHtml(c.id)}</span> • created ${escapeHtml(fmtTime(c.createdAt))}</div>
        </div>
        <div class="row">
          ${pill(c.status)}
          ${pill(c.priority)}
          <button class="btn btn-ghost" id="btnBack">← Back</button>
        </div>
      </div>

      <div class="grid2">
        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Case Controls</div><span class="badge">workflow</span></div>

          <div class="row">
            <label class="label" style="width:100%;">Status</label>
            <select class="input" id="caseStatus">
              ${["new","triage","in-progress","contained","closed"].map(s=>`<option value="${s}" ${s===c.status?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>

          <div class="row" style="margin-top:10px;">
            <label class="label" style="width:100%;">Priority</label>
            <select class="input" id="casePri">
              ${["low","medium","high"].map(s=>`<option value="${s}" ${s===c.priority?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>

          <div class="row" style="margin-top:10px;">
            <button class="btn btn-primary" id="btnSave">Save</button>
            <button class="btn btn-ghost" id="btnNote">Add Note</button>
            <button class="btn btn-ghost" id="btnAddEvt">Add Timeline Event</button>
          </div>

          <div class="divider"></div>
          <div class="tiny muted">Summary</div>
          <div class="codebox" style="margin-top:6px;"><pre>${escapeHtml(c.summary || "(no summary)")}</pre></div>
        </div>

        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Linked Alerts</div><span class="badge">${escapeHtml(String(linked.length))}</span></div>
          ${linked.length ? `
            <table class="table" id="linkedTable">
              <thead><tr><th>Age</th><th>Sev</th><th>Title</th><th>User</th><th>Host</th></tr></thead>
              <tbody>
                ${linked.map(a=>`
                  <tr data-id="${a.id}">
                    <td>${escapeHtml(humanAge(a.createdAt))}</td>
                    <td>${pill(a.severity)}</td>
                    <td><strong>${escapeHtml(a.title)}</strong><div class="tiny muted">${escapeHtml(a.tactic)} • ${escapeHtml(a.technique)}</div></td>
                    <td>${escapeHtml(a.user)}</td>
                    <td>${escapeHtml(a.host)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          ` : `<div class="tiny muted">No linked alerts. Attach from Alerts → “+ case”.</div>`}
        </div>
      </div>

      <div class="divider"></div>

      <div class="grid2">
        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Timeline</div><span class="badge">${escapeHtml(String(tl.length))}</span></div>
          ${tl.length ? `<div class="codebox"><pre>${escapeHtml(tl.map(x=>`[${fmtTime(x.ts)}] ${x.type.toUpperCase()} • ${x.msg}`).join("\n"))}</pre></div>` : `<div class="tiny muted">No timeline events yet.</div>`}
        </div>

        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Notes</div><span class="badge">${escapeHtml(String(notes.length))}</span></div>
          ${notes.length ? `<div class="codebox"><pre>${escapeHtml(notes.map(n=>`- ${fmtTime(n.ts)} • ${n.body}`).join("\n"))}</pre></div>` : `<div class="tiny muted">No notes yet.</div>`}
        </div>
      </div>
    </div>
  `;

  host.querySelector("#btnBack")?.addEventListener("click", onBack);
  host.querySelector("#btnSave")?.addEventListener("click", ()=>{
    const status = host.querySelector("#caseStatus").value;
    const priority = host.querySelector("#casePri").value;
    onUpdateCase(caseId, {status, priority});
  });
  host.querySelector("#btnNote")?.addEventListener("click", ()=>{
    const body = prompt("Add case note (simulation):");
    if (!body) return;
    onUpdateCase(caseId, {
      notes: [...notes, {ts:new Date().toISOString(), body}],
      timeline: [...tl, {ts:new Date().toISOString(), type:"note", msg:"Case note added."}]
    });
  });
  host.querySelector("#btnAddEvt")?.addEventListener("click", ()=>{
    const msg = prompt("Timeline event message:");
    if (!msg) return;
    onUpdateCase(caseId, {
      timeline: [...tl, {ts:new Date().toISOString(), type:"event", msg}]
    });
  });

  host.querySelector("#linkedTable")?.addEventListener("click", (e)=>{
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    onOpenAlert(row.getAttribute("data-id"));
  });
}

export function renderLogs({state, host, logQuery, onSaveQuery, onOpenAlertFromLog}){
  const q = (logQuery || "").trim();
  const filtered = state.logs.filter(l=> matchQuery(l, q)).slice(0, 220);

  host.innerHTML = `
    <div class="card">
      <div class="card-title">
        <div class="h2">Log Explorer</div>
        <div class="row">
          <span class="badge">${escapeHtml(String(filtered.length))} shown</span>
          <button class="btn btn-ghost" id="btnSave">Save query</button>
          <button class="btn btn-ghost" id="btnExplain">Query help</button>
        </div>
      </div>

      ${q ? `<div class="tiny muted">Query: <span class="kbd">${escapeHtml(q)}</span></div>` : `<div class="tiny muted">No query (showing newest events)</div>`}

      <div class="divider"></div>

      <table class="table" id="logsTable">
        <thead>
          <tr>
            <th>Time</th><th>Source</th><th>Sev</th><th>User</th><th>Host</th><th>Tactic</th><th>Action</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(l=>`
            <tr data-id="${l.id}">
              <td>${escapeHtml(fmtTime(l.ts))}</td>
              <td>${escapeHtml(l.source)}</td>
              <td>${pill(l.severity)}</td>
              <td>${escapeHtml(l.user)}</td>
              <td>${escapeHtml(l.host)}</td>
              <td>${escapeHtml(l.tactic)}</td>
              <td><strong>${escapeHtml(l.action)}</strong><div class="tiny muted">${escapeHtml(l.details)}</div></td>
              <td><button class="icon-btn btnPivot" title="Pivot to alert">⚠</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  host.querySelector("#btnSave")?.addEventListener("click", onSaveQuery);
  host.querySelector("#btnExplain")?.addEventListener("click", ()=>{
    alert('Query tips:\n\nUse field:value pairs like:\n  user:tyler host:LAB-UBU\n  severity:high source:M365\n\nOperators: AND / OR / NOT\nExample:\n  severity:high AND source:Entra\n\nFree text searches across key fields.');
  });

  host.querySelector("#logsTable")?.addEventListener("click", (e)=>{
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    if (!e.target.classList.contains("btnPivot")) return;
    const id = row.getAttribute("data-id");
    const l = state.logs.find(x=>x.id===id);
    if (!l) return;

    // Pivot: create a quick synthetic alert from the log (blue-team style correlation).
    onOpenAlertFromLog(l);
  });
}

export function renderTools({state, host, onToast}){
  host.innerHTML = `
    <div class="grid2">
      <div class="card">
        <div class="card-title">
          <div class="h2">Email Header Analyzer (Sim)</div>
          <span class="badge">Defensive</span>
        </div>
        <div class="tiny muted">Paste headers (no real sensitive data). Extracts basic fields and flags common issues.</div>
        <div class="divider"></div>
        <textarea class="input" id="hdrIn" style="min-height:160px; font-family:var(--mono);" placeholder="Paste email headers here..."></textarea>
        <div class="row" style="margin-top:10px;">
          <button class="btn btn-primary" id="hdrRun">Analyze</button>
          <button class="btn btn-ghost" id="hdrClear">Clear</button>
        </div>
        <div class="divider"></div>
        <div class="codebox"><pre id="hdrOut">(results)</pre></div>
      </div>

      <div class="card">
        <div class="card-title">
          <div class="h2">URL Defang / Refang</div>
          <span class="badge">Safe sharing</span>
        </div>
        <div class="tiny muted">Convert URLs to safe form for tickets, and back when needed.</div>
        <div class="divider"></div>
        <textarea class="input" id="urlIn" style="min-height:120px; font-family:var(--mono);" placeholder="https://example.com/login"></textarea>
        <div class="row" style="margin-top:10px;">
          <button class="btn btn-primary" id="urlDefang">Defang</button>
          <button class="btn btn-ghost" id="urlRefang">Refang</button>
          <button class="btn btn-ghost" id="urlCopy">Copy</button>
        </div>
        <div class="divider"></div>
        <div class="codebox"><pre id="urlOut">(output)</pre></div>
      </div>

      <div class="card">
        <div class="card-title">
          <div class="h2">Hash & Encoding</div>
          <span class="badge">Local compute</span>
        </div>
        <div class="tiny muted">Quickly hash data (SHA-256) or encode/decode Base64. (All in-browser.)</div>
        <div class="divider"></div>
        <textarea class="input" id="hashIn" style="min-height:120px; font-family:var(--mono);" placeholder="Type/paste text..."></textarea>
        <div class="row" style="margin-top:10px;">
          <button class="btn btn-primary" id="btnSha">SHA-256</button>
          <button class="btn btn-ghost" id="btnB64e">Base64 Encode</button>
          <button class="btn btn-ghost" id="btnB64d">Base64 Decode</button>
          <button class="btn btn-ghost" id="hashCopy">Copy</button>
        </div>
        <div class="divider"></div>
        <div class="codebox"><pre id="hashOut">(output)</pre></div>
      </div>

      <div class="card">
        <div class="card-title">
          <div class="h2">IP / Domain Reputation (Sim)</div>
          <span class="badge warn">Toy model</span>
        </div>
        <div class="tiny muted">Offline reputation simulation list. Great for demos without external calls.</div>
        <div class="divider"></div>
        <input class="input" id="repIn" placeholder="e.g., 8.8.8.8 or sharepoint-docs-login.net" />
        <div class="row" style="margin-top:10px;">
          <button class="btn btn-primary" id="repRun">Check</button>
          <button class="btn btn-ghost" id="repRandom">Random</button>
        </div>
        <div class="divider"></div>
        <div class="codebox"><pre id="repOut">(results)</pre></div>
      </div>
    </div>
  `;

  const $ = (id)=> host.querySelector(id);

  // Header analyzer
  $("#hdrRun").addEventListener("click", ()=>{
    const text = $("#hdrIn").value || "";
    const lines = text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);

    const get = (name)=> {
      const re = new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:\\s*(.*)$", "i");
      const found = lines.find(l=> re.test(l));
      if (!found) return null;
      const m = found.match(re);
      return (m?.[1] || "").trim();
    };

    const from = get("From") || "(not found)";
    const to = get("To") || "(not found)";
    const subj = get("Subject") || "(not found)";
    const msgid = get("Message-ID") || "(not found)";
    const received = lines.filter(l=> /^Received:/i.test(l)).length;
    const spf = get("Received-SPF") || get("Authentication-Results") || "(not found)";

    const flags = [];
    if (/fail/i.test(spf)) flags.push("SPF/DMARC failure indication present");
    if (received <= 1) flags.push("Very few Received hops (could be internal or malformed)");
    if (/reply-to/i.test(text) && /From:/i.test(text) && get("Reply-To") && get("Reply-To") !== from) flags.push("Reply-To differs from From");

    $("#hdrOut").textContent =
`Parsed
- From: ${from}
- To: ${to}
- Subject: ${subj}
- Message-ID: ${msgid}
- Received hops: ${received}

Auth hints
- ${spf}

Flags
- ${flags.length ? flags.join("\n- ") : "None detected (simulation parser)"}\n`;

    onToast({title:"Header analysis complete", body:"Parsed common fields (simulation).", meta:["Tools"]});
  });

  $("#hdrClear").addEventListener("click", ()=>{
    $("#hdrIn").value = "";
    $("#hdrOut").textContent = "(results)";
  });

  // URL defang/refang
  const defang = (s)=> s
    .replace(/https?:\/\//gi, (m)=> m.toLowerCase().startsWith("https") ? "hxxps[://]" : "hxxp[://]")
    .replace(/\./g, "[.]");
  const refang = (s)=> s
    .replace(/hxxps\[\:\/\/\]/gi, "https://")
    .replace(/hxxp\[\:\/\/\]/gi, "http://")
    .replace(/\[\.\]/g, ".");

  $("#urlDefang").addEventListener("click", ()=>{
    $("#urlOut").textContent = defang($("#urlIn").value || "");
  });
  $("#urlRefang").addEventListener("click", ()=>{
    $("#urlOut").textContent = refang($("#urlIn").value || "");
  });
  $("#urlCopy").addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText($("#urlOut").textContent || "");
      onToast({title:"Copied", body:"Tool output copied.", meta:["Tools"]});
    }catch(e){
      onToast({title:"Clipboard blocked", body:"Browser blocked clipboard access.", meta:["Tip: use HTTPS"], tone:"warn"});
    }
  });

  // Hash & base64
  async function sha256(text){
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }

  $("#btnSha").addEventListener("click", async ()=>{
    const t = $("#hashIn").value || "";
    $("#hashOut").textContent = await sha256(t);
  });
  $("#btnB64e").addEventListener("click", ()=>{
    try{
      const t = $("#hashIn").value || "";
      $("#hashOut").textContent = btoa(unescape(encodeURIComponent(t)));
    }catch(e){
      $("#hashOut").textContent = "Base64 encode failed (input may contain unsupported characters).";
    }
  });
  $("#btnB64d").addEventListener("click", ()=>{
    try{
      const t = $("#hashIn").value || "";
      $("#hashOut").textContent = decodeURIComponent(escape(atob(t)));
    }catch(e){
      $("#hashOut").textContent = "Base64 decode failed (input not valid Base64).";
    }
  });
  $("#hashCopy").addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText($("#hashOut").textContent || "");
      onToast({title:"Copied", body:"Tool output copied.", meta:["Tools"]});
    }catch(e){
      onToast({title:"Clipboard blocked", body:"Browser blocked clipboard access.", meta:["Tip: use HTTPS"], tone:"warn"});
    }
  });

  // Reputation sim
  const repDB = {
    "8.8.8.8": {score: 10, verdict:"benign", notes:"Public resolver (example)."},
    "1.1.1.1": {score: 10, verdict:"benign", notes:"Public resolver (example)."},
    "sharepoint-docs-login.net": {score: 92, verdict:"malicious", notes:"Lookalike domain pattern."},
    "verify-mfa-now.com": {score: 88, verdict:"malicious", notes:"Common phishing lure phrasing."},
    "micr0soft-login.com": {score: 96, verdict:"malicious", notes:"Typosquat pattern (0 in microsoft)."},
    "login.microsoftonline.com": {score: 5, verdict:"benign", notes:"Legitimate Microsoft login."},
  };
  const randomCandidates = ["8.8.8.8","1.1.1.1","sharepoint-docs-login.net","verify-mfa-now.com","micr0soft-login.com","login.microsoftonline.com"];

  function repCheck(x){
    const key = (x||"").trim().toLowerCase();
    if (!key) return {ok:false, msg:"Enter an IP or domain."};
    const hit = repDB[key];
    if (!hit) return {ok:true, score: 35, verdict:"unknown", notes:"Not in local list. Treat as unknown and gather more context."};
    return {ok:true, ...hit};
  }

  $("#repRun").addEventListener("click", ()=>{
    const r = repCheck($("#repIn").value);
    $("#repOut").textContent = r.ok
      ? `Verdict: ${r.verdict.toUpperCase()}\nScore: ${r.score}/100\nNotes: ${r.notes}`
      : r.msg;
  });
  $("#repRandom").addEventListener("click", ()=>{
    const pick = randomCandidates[Math.floor(Math.random()*randomCandidates.length)];
    $("#repIn").value = pick;
    $("#repRun").click();
  });
}

export function renderPlaybooks({state, host, onOpenPlaybook}){
  const list = state.playbooks || [];
  host.innerHTML = `
    <div class="card">
      <div class="card-title">
        <div class="h2">Playbooks</div>
        <span class="badge">${escapeHtml(String(list.length))} runbooks</span>
      </div>
      <div class="tiny muted">These are blue-team runbooks designed for portfolio demonstration.</div>
      <div class="divider"></div>

      <div class="grid2">
        ${list.map(p=>`
          <div class="card" style="padding:12px;" data-id="${p.id}">
            <div class="card-title">
              <div class="h2">${escapeHtml(p.title)}</div>
              <span class="badge ok">Ready</span>
            </div>
            <div class="tiny muted">${escapeHtml(p.summary)}</div>
            <div class="divider"></div>
            <div class="row">
              <button class="btn btn-primary btnOpen">Open</button>
              <span class="badge">Artifacts: ${escapeHtml(String((p.artifacts||[]).length))}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  host.querySelectorAll(".btnOpen").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      const card = e.target.closest("[data-id]");
      onOpenPlaybook(card.getAttribute("data-id"));
    });
  });
}

export function renderPlaybookDetail({state, host, playbookId, onBack}){
  const p = (state.playbooks||[]).find(x=>x.id===playbookId);
  if (!p){
    host.innerHTML = `<div class="card"><div class="h2">Playbook not found</div></div>`;
    return;
  }

  host.innerHTML = `
    <div class="card">
      <div class="card-title">
        <div>
          <div class="h2">${escapeHtml(p.title)}</div>
          <div class="tiny muted">${escapeHtml(p.summary)}</div>
        </div>
        <button class="btn btn-ghost" id="btnBack">← Back</button>
      </div>

      <div class="divider"></div>

      <div class="grid2">
        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Steps</div><span class="badge">${escapeHtml(String((p.steps||[]).length))}</span></div>
          <div class="codebox"><pre>${escapeHtml((p.steps||[]).map((s,i)=>`${String(i+1).padStart(2,"0")}. ${s}`).join("\n"))}</pre></div>
        </div>
        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Artifacts</div><span class="badge">${escapeHtml(String((p.artifacts||[]).length))}</span></div>
          <div class="codebox"><pre>${escapeHtml((p.artifacts||[]).map(a=>`- ${a}`).join("\n"))}</pre></div>
          <div class="divider"></div>
          <div class="tiny muted">Tip: In interviews, talk through how you collect these artifacts and document decisions.</div>
        </div>
      </div>
    </div>
  `;

  host.querySelector("#btnBack")?.addEventListener("click", onBack);
}

export function renderSettings({state, host, onReset, onToggleDemoData}){
  host.innerHTML = `
    <div class="card">
      <div class="card-title">
        <div class="h2">Settings</div>
        <span class="badge">Local-only</span>
      </div>
      <div class="tiny muted">Controls for demo mode, persistence, and safe usage.</div>
      <div class="divider"></div>

      <div class="grid2">
        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Demo Mode</div><span class="badge ok">Portfolio</span></div>
          <div class="tiny muted">When enabled, the simulator seeds data on first load and keeps generating alerts.</div>
          <div class="divider"></div>
          <button class="btn btn-primary" id="btnDemo">Toggle demo data seed</button>
          <div class="tiny muted" style="margin-top:10px;">If you want a “clean slate” demo, reset state.</div>
        </div>

        <div class="card" style="padding:12px;">
          <div class="card-title"><div class="h2">Danger Zone</div><span class="badge danger">Reset</span></div>
          <div class="tiny muted">This clears local simulator state (alerts, cases, saved queries).</div>
          <div class="divider"></div>
          <button class="btn" style="border-color: rgba(255,77,109,0.28);" id="btnReset">Reset simulator state</button>
          <div class="tiny muted" style="margin-top:10px;">Export first if you want to keep a snapshot.</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="card" style="padding:12px;">
        <div class="card-title"><div class="h2">Safe Usage Notes</div><span class="badge warn">Important</span></div>
        <div class="codebox">
          <pre>- This app is a simulation for portfolio demonstration.
- Do not paste real sensitive emails, personal data, or customer information.
- Tools are defensive (analysis / triage / documentation). No exploitation features.
- Everything runs in your browser; state is stored in localStorage.</pre>
        </div>
      </div>
    </div>
  `;

  host.querySelector("#btnReset")?.addEventListener("click", onReset);
  host.querySelector("#btnDemo")?.addEventListener("click", onToggleDemoData);
}

// ---------- helpers ----------
function pill(type){
  const t = String(type || "").toLowerCase();
  if (t === "high") return `<span class="pill hi">HIGH</span>`;
  if (t === "medium") return `<span class="pill med">MED</span>`;
  if (t === "low") return `<span class="pill low">LOW</span>`;
  if (t === "new") return `<span class="pill new">NEW</span>`;
  return `<span class="pill">${escapeHtml(t.toUpperCase() || "—")}</span>`;
}
function rowKV(k, v){
  return `<tr><th style="width:140px;">${escapeHtml(k)}</th><td><span class="kbd">${escapeHtml(String(v ?? ""))}</span></td></tr>`;
}
