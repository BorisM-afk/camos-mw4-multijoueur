const DATA = window.CAMOS_DATA;
const GROUPS = [["sp","Spéciaux"],["comp","Érudits"]];
let state = {};            // cle -> date de déblocage
let query = "", justToggled = null;
const $ = s => document.querySelector(s);
const keyOf = (w, c) => w.name + "|" + c.n;
const fmt = iso => { try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }); } catch (e) { return ""; } };

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}
const CHECK = '<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5"/></svg>';

let current = { cat: DATA.classes[0][0], weapon: null };
try { const s = JSON.parse(localStorage.getItem("camos-vue") || "null"); if (s && DATA.classes.some(c => c[0] === s.cat)) current = s; } catch (e) {}
const saveView = () => { try { localStorage.setItem("camos-vue", JSON.stringify(current)); } catch (e) {} };
const weaponsOf = cat => DATA.weapons.filter(w => w.cls === cat);
const doneOf = w => w.camos.filter(c => state[keyOf(w, c)]).length;

function selectCat(cat, focus) {
  current.cat = cat;
  const ws = weaponsOf(cat);
  if (!ws.some(w => w.name === current.weapon)) current.weapon = ws[0]?.name || null;
  saveView(); render();
  const b = document.querySelector('.cat[data-k="' + CSS.escape(cat) + '"]');
  if (b) { b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); if (focus) b.focus(); }
}
function selectWeapon(name, focus) {
  current.weapon = name; saveView(); render();
  const c = document.querySelector('.wcard[data-w="' + CSS.escape(name) + '"]');
  if (c) { c.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); if (focus) c.focus(); }
}
function stepCat(d) {
  const i = DATA.classes.findIndex(c => c[0] === current.cat);
  selectCat(DATA.classes[(i + d + DATA.classes.length) % DATA.classes.length][0], true);
}
function stepWeapon(d) {
  const ws = weaponsOf(current.cat); if (!ws.length) return;
  const i = ws.findIndex(w => w.name === current.weapon);
  selectWeapon(ws[(i + d + ws.length) % ws.length].name, true);
}

