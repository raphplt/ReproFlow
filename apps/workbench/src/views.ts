import type { Report, RunResult } from "@reproflow/event-schema";
import { summarize } from "@reproflow/runner";

export const escapeHtml = (value: unknown) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const labels: Record<string, string> = {
  reproduced: "Bug reproduit",
  not_reproduced: "Test réussi",
  generation_failure: "Échec de génération",
  infrastructure_failure: "Infrastructure indisponible",
  inconclusive: "Résultat non concluant",
  flaky: "Résultats variables",
  running: "Exécution en cours",
  complete: "Terminé",
  failed: "Exécution interrompue",
};
const badge = (status: string) =>
  `<span class="badge ${escapeHtml(status)}">${escapeHtml(labels[status] ?? status)}</span>`;
const style = `
:root{font:14px system-ui,sans-serif;color:#20272b;background:#f4f6f7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}a{color:#176657;text-underline-offset:3px}button,input{font:inherit}button,.command{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;border:1px solid #bec8cb;background:white;color:#253338;border-radius:5px;font-weight:600;cursor:pointer;text-decoration:none}button.primary{background:#176657;border-color:#176657;color:#fff}button:disabled{opacity:.5;cursor:wait}button:hover,.command:hover{filter:brightness(.96)}:focus-visible{outline:3px solid #187b9e;outline-offset:3px}header{background:#fff;border-bottom:1px solid #dce2e5;padding:18px 4%;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-weight:750;font-size:22px;color:#172e29;text-decoration:none}.project{font-size:12px;color:#59666b}main{max-width:1160px;margin:auto;padding:32px 24px 64px}h1{font-size:28px;margin:0 0 8px;line-height:1.25}h2{font-size:17px;margin:0 0 18px}h3{font-size:14px;margin:0 0 12px}p{line-height:1.65;color:#56666d}.muted{color:#64747b;font-size:12px}.heading{display:flex;justify-content:space-between;gap:20px;align-items:start;flex-wrap:wrap;margin-bottom:28px}.actions{display:flex;gap:10px;flex-wrap:wrap}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid #d5dddf;border-bottom:1px solid #d5dddf;margin:26px 0 32px;background:#fff}.stat{padding:22px 20px}.stat+.stat{border-left:1px solid #d5dddf}.stat strong{display:block;font-size:26px;margin:8px 0}.badge{display:inline-block;padding:4px 7px;font-size:12px;border-radius:3px;background:#e4e9ec;color:#39494f}.reproduced{background:#fbe5e5;color:#a12f39}.not_reproduced,.complete{background:#dff2e8;color:#196044}.failed,.infrastructure_failure,.generation_failure,.inconclusive{background:#fff0d3;color:#7b550c}.running{background:#e1eef9;color:#215f85}section{margin:32px 0;border-top:1px solid #dce2e5;padding-top:24px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:36px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;background:#fff}th{font-size:11px;text-transform:uppercase;color:#67767c;font-weight:600;background:#edf1f2}td,th{padding:13px 14px;border-bottom:1px solid #dce2e5;white-space:nowrap}td:last-child{white-space:normal;min-width:140px}code,pre{font-family:ui-monospace,monospace;font-size:12px}pre{background:#172522;color:#deeee7;padding:22px;overflow:auto;line-height:1.7;border-radius:5px;margin-top:16px;max-height:600px}.hash{overflow-wrap:anywhere}ol{padding-left:24px;line-height:2.15}details{margin-top:24px}summary{cursor:pointer;font-weight:600}.notice{border-left:3px solid #d7a03b;padding:12px 16px;background:#fff7e7;line-height:1.6}.empty{padding:42px 0;color:#617077}.progress{height:5px;accent-color:#176657;width:100%}footer{font-size:12px;color:#6b777c;margin-top:36px}dialog{max-width:520px;border:1px solid #c3ced1;border-radius:6px;padding:24px}dialog::backdrop{background:#14241e66}.sr{position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden}input[type=file]{max-width:100%;margin:16px 0}svg{width:100%;height:36px;display:block}@media(max-width:650px){main{padding:24px 16px}.columns{grid-template-columns:1fr;gap:0}.stat{padding:15px 10px}.stat strong{font-size:22px}.stats{margin-top:20px}h1{font-size:24px}header{padding:16px}.project{max-width:130px;text-align:right}td,th{padding:12px 9px}}
`;
function shell(title: string, content: string, script = "") {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · ReproFlow</title><style>${style}</style></head><body><header><a class="brand" href="/">ReproFlow</a><span class="project">Projet local / Demo Shop</span></header><main>${content}<footer>Chromium · demo-shop-v1 · Données synthétiques · Exécutions isolées sans réseau externe</footer></main>${script ? `<script>${script}</script>` : ""}</body></html>`;
}
function stats(runs: RunResult[], name: string) {
  const summary = summarize(runs);
  return `<div class="stat"><span>${name}</span><strong>${summary.reproduced} / ${summary.total}</strong><span class="muted">bugs reproduits · ${summary.passed} réussites · ${summary.unusable} inexploitables</span></div>`;
}
export function renderReport(report: Report, live = true) {
  const buggy = report.runs.filter((run) => run.variant === "buggy");
  const fixed = report.runs.filter((run) => run.variant === "fixed");
  const proven =
    report.state === "complete" &&
    buggy.length > 0 &&
    fixed.length > 0 &&
    buggy.every((run) => run.status === "reproduced") &&
    fixed.every((run) => run.status === "not_reproduced") &&
    report.runs.every((run) => run.testSha256 === report.testSha256);
  const title = "Checkout après modification de l’adresse";
  return shell(
    title,
    `<div class="heading"><div><p class="muted">REPRODUCTION / ${escapeHtml(report.id.slice(0, 8))}</p><h1>${title}</h1><p>${escapeHtml(new Date(report.createdAt).toLocaleString("fr-FR"))}</p></div>${badge(report.state)}</div>
${report.state === "running" ? '<progress class="progress" aria-label="Exécutions en cours"></progress>' : ""}
<div class="stats">${stats(buggy, "Application buggée")}${stats(fixed, "Application corrigée")}<div class="stat"><span>Test identique</span><strong>${proven ? "Validé" : "À vérifier"}</strong><span class="muted">${proven ? "Rouge sur le bug, vert après correction" : "Preuve complète non établie"}</span></div></div>
${report.state === "failed" ? '<p class="notice">Le runner n’a pas terminé. Vérifier Docker et construire l’image avec <code>pnpm runner:build</code>, puis relancer la reproduction.</p>' : ""}
<div class="columns"><section><h2>Scénario enregistré</h2><ol>${report.scenario.steps.map(({ action, sourceSequences }) => `<li><code>${escapeHtml(action.type)} ${escapeHtml("target" in action ? action.target : action.path)}${"value" in action ? ` = ${escapeHtml(action.value)}` : ""}</code> <span class="muted">év. ${sourceSequences.join(", ")}</span></li>`).join("")}</ol></section><section><h2>Oracle et observation</h2><h3>Attendu confirmé</h3><p>Atteindre <code>${report.scenario.oracle.expectedPath}</code>.</p><h3>État enregistré</h3><p>URL : <code>${report.scenario.observed.path}</code><br>Erreur postale : ${report.scenario.observed.postalCodeError ? "ADDRESS_POSTAL_CODE_MISSING" : "non observée"}<br>POST /api/checkout : ${report.scenario.observed.checkout500 ? "500" : "500 non observé"}</p></section></div>
<section><h2>Résultats par exécution</h2><div class="table-wrap"><table><thead><tr><th>Version</th><th>Run</th><th>Résultat</th><th>URL</th><th>Étapes</th><th>Durée</th><th>Preuves</th></tr></thead><tbody>${report.runs.map((run) => `<tr><td>${run.variant === "buggy" ? "Buggée" : "Corrigée"}</td><td>${run.index}</td><td>${badge(run.status)}</td><td><code>${run.evidence.observedPath}</code></td><td>${run.evidence.completedSteps}/${report.scenario.steps.length}</td><td>${(run.evidence.durationMs / 1000).toFixed(1)} s</td><td><code>POST ${run.evidence.checkoutStatuses.map((s) => s ?? "échec réseau").join(", ") || "non observé"}${run.evidence.postalCodeError ? " · ADDRESS_POSTAL_CODE_MISSING" : ""}</code><br><span class="muted">Chromium ${escapeHtml(run.evidence.browserVersion ?? "indisponible")}</span></td></tr>`).join("")}</tbody></table></div></section>
<section><div class="heading"><h2>Test Playwright</h2><div class="actions">${live ? `<a class="command" href="/artifacts/${report.id}/reproduction.spec.js" download>Télécharger le test</a><a class="command" href="/artifacts/${report.id}/report.json" download>Rapport JSON</a><a class="command" href="/artifacts/${report.id}/recording.json" download>Trace JSON</a><button id="rerun">${report.state === "running" ? "Annuler" : "Relancer"}</button><span id="action-status" role="status"></span>` : ""}</div></div><p class="muted hash">SHA-256 : ${report.testSha256}</p><details><summary>Voir le test généré</summary><pre><code>${escapeHtml(report.source)}</code></pre></details></section>`,
    live
      ? `document.querySelector('#rerun').onclick=async()=>{try{const r=await fetch('${report.state === "running" ? "/api/cancel" : `/api/retry/${report.id}`}',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error();location.assign('/')}catch{document.querySelector('#action-status').textContent='Une opération est déjà en cours.'}};${report.state === "running" ? "setTimeout(()=>location.reload(),2500)" : ""}`
      : "",
  );
}

export function renderIndex(reports: Report[], busy: boolean, message: string) {
  return shell(
    "Reproductions",
    `<div class="heading"><div><p class="muted">PROJET / DEMO SHOP</p><h1>Reproductions</h1></div><div class="actions"><button id="capture" class="primary" ${busy ? "disabled" : ""}>Enregistrer un bug</button><button id="demo" ${busy ? "disabled" : ""}>Exécuter la démo</button><button id="import" ${busy ? "disabled" : ""}>Importer une trace</button></div></div>
<p id="status" role="status">${escapeHtml(message || (busy ? "Capture ou reproduction en cours…" : ""))}</p>${busy ? '<progress class="progress" aria-label="Traitement en cours"></progress><button id="abort">Annuler</button>' : ""}
<section><h2>Historique</h2>${reports.length ? `<div class="table-wrap"><table><thead><tr><th>Enregistrement</th><th>Date</th><th>État</th><th>Runs</th><th>Résultat buggé</th></tr></thead><tbody>${reports.map((report) => `<tr><td><a href="/reproductions/${report.id}">Checkout · ${report.id.slice(0, 8)}</a></td><td>${escapeHtml(new Date(report.createdAt).toLocaleString("fr-FR"))}</td><td>${badge(report.state)}</td><td>${report.runs.length}</td><td>${badge(summarize(report.runs.filter((run) => run.variant === "buggy")).status ?? "inconclusive")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">Aucune reproduction enregistrée.</p>'}</section>
<dialog><form id="upload"><h2>Importer une trace</h2><label for="trace">Trace demo-shop-v1 (.json)</label><input id="trace" type="file" accept="application/json,.json" required><div class="actions"><button type="submit" class="primary">Générer et vérifier</button><button type="button" id="cancel">Annuler</button></div></form></dialog>`,
    `
const status=document.querySelector('#status');
async function start(path,body){document.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Traitement en cours…';try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error();location.reload()}catch{status.textContent='Opération indisponible. Vérifier la trace et le runner.';document.querySelectorAll('button').forEach(b=>b.disabled=false)}}
document.querySelector('#capture').onclick=()=>start('/api/capture',{automated:false});document.querySelector('#demo').onclick=()=>start('/api/capture',{automated:true});
document.querySelector('#abort')?.addEventListener('click',()=>start('/api/cancel',{}));
const dialog=document.querySelector('dialog');document.querySelector('#import').onclick=()=>dialog.showModal();document.querySelector('#cancel').onclick=()=>dialog.close();
document.querySelector('#upload').onsubmit=async e=>{e.preventDefault();try{const file=document.querySelector('#trace').files[0];if(file.size>500000)throw new Error();const trace=JSON.parse(await file.text());dialog.close();await start('/api/import',trace)}catch{status.textContent='Trace JSON invalide ou trop volumineuse.';dialog.close()}};
${busy ? "setTimeout(()=>location.reload(),2500);" : ""}`,
  );
}
