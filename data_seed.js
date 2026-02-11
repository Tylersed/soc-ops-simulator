// =======================================
// SOC Ops Simulator — data_seed.js
// Seed data for alerts, logs, assets, playbooks
// =======================================

import { uid, nowISO } from "./utils.js";

export const SEVERITY = ["low", "medium", "high"];
export const STATUS = ["new", "triage", "in-progress", "contained", "closed"];
export const SOURCES = ["M365", "Entra ID", "Defender", "Proofpoint", "EDR", "Firewall", "SIEM"];
export const TACTICS = [
  { tactic:"Initial Access", techniques:["Phishing", "Drive-by", "Valid Accounts"] },
  { tactic:"Execution", techniques:["PowerShell", "Office Macro", "User Execution"] },
  { tactic:"Persistence", techniques:["Scheduled Task", "Browser Extension", "Service"] },
  { tactic:"Privilege Escalation", techniques:["Token Theft", "UAC Bypass", "Sudo Abuse"] },
  { tactic:"Defense Evasion", techniques:["Disable Security Tools", "Obfuscated Files", "Living off the Land"] },
  { tactic:"Credential Access", techniques:["Password Spraying", "Phishing", "Credential Dumping (sim)"] },
  { tactic:"Discovery", techniques:["Account Discovery", "Network Discovery", "Cloud Discovery"] },
  { tactic:"Lateral Movement", techniques:["Remote Services", "RDP", "SMB"] },
  { tactic:"Collection", techniques:["Email Collection", "Browser Data", "File Search"] },
  { tactic:"Exfiltration", techniques:["Cloud Sync", "Web Upload", "Email Exfil"] },
];

export const ASSETS = [
  { id: uid("asset"), host:"FIN-WS-014", os:"Windows 11", owner:"Audra Rawlings", dept:"Finance", criticality:"high", lastSeen: nowISO() },
  { id: uid("asset"), host:"MKT-MBP-007", os:"macOS", owner:"Erica Jackson", dept:"Marketing", criticality:"high", lastSeen: nowISO() },
  { id: uid("asset"), host:"OPS-WS-003", os:"Windows 11", owner:"Luke Kimel", dept:"Operations", criticality:"medium", lastSeen: nowISO() },
  { id: uid("asset"), host:"ADV-MBP-021", os:"macOS", owner:"Advisor (Sim)", dept:"Advisors", criticality:"medium", lastSeen: nowISO() },
  { id: uid("asset"), host:"LAB-UBU-002", os:"Ubuntu", owner:"Tyler Seder", dept:"IT", criticality:"high", lastSeen: nowISO() },
  { id: uid("asset"), host:"SRV-AZ-001", os:"Azure VM", owner:"IT (Sim)", dept:"IT", criticality:"high", lastSeen: nowISO() },
];

export const USERS = [
  { user:"tyler.seder", display:"Tyler Seder", role:"IT", risk:"low" },
  { user:"erica.jackson", display:"Erica Jackson", role:"Marketing", risk:"low" },
  { user:"audra.rawlings", display:"Audra Rawlings", role:"Finance", risk:"medium" },
  { user:"advisor.sim", display:"Advisor (Sim)", role:"Advisor", risk:"medium" },
  { user:"vendor.msp", display:"Vendor MSP (Sim)", role:"Vendor", risk:"high" },
];

export const PLAYBOOKS = [
  {
    id: uid("pb"),
    title: "Suspicious Sign-in (Cloud)",
    summary: "Triage risky sign-in alerts: validate user, IP reputation, MFA status, device posture, and recent activity. Contain quickly if indicators are strong.",
    steps: [
      "Confirm alert source and timestamp; check for correlated events (MFA resets, impossible travel).",
      "Validate user context: expected travel? new device? delegated admin?",
      "Check IP: geo, ASN, known VPN/hosting providers (simulation list).",
      "Review conditional access outcomes; confirm MFA challenge and result.",
      "Contain if needed: revoke sessions, reset password, require MFA re-registration, block sign-in from IP.",
      "Document: timeline, evidence, actions, and user notification.",
    ],
    artifacts: ["Sign-in logs", "Conditional Access report", "User timeline", "Session revocation record"],
    severityMap: { low:"Monitor", medium:"Validate", high:"Contain" }
  },
  {
    id: uid("pb"),
    title: "Phishing Reported by User",
    summary: "Standard response flow: gather headers, assess links/attachments, search for similar messages, quarantine, educate.",
    steps: [
      "Collect the suspicious email (headers + body) using the analysis tools.",
      "Defang and inspect URLs; check for lookalike domains and redirect chains (simulation).",
      "Search mail for similar messages across users; identify impacted recipients.",
      "Quarantine/remove malicious emails if confirmed; block sender/domain as appropriate.",
      "Reset credentials or sessions for any user who interacted with the message.",
      "Record findings and create awareness follow-up.",
    ],
    artifacts: ["Email headers", "URL analysis", "Message trace results", "Remediation actions"],
    severityMap: { low:"Educate", medium:"Quarantine", high:"Quarantine + Reset" }
  },
  {
    id: uid("pb"),
    title: "Endpoint Malware Signal (EDR)",
    summary: "Runbook for endpoint detections: isolate host, gather triage package, check persistence, remediate, confirm.",
    steps: [
      "Validate detection: file path, process tree, parent/child processes, hashes.",
      "Isolate endpoint if high confidence or active threat.",
      "Collect triage data: autoruns (sim), scheduled tasks, browser extensions, recent downloads.",
      "Remove/purge artifacts and revert persistence mechanisms (sim steps).",
      "Re-enable protections and confirm clean state; monitor for recurrence.",
    ],
    artifacts: ["Process tree", "File hashes", "Persistence checks", "Isolate/Release record"],
    severityMap: { low:"Validate", medium:"Triage", high:"Isolate" }
  }
];