function buildChips() {
  const box = $("#chips");
  for (const [k, label] of DATA.classes) {
    box.append(el("button", { type: "button", class: "cat", role: "tab", "data-k": k, onclick: () => selectCat(k) }, label, el("small", {})));
  }
  $("#prevcat").addEventListener("click", () => stepCat(-1));
  $("#nextcat").addEventListener("click", () => stepCat(1));
  document.addEventListener("keydown", e => {
    if (e.target.closest("input, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "q") { e.preventDefault(); stepCat(-1); }
    else if (k === "e") { e.preventDefault(); stepCat(1); }
    else if (e.key === "ArrowLeft" && !e.target.closest(".row")) { e.preventDefault(); stepWeapon(-1); }
    else if (e.key === "ArrowRight" && !e.target.closest(".row")) { e.preventDefault(); stepWeapon(1); }
  });
}

function camoRow(w, c) {
  const key = keyOf(w, c), on = !!state[key];
  const cb = el("input", { type: "checkbox", "aria-label": w.name + " " + c.n });
  cb.checked = on;
  cb.addEventListener("change", () => toggle(w, c, cb.checked));
  const box = el("span", { class: "box" }); box.innerHTML = CHECK;
  return el("label", { class: "row k-" + c.k + (on ? " ck" : "") + (key === justToggled && on ? " pop" : "") },
    cb, box, el("span", { class: "cn" + (c.n === "Platinum" ? " plat" : "") }, c.n), el("span", { class: "dt" }, on ? fmt(state[key]) : ""),
    el("span", { class: "cd" }, c.d));
}
function dotsOf(w) {
  const d = el("span", { class: "dots", "aria-hidden": "true" });
  for (const c of w.camos) d.append(el("b", { class: state[keyOf(w, c)] ? "on" : "" }));
  return d;
}

function render() {
  const list = $("#list"); list.textContent = "";
  // onglets : compteur par catégorie
  for (const b of document.querySelectorAll(".cat")) {
    const ws = weaponsOf(b.dataset.k);
    const d = ws.reduce((a, w) => a + doneOf(w), 0), t = ws.reduce((a, w) => a + w.camos.length, 0);
    b.setAttribute("aria-selected", String(!query.trim() && b.dataset.k === current.cat));
    b.lastChild.textContent = d + "/" + t;
    b.classList.toggle("complete", d === t);
  }
  if (query.trim()) renderSearch(list); else renderVolet(list);
  justToggled = null;
  let done = 0, tot = 0;
  for (const w of DATA.weapons) for (const c of w.camos) { tot++; if (state[keyOf(w, c)]) done++; }
  $("#tot").textContent = done + " / " + tot;
  $("#totpct").textContent = "camos débloqués · " + Math.round(done / tot * 100) + " %";
  $("#totbar").style.width = (done / tot * 100) + "%";
  const hb = DATA.weapons.filter(w => state[w.name + "|Harmonic Break"]).length, nw = DATA.weapons.length;
  $("#div").classList.toggle("on", hb === nw);
  $("#divtxt").textContent = hb === nw ? "débloqué sur ton compte ✓" : "Harmonic Break sur " + hb + " / " + nw + " armes (se débloque à " + nw + ")";
}

function renderVolet(list) {
  const ws = weaponsOf(current.cat);
  if (!ws.some(w => w.name === current.weapon)) current.weapon = ws[0]?.name || null;
  const strip = el("div", { class: "weapons", role: "tablist", "aria-label": "Armes" });
  for (const w of ws) {
    const d = doneOf(w), sel = w.name === current.weapon;
    strip.append(el("button", { type: "button", role: "tab", class: "wcard" + (d === w.camos.length ? " complete" : ""), "aria-selected": String(sel), "data-w": w.name,
      onclick: () => selectWeapon(w.name) },
      el("span", { class: "wn" }, w.name), el("span", { class: "wc" }, d + " / " + w.camos.length), dotsOf(w)));
  }
  list.append(strip);
  const w = ws.find(x => x.name === current.weapon); if (!w) return;
  const d = doneOf(w), complete = d === w.camos.length;
  const panel = el("section", { class: "panel" + (complete ? " complete" : ""), "aria-label": w.name },
    el("div", { class: "phead" }, el("h2", {}, w.name), el("span", { class: "pc" }, complete ? "✓ Tous les camos débloqués" : d + " / " + w.camos.length + " camos")),
    el("div", { class: "meter" }, el("i", {})));
  panel.querySelector(".meter i").style.width = (d / w.camos.length * 100) + "%";
  const cols = el("div", { class: "cols" });
  for (const [gk, glabel] of GROUPS) {
    const cs = w.camos.filter(c => c.k === gk); if (!cs.length) continue;
    const g = el("div", { class: "group" }, el("h3", {}, glabel));
    for (const c of cs) g.append(camoRow(w, c));
    cols.append(g);
  }
  panel.append(cols);
  list.append(panel);
  requestAnimationFrame(() => strip.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }));
}

function renderSearch(list) {
  const q = query.trim().toLowerCase();
  let shown = 0;
  for (const [ck, clabel] of DATA.classes) {
    const ws = DATA.weapons.filter(w => w.cls === ck && (w.name.toLowerCase().includes(q) || w.camos.some(c => (c.n + " " + c.d).toLowerCase().includes(q))));
    if (!ws.length) continue;
    const sec = el("section", { class: "cls" }, el("div", { class: "cls-head" }, el("h2", {}, clabel)));
    for (const w of ws) {
      shown++;
      const done = doneOf(w), complete = done === w.camos.length;
      const d = el("details", { class: "wp" + (complete ? " complete" : ""), "data-w": w.name });
      d.open = true;
      d.append(el("summary", {},
        el("span", { class: "wname" }, w.name, complete ? el("span", { class: "tag done" }, "✓ terminée") : null),
        el("span", { class: "wcount" }, done + " / " + w.camos.length), dotsOf(w)));
      const body = el("div", { class: "group" });
      for (const [gk, glabel] of GROUPS) {
        const cs = w.camos.filter(c => c.k === gk); if (!cs.length) continue;
        body.append(el("h3", {}, glabel));
        for (const c of cs) body.append(camoRow(w, c));
      }
      d.append(body); sec.append(d);
    }
    list.append(sec);
  }
  if (!shown) list.append(el("p", { class: "empty" }, "Aucune arme ne correspond à ta recherche."));
}

function status(msg, err) { const s = $("#save"); s.textContent = msg; s.classList.toggle("err", !!err); }
function alertBox(msg) { const a = $("#alert"); a.textContent = msg; a.hidden = !msg; }

let csrf = "", user = null, mode = "login";

async function api(body) {
  const opts = body
    ? { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(body), credentials: "same-origin" }
    : { cache: "no-store", credentials: "same-origin" };
  const r = await fetch("api.php", opts);
  let j; try { j = await r.json(); } catch (e) { throw new Error("Réponse invalide du serveur"); }
  if (!j.ok) { const err = new Error(j.error || "Erreur serveur"); err.status = r.status; throw err; }
  if (j.csrf) csrf = j.csrf;
  return j;
}

