// Fichier de données : id,titre,date,lien,img,description
const CSV_URL = "assets/data/data.csv";

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const store = {
  get(k, d){ try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
let ITEMS = [];
const byId = id => ITEMS.find(x => x.id === id);
function toast(m){ const t = $("#toast"); t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2200); }

/* ---------- CSV ---------- */
function parseCSV(t){
  t = t.replace(/^\uFEFF/, "");
  const first = t.split(/\r?\n/, 1)[0];
  const d = [",", ";", "\t"].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let r = [], f = "", q = false;
  for(let i = 0; i < t.length; i++){
    const c = t[i];
    if(q){ if(c === '"'){ if(t[i+1] === '"'){ f += '"'; i++; } else q = false; } else f += c; }
    else if(c === '"') q = true;
    else if(c === d){ r.push(f); f = ""; }
    else if(c === "\n"){ r.push(f); rows.push(r); r = []; f = ""; }
    else if(c !== "\r") f += c;
  }
  if(f || r.length){ r.push(f); rows.push(r); }
  return rows;
}
// Date : 2026-10-15, 15/10/2026, 2026… → timestamp (0 si illisible)
function dateTs(d){
  let m;
  if((m = d.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) return Date.UTC(+m[3], m[2] - 1, +m[1]);
  const t = Date.parse(d);
  return isNaN(t) ? 0 : t;
}
function dateLabel(it){
  if(!it.date) return "";
  return /^\d{4}$/.test(it.date) || !it.ts ? it.date : new Date(it.ts).toLocaleDateString("fr-FR", {day: "numeric", month: "long", year: "numeric", timeZone: "UTC"});
}
function toItems(rows){
  if(!rows.length) return [];
  const h = rows[0].map(x => x.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const ix = (...n) => h.findIndex(x => n.includes(x));
  const i = {id: ix("id"), t: ix("titre","title","nom"), dt: ix("date"), l: ix("lien","liens","link","url"), im: ix("img","image","affiche","poster"), d: ix("description","synopsis")};
  const get = (r, k) => (k < 0 ? "" : (r[k] || "")).trim();
  return rows.slice(1).filter(r => get(r, i.t)).map((r, n) => {
    const date = get(r, i.dt);
    return {
      id: get(r, i.id) || String(n + 1), title: get(r, i.t), date, ts: dateTs(date),
      img: get(r, i.im), desc: get(r, i.d), order: n,
      links: get(r, i.l).split(/[\s|;]+/).filter(u => /^https?:\/\//i.test(u))
    };
  });
}
const newest = (a, b) => (b.ts - a.ts) || (b.order - a.order);

/* ---------- Accueil ---------- */
function shuffle(a, seed){
  a = a.slice(); let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function card(it){
  const b = document.createElement("button");
  b.className = "card";
  b.title = it.title;
  b.style.setProperty("--h", [...it.title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360);
  b.innerHTML = (it.img ? '<img loading="lazy" referrerpolicy="no-referrer" alt="">' : "") + '<span class="cap">' + esc(it.title) + "</span>";
  const im = b.querySelector("img");
  if(im){ im.onerror = () => im.remove(); im.src = it.img; }
  b.onclick = () => openDetail(it.id);
  return b;
}
function addRow(title, list){
  if(!list.length) return;
  const s = document.createElement("section");
  s.className = "row";
  s.innerHTML = '<h2>' + esc(title) + '</h2><button class="ar l">‹</button><div class="rs"></div><button class="ar r">›</button>';
  const rs = s.querySelector(".rs");
  list.forEach(it => rs.appendChild(card(it)));
  s.querySelector(".l").onclick = () => rs.scrollBy({left: -rs.clientWidth * .8, behavior: "smooth"});
  s.querySelector(".r").onclick = () => rs.scrollBy({left: rs.clientWidth * .8, behavior: "smooth"});
  $("#rows").appendChild(s);
}
function buildHome(){
  $("#rows").innerHTML = "";
  const seed = Math.floor(Date.now() / 864e5);
  addRow("Reprendre la lecture", store.get("hist", []).map(byId).filter(Boolean));
  addRow("Ajoutés récemment", ITEMS.slice().sort(newest).slice(0, 25));
  addRow("Tendance actuelle", shuffle(ITEMS, seed).slice(0, 25));
  addRow("À découvrir", shuffle(ITEMS, seed + 7).slice(0, 25));
  $("#total").textContent = ITEMS.length;
}

/* ---------- Hero ---------- */
let heroList = [], heroI = 0, heroOn = 0, heroTimer, heroCur = null;
function heroShow(n){
  const it = heroList[n]; if(!it) return;
  heroI = n; heroCur = it;
  const L = [$("#hbA"), $("#hbB")];
  L[heroOn].classList.remove("on"); heroOn = 1 - heroOn;
  if(it.img){ L[heroOn].src = it.img; L[heroOn].classList.add("on"); }
  const p = $("#hPoster"); p.hidden = !it.img; if(it.img) p.src = it.img;
  $("#hTitle").textContent = it.title;
  $("#hDesc").textContent = it.desc;
}
function heroInit(){
  clearInterval(heroTimer);
  const pool = ITEMS.filter(x => x.img);
  heroList = shuffle(pool.length ? pool : ITEMS, Math.floor(Date.now() / 864e5)).slice(0, 6);
  if(!heroList.length) return;
  heroShow(0);
  heroTimer = setInterval(() => heroShow((heroI + 1) % heroList.length), 8000);
}
$("#hPlay").onclick = () => heroCur && play(heroCur.id);
$("#hInfo").onclick = () => heroCur && openDetail(heroCur.id);

/* ---------- Overlays ---------- */
const stack = [];
function openOv(id, hash){
  $("#" + id).classList.add("open");
  stack.push(id);
  history.pushState(null, "", hash || location.pathname + location.search);
  document.body.style.overflow = "hidden";
}
function back(){ if(stack.length) history.back(); }
window.addEventListener("popstate", () => {
  const id = stack.pop();
  if(id){ $("#" + id).classList.remove("open"); if(id === "player") $("#stage").innerHTML = ""; }
  document.body.style.overflow = stack.length ? "hidden" : "";
});
document.addEventListener("keydown", e => { if(e.key === "Escape") back(); });
document.querySelectorAll("[data-close]").forEach(b => b.onclick = back);
$("#bd").addEventListener("click", e => { if(e.target.id === "bd") back(); });

/* ---------- Catalogue ---------- */
const CHUNK = 60; let catList = [], catShown = 0;
function catRender(){
  const q = $("#cSearch").value.trim().toLowerCase(), s = $("#cSort").value;
  catList = ITEMS.filter(x => x.title.toLowerCase().includes(q));
  catList.sort(s === "az" ? (a, b) => a.title.localeCompare(b.title, "fr")
    : s === "za" ? (a, b) => b.title.localeCompare(a.title, "fr")
    : s === "new" ? newest : (a, b) => -newest(a, b));
  $("#grid").innerHTML = ""; catShown = 0;
  $("#cCount").textContent = catList.length + " titre" + (catList.length > 1 ? "s" : "");
  $("#cNone").hidden = catList.length > 0;
  catMore();
}
function catMore(){
  catList.slice(catShown, catShown + CHUNK).forEach(it => $("#grid").appendChild(card(it)));
  catShown += CHUNK;
}
new IntersectionObserver(es => { if(es[0].isIntersecting && catShown < catList.length) catMore(); }, {root: $("#catalog"), rootMargin: "400px"}).observe($("#sentinel"));
$("#cSearch").addEventListener("input", catRender);
$("#cSort").addEventListener("change", catRender);
function openCatalog(focus){
  if(!stack.includes("catalog")){ catRender(); openOv("catalog", "#catalogue"); }
  if(focus) $("#cSearch").focus();
}
$("#nCat").onclick = () => openCatalog();
$("#nSearch").onclick = () => openCatalog(true);
$("#nHome").onclick = () => { while(stack.length) history.back(); scrollTo({top: 0, behavior: "smooth"}); };

/* ---------- Fiche ---------- */
let curId = null;
function openDetail(id){
  const it = byId(id); if(!it) return;
  curId = id;
  $("#mTitle").textContent = it.title;
  $("#mDesc").textContent = it.desc || "Pas de description.";
  $("#mMeta").textContent = [dateLabel(it), it.links.length + " lecteur" + (it.links.length > 1 ? "s" : "")].filter(Boolean).join(" · ");
  const p = $("#mPoster"); p.hidden = !it.img; p.src = it.img || "";
  openOv("bd", "#film-" + encodeURIComponent(id));
  $(".modal").scrollTop = 0;
}
$("#mPlay").onclick = () => play(curId);

/* ---------- Lecteur ---------- */
function embed(u){
  let m;
  if((m = u.match(/ok\.ru\/(?:video|videoembed)\/(\d+)/))) return "https://ok.ru/videoembed/" + m[1];
  if((m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/))) return "https://www.youtube.com/embed/" + m[1];
  return u;
}
function loadHls(){
  return window.Hls ? Promise.resolve() : new Promise(r => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js";
    s.onload = s.onerror = r; document.head.appendChild(s);
  });
}
async function source(it, n){
  const stage = $("#stage"), u = it.links[n]; stage.innerHTML = "";
  document.querySelectorAll(".src").forEach((b, i) => b.classList.toggle("on", i === n));
  if(!u){ stage.innerHTML = '<p class="msg">Aucun lien de lecture pour ce titre.</p>'; return; }
  if(/\.m3u8(\?|$)/i.test(u)){
    const v = document.createElement("video"); v.controls = true; v.autoplay = true; stage.appendChild(v);
    await loadHls();
    if(window.Hls && Hls.isSupported()){ const h = new Hls(); h.loadSource(u); h.attachMedia(v); } else v.src = u;
  }else if(/\.(mp4|webm|ogv)(\?|$)/i.test(u)){
    const v = document.createElement("video"); v.src = u; v.controls = true; v.autoplay = true; stage.appendChild(v);
  }else{
    const f = document.createElement("iframe");
    f.src = embed(u); f.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture"; f.allowFullscreen = true;
    f.referrerPolicy = "no-referrer"; stage.appendChild(f);
  }
}
function play(id){
  const it = byId(id); if(!it) return;
  store.set("hist", [id, ...store.get("hist", []).filter(x => x !== id)].slice(0, 20));
  $("#pTitle").textContent = it.title;
  $("#pSrc").innerHTML = it.links.length > 1 ? it.links.map((_, i) => '<button class="src" data-i="' + i + '">Lecteur ' + (i + 1) + "</button>").join(" ") : "";
  document.querySelectorAll(".src").forEach(b => b.onclick = () => source(it, +b.dataset.i));
  if(!stack.includes("player")) openOv("player", "#watch-" + encodeURIComponent(id));
  source(it, 0);
  buildHome();
}

addEventListener("scroll", () => $("#nav").classList.toggle("solid", scrollY > 60));

/* ---------- Démarrage ---------- */
(async () => {
  try{
    const r = await fetch(CSV_URL, {cache: "no-cache"});
    if(!r.ok) throw new Error(r.status);
    ITEMS = toItems(parseCSV(await r.text()));
  }catch(e){
    $("#hTitle").textContent = "Catalogue introuvable";
    $("#hDesc").textContent = "Impossible de lire " + CSV_URL + ". Ouvre le site depuis un serveur web (pas en double-clic sur le fichier) et vérifie le chemin.";
    return;
  }
  if(!ITEMS.length){ $("#hTitle").textContent = "Catalogue vide"; $("#hDesc").textContent = "Colonnes attendues : id,titre,date,lien,img,description."; return; }
  buildHome(); heroInit();
  const m = location.hash.match(/^#(film|watch)-(.+)$/);
  if(m){
    history.replaceState(null, "", location.pathname + location.search);
    const id = decodeURIComponent(m[2]);
    m[1] === "film" ? openDetail(id) : play(id);
  }
})();