export function seedAlerts(count=18){
  const alerts = [];
  for (let i=0;i<count;i++){
    alerts.push(generateAlert({});
  }
  return alerts;
}

export function seedLogs(count=220){
  const actions = [
    "User sign-in succeeded",
    "User sign-in failed",
    "MFA challenge",
    "Mailbox rule created",
    "Forwarding changed",
    "OAuth consent granted",
    "Process started (sim)",
    "File downloaded",
    "Security policy updated",
    "Device compliance failed",
    "Admin role activated",
  ];
  const logs = [];
  for (let i=0;i<count;i++){
    const t = TACTICS[Math.floor(Math.random()*TACTICS.length)];
    const tech = t.techniques[Math.floor(Math.random()*t.techniques.length)];
    const s = SOURCES[Math.floor(Math.random()*SOURCES.length)];
    const sev = SEVERITY[Math.floor(Math.random()*SEVERITY.length)];
    const u = USERS[Math.floor(Math.random()*USERS.length)];
    const a = ASSETS[Math.floor(Math.random()*ASSETS.length)];
    logs.push({
      id: uid("log"),
      ts: new Date(Date.now() - Math.floor(Math.random()*1000*60*60*36)).toISOString(),
      source: s,
      severity: sev,
      action: actions[Math.floor(Math.random()*actions.length)],
      user: u.user,
      host: a.host,
      tactic: t.tactic,
      technique: tech,
      details: `event=${s.toLowerCase().replace(/\s/g,"_")} user=${u.user} host=${a.host} technique="${tech}"`,
      tags: [t.tactic, tech, s, sev],
    });
  }
  // Newest first
  logs.sort((a,b)=> new Date(b.ts)-new Date(a.ts));
  return logs;
}

export function generateAlert({forceSeverity=null} = {}){
  const t = TACTICS[Math.floor(Math.random()*TACTICS.length)];
  const tech = t.techniques[Math.floor(Math.random()*t.techniques.length)];
  const s = SOURCES[Math.floor(Math.random()*SOURCES.length)];
  const sev = forceSeverity || SEVERITY[Math.floor(Math.random()*SEVERITY.length)];
  const u = USERS[Math.floor(Math.random()*USERS.length)];
  const a = ASSETS[Math.floor(Math.random()*ASSETS.length)];
  const status = "new";

  const titles = {
    "Phishing":"Possible phishing link clicked",
    "Password Spraying":"Password spray activity detected",
    "Valid Accounts":"Unusual login from new device",
    "OAuth consent granted":"New OAuth app consented",
    "Mailbox rule created":"Suspicious mailbox rule created",
    "PowerShell":"Suspicious PowerShell activity (sim)",
    "Disable Security Tools":"Security control tampering signal",
    "Cloud Sync":"High-volume cloud sync activity",
  };

  const title = titles[tech] || `${t.tactic} indicator observed`;
  const summary = `source=${s} user=${u.user} host=${a.host} tactic="${t.tactic}" technique="${tech}"`;

  return {
    id: uid("al"),
    createdAt: new Date().toISOString(),
    source: s,
    severity: sev,
    status,
    title,
    summary,
    user: u.user,
    host: a.host,
    tactic: t.tactic,
    technique: tech,
    tags: [t.tactic, tech, s, sev],
    evidence: {
      ip: randomIP(),
      geo: randomGeo(),
      asn: randomASN(),
      hash: randomHash(),
      url: randomUrl(tech),
      mailFrom: randomFrom(tech),
    },
    notes: [],
    timeline: [
      {ts: new Date().toISOString(), type:"created", msg:"Alert generated (simulation)."},
    ]
  };
}

function randomIP(){
  return `${rand(11,223)}.${rand(0,255)}.${rand(0,255)}.${rand(1,254)}`;
}
function rand(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function randomGeo(){
  const g = ["US-IL", "US-GA", "US-CA", "DE", "NL", "GB", "SG", "AU", "BR", "IN"];
  return g[Math.floor(Math.random()*g.length)];
}
function randomASN(){
  const a = ["AS16509", "AS15169", "AS8075", "AS14618", "AS9009", "AS13335", "AS20940", "AS14061"];
  return a[Math.floor(Math.random()*a.length)];
}
function randomHash(){
  const hex = "0123456789abcdef";
  let out = "";
  for (let i=0;i<64;i++) out += hex[Math.floor(Math.random()*16)];
  return out;
}
function randomFrom(tech){
  const good = ["hr@peachtreetc.com","it@peachtreetc.com","no-reply@microsoft.com","alerts@security.com"];
  const bad = ["support@micr0soft-login.com","billing@paypa1-secure.com","docshare@sharepoint-login.net","office@verify-mfa-now.com"];
  if (tech === "Phishing" || tech === "Password Spraying") return bad[Math.floor(Math.random()*bad.length)];
  return good[Math.floor(Math.random()*good.length)];
}
function randomUrl(tech){
  const ok = ["https://portal.office.com","https://login.microsoftonline.com","https://peachtreetc.com","https://intranet.peachtreetc.com"];
  const sketch = ["http://microsoft-auth-verify.com/login","https://sharepoint-docs-login.net/view","https://outlook-webmail-secure.org/auth","http://verify-mfa-now.com"];
  if (tech === "Phishing" || tech === "Valid Accounts" || tech === "OAuth consent granted") return sketch[Math.floor(Math.random()*sketch.length)];
  return ok[Math.floor(Math.random()*ok.length)];
}