function applyState(j) {
  user = j.user; state = j.checked || {};
  $("#nocode").hidden = !user || j.has_code !== false;
  if (!user) { $("#acctpanel").hidden = true; $("#acctbtn").setAttribute("aria-expanded", "false"); }
  if (j.recovery_code) showCode(j.recovery_code);
  $("#auth").hidden = !!user;
  $("#account").hidden = !user;
  $("#who").textContent = user || "";
  document.body.classList.toggle("guest", !user);
  status(user ? "progression synchronisée ✓" : "non connecté", !user);
  restoreAccount(); render();
}

async function toggle(w, c, val) {
  if (!user) {
    render();
    alertBox("Connecte-toi ou crée un compte pour enregistrer ta progression.");
    $("#auth").scrollIntoView({ behavior: "smooth", block: "center" }); $("#pseudo").focus();
    return;
  }
  const key = keyOf(w, c), prev = state[key];
  if (val) state[key] = new Date().toISOString(); else delete state[key];
  justToggled = key; render();
  status("enregistrement…");
  try {
    const j = await api({ action: "set", arme: w.name, camo: c.n, done: val });
    if (val && j.debloque_le) state[key] = j.debloque_le;
    status("enregistré ✓"); alertBox("");
  } catch (e) {
    if (prev) state[key] = prev; else delete state[key];
    render(); status("échec de l'enregistrement", true);
    alertBox(e.status === 401 ? "Ta session a expiré : reconnecte-toi." : "La sauvegarde a échoué : " + e.message);
    if (e.status === 401 || e.status === 403) init();
  }
}

function setMode(m) {
  mode = m;
  const rec = m === "recover";
  $("#tab-login").setAttribute("aria-selected", String(m === "login"));
  $("#tab-register").setAttribute("aria-selected", String(m === "register"));
  $("#authsubmit").textContent = m === "login" ? "Se connecter" : m === "register" ? "Créer mon compte" : "Changer mon mot de passe";
  $("#mdp").setAttribute("autocomplete", m === "login" ? "current-password" : "new-password");
  $("#mdplbl").textContent = rec ? "Nouveau mot de passe" : "Mot de passe";
  $("#code").hidden = $("#codelbl").hidden = !rec;
  $("#forgot").textContent = rec ? "← Retour à la connexion" : "Mot de passe oublié ?";
  document.querySelector(".authintro").textContent = rec
    ? "Entre ton pseudo et le code de secours reçu à la création de ton compte."
    : "Connecte-toi pour enregistrer ta progression.";
  $("#hint").hidden = m === "login";
  $("#formerr").textContent = "";
}
$("#tab-login").addEventListener("click", () => setMode("login"));
$("#tab-register").addEventListener("click", () => setMode("register"));
$("#forgot").addEventListener("click", () => { setMode(mode === "recover" ? "login" : "recover"); (mode === "recover" ? $("#pseudo") : $("#pseudo")).focus(); });
$("#authform").addEventListener("submit", async e => {
  e.preventDefault();
  const pseudo = $("#pseudo").value.trim(), mdp = $("#mdp").value, code = $("#code").value.trim();
  if (!pseudo || !mdp || (mode === "recover" && !code)) { $("#formerr").textContent = "Remplis tous les champs."; return; }
  $("#authsubmit").disabled = true; $("#formerr").textContent = "";
  try {
    const body = { action: mode, pseudo, mdp }; if (mode === "recover") body.code = code;
    const j = await api(body);
    $("#mdp").value = ""; $("#code").value = ""; alertBox(""); setMode("login"); applyState(j);
  } catch (err) { $("#formerr").textContent = err.message; }
  finally { $("#authsubmit").disabled = false; }
});

function showCode(code) {
  $("#codeval").textContent = code;
  $("#codecard").hidden = false;
  $("#codecard").scrollIntoView({ behavior: "smooth", block: "center" });
  $("#codeok").focus({ preventScroll: true });
}
$("#codecopy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#codeval").textContent); $("#codecopy").textContent = "Copié ✓"; }
  catch (e) { const r = document.createRange(); r.selectNodeContents($("#codeval")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $("#codecopy").textContent = "Sélectionné, fais Ctrl+C"; }
});
$("#codeok").addEventListener("click", () => { $("#codecard").hidden = true; $("#codeval").textContent = ""; $("#codecopy").textContent = "Copier"; });

$("#acctbtn").addEventListener("click", () => {
  const open = $("#acctpanel").hidden;
  $("#acctpanel").hidden = !open; $("#acctbtn").setAttribute("aria-expanded", String(open));
});
$("#nocodebtn").addEventListener("click", () => { $("#acctpanel").hidden = false; $("#acctbtn").setAttribute("aria-expanded", "true"); $("#cd-cur").focus(); });

async function accountAction(form, errEl, body, onOk) {
  const btn = form.querySelector("button[type=submit]"); btn.disabled = true; errEl.textContent = ""; errEl.className = "formerr";
  try { const j = await api(body); form.reset(); onOk(j); }
  catch (e) { errEl.textContent = e.message; }
  finally { btn.disabled = false; }
}
$("#pwform").addEventListener("submit", e => {
  e.preventDefault();
  const actuel = $("#pw-cur").value, mdp = $("#pw-new").value;
  if (!actuel || !mdp) { $("#pwerr").textContent = "Remplis les deux champs."; return; }
  accountAction($("#pwform"), $("#pwerr"), { action: "change_password", actuel, mdp }, j => {
    applyState(j); $("#acctpanel").hidden = false;
    $("#pwerr").className = "formok"; $("#pwerr").textContent = "Mot de passe changé. Tes autres appareils sont déconnectés.";
  });
});
$("#codeform").addEventListener("submit", e => {
  e.preventDefault();
  const actuel = $("#cd-cur").value;
  if (!actuel) { $("#cderr").textContent = "Entre ton mot de passe actuel."; return; }
  accountAction($("#codeform"), $("#cderr"), { action: "new_code", actuel }, j => { applyState(j); $("#acctpanel").hidden = true; $("#acctbtn").setAttribute("aria-expanded", "false"); });
});

function restoreAccount() {
  const z = $("#acctzone"); z.textContent = "";
  z.append(el("button", { class: "btn", onclick: async () => {
    try { applyState(await api({ action: "logout" })); alertBox(""); } catch (e) { alertBox("Déconnexion impossible : " + e.message); }
  } }, "Se déconnecter"));
}

function resetUI() {
  if (!user) return;
  const z = $("#resetzone"); z.textContent = "";
  z.append(el("span", { class: "controls" }, "Effacer toute ta progression ?",
    el("button", { class: "btn danger", onclick: async () => {
      try { await api({ action: "reset" }); state = {}; render(); status("progression effacée"); }
      catch (e) { status("échec de l'effacement", true); }
      restoreReset();
    } }, "Effacer"),
    el("button", { class: "btn", onclick: restoreReset }, "Annuler")));
}
function restoreReset() { const z = $("#resetzone"); z.textContent = ""; z.append(el("button", { class: "btn", onclick: resetUI }, "Tout réinitialiser")); }

$("#q").addEventListener("input", e => { query = e.target.value; render(); });
$("#hide").addEventListener("change", e => document.body.classList.toggle("hide-done", e.target.checked));

async function init() {
  try { applyState(await api()); }
  catch (e) {
    status("hors ligne", true);
    $("#auth").hidden = true;
    alertBox(location.protocol === "file:"
      ? "La page est ouverte directement depuis le fichier : elle doit être servie par PHP (en ligne ou avec LANCER.bat)."
      : "Impossible de joindre le serveur : la progression ne peut pas être chargée.");
  }
}

buildChips(); restoreReset(); render(); init();

// Bouton œil sur chaque champ mot de passe : afficher / masquer ce qu'on tape
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="slash" d="M4 4l16 16"/></svg>';
function hidePasswords(root) {
  (root || document).querySelectorAll(".pweye[aria-pressed='true']").forEach(b => b.click());
}
document.querySelectorAll('input[type="password"]').forEach(input => {
  const wrap = el("span", { class: "pwwrap" });
  input.replaceWith(wrap); wrap.append(input);
  const btn = el("button", { type: "button", class: "pweye", "aria-pressed": "false", "aria-label": "Afficher le mot de passe", title: "Afficher le mot de passe" });
  btn.innerHTML = EYE;
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", String(show));
    const lbl = show ? "Masquer le mot de passe" : "Afficher le mot de passe";
    btn.setAttribute("aria-label", lbl); btn.title = lbl;
  });
  wrap.append(btn);
});
// Re-masque les mots de passe après chaque envoi de formulaire
document.querySelectorAll("form").forEach(f => f.addEventListener("submit", () => setTimeout(() => hidePasswords(f), 0)));
