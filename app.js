(function(){
"use strict";
var REPO={owner:"alexislanon-collab",repo:"electroportatif",path:"materiel.json",branch:"main"};
var PAGE_URL="https://alexislanon-collab.github.io/electroportatif/";
var ST={dispo:"Disponible",sorti:"Sorti",verifier:"À vérifier",introuvable:"Introuvable",hs:"Réformé HS"};
var ORDER=["dispo","sorti","verifier","introuvable","hs"];
var DKEY="electro-draft-v2",TKEY="electro-gh-token";
var DATA=null,SHA=null,loadErr="";
var ui={q:"",statut:"all",loc:"all"};
var admin={on:false,token:"",draft:null,busy:false,msg:"",ok:""};
var sheet=null;
var app=document.getElementById("app");

var I={
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
 pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
 qr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v1M14 20h1M17 17h4v4h-4"/></svg>',
 key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};

function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function norm(s){return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();}
function clone(o){return JSON.parse(JSON.stringify(o));}
function cur(){return admin.draft||DATA;}
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}}
function sortItems(a){a.sort(function(x,y){return norm(x.designation).localeCompare(norm(y.designation))||norm(x.marque).localeCompare(norm(y.marque))||norm(x.ref).localeCompare(norm(y.ref))||String(x.serie).localeCompare(String(y.serie));});}
function dirtyIds(){
 if(!admin.draft)return {};
 var o={},m={};DATA.items.forEach(function(i){m[i.id]=JSON.stringify(i);});
 admin.draft.items.forEach(function(i){if(m[i.id]!==JSON.stringify(i))o[i.id]=1;});
 return o;
}
function changeCount(){
 if(!admin.draft||!DATA)return 0;
 var n=Object.keys(dirtyIds()).length,ids={};
 admin.draft.items.forEach(function(i){ids[i.id]=1;});
 DATA.items.forEach(function(i){if(!ids[i.id])n++;});
 var a=clone(admin.draft.config),b=clone(DATA.config);delete a.maj;delete b.maj;
 if(JSON.stringify(a)!==JSON.stringify(b))n++;
 return n;
}
function ensureDraft(){if(!admin.draft)admin.draft=clone(DATA);}
function saveDraft(){lsSet(DKEY,changeCount()?JSON.stringify(admin.draft):null);}
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function frDate(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||"");return m?m[3]+"/"+m[2]+"/"+m[1]:(s||"");}

function filtered(){
 var q=norm(ui.q).split(/\s+/).filter(Boolean);
 return cur().items.filter(function(i){
  if(ui.statut!=="all"&&i.statut!==ui.statut)return false;
  if(ui.loc!=="all"&&(i.localisation||"")!==ui.loc)return false;
  if(!q.length)return true;
  var h=norm([i.designation,i.marque,i.ref,i.serie,i.energie,i.localisation,i.commentaire,i.annee].join(" "));
  return q.every(function(t){return h.indexOf(t)>-1;});
 });
}
function locs(){var s={};cur().items.forEach(function(i){s[i.localisation||""]=1;});return Object.keys(s).sort(function(a,b){if(!a)return 1;if(!b)return -1;return a.localeCompare(b);});}

function header(cfg,total){
 var h='<header class="top"><div class="wrap"><div><h1>'+esc((cfg&&cfg.titre)||"Électroportatif")+'</h1>';
 if(cfg)h+='<div class="sub">Inventaire du '+esc(cfg.inventaire||"")+' · mis à jour le '+esc(frDate(cfg.maj))+' · '+total+' pièces</div>';
 h+='</div><div class="hbtns"><button class="btn" id="b-qr" type="button">'+I.qr+'QR code</button>';
 h+='<button class="btn'+(admin.on?' on':'')+'" id="b-admin" type="button" aria-pressed="'+admin.on+'">'+I.key+(admin.on?'Mode admin':'Admin')+'</button>';
 return h+'</div></div><div class="tape" aria-hidden="true"></div></header>';
}

function render(){
 var fa=document.activeElement,fid=fa&&fa.id,ss=fa&&fa.selectionStart;
 var h="";
 if(!DATA){
  h+=header(null,0)+'<main class="wrap"><div class="empty">'+(loadErr?esc(loadErr)+' <br><br><button class="btn" id="b-retry" type="button">Réessayer</button>':'Chargement de la liste du matériel…')+'</div></main>';
  if(sheet)h+=renderSheet();
  app.innerHTML=h;afterRender(fid,ss);return;
 }
 var d=cur(),items=d.items,cfg=d.config;
 var counts={};ORDER.forEach(function(k){counts[k]=0;});items.forEach(function(i){counts[i.statut]=(counts[i.statut]||0)+(+i.nb||1);});
 var total=items.reduce(function(a,i){return a+(+i.nb||1);},0);
 var f=filtered(),groups=[],gm={};
 f.forEach(function(i){var k=i.designation||"Sans désignation";if(!gm[k]){gm[k]={name:k,items:[]};groups.push(gm[k]);}gm[k].items.push(i);});
 var dirty=dirtyIds();
 h+=header(cfg,total)+'<main class="wrap">';
 if(admin.on){
  h+='<section class="adminbar"><h3>Administration</h3><p>Touchez une ligne pour la modifier. Vos changements restent en brouillon sur cet appareil jusqu\'à ce que vous les publiiez. L\'équipe les voit environ 1 minute après.</p>';
  h+='<div class="row"><button class="btn primary" id="b-add" type="button">'+I.plus+'Ajouter du matériel</button><button class="btn" id="b-cfg" type="button">Réglages</button><button class="btn" id="b-logout" type="button">Retirer ma clé</button></div>';
  if(admin.msg)h+='<div class="notice">'+esc(admin.msg)+'</div>';
  if(admin.ok)h+='<div class="notice ok">'+esc(admin.ok)+'</div>';
  h+='</section>';
 }
 h+='<div class="summary">';
 h+='<button type="button" class="stat" data-st="all" aria-pressed="'+(ui.statut==="all")+'"><b>'+total+'</b><span>Tout</span></button>';
 ORDER.forEach(function(k){if(!counts[k]&&k!=="dispo")return;h+='<button type="button" class="stat s-'+k+'" data-st="'+k+'" aria-pressed="'+(ui.statut===k)+'"><b>'+counts[k]+'</b><span>'+ST[k]+'</span></button>';});
 h+='</div>';
 h+='<div class="filters"><div class="search">'+I.search+'<input id="q" type="search" placeholder="Chercher : boulonneuse, DTW, 3/4, TST…" value="'+esc(ui.q)+'" autocomplete="off" aria-label="Rechercher"></div>';
 h+='<select id="loc" aria-label="Localisation"><option value="all">Tous les lieux</option>';
 locs().forEach(function(l){h+='<option value="'+esc(l)+'"'+(ui.loc===l?' selected':'')+'>'+esc(l||"Lieu non renseigné")+'</option>';});
 h+='</select></div>';
 h+='<div class="count">'+f.length+' ligne'+(f.length>1?'s':'')+(ui.q||ui.statut!=="all"||ui.loc!=="all"?' affichée'+(f.length>1?'s':'')+' · <a href="#" id="reset">tout afficher</a>':'')+'</div>';
 if(!groups.length)h+='<div class="empty">Aucun matériel ne correspond à cette recherche.</div>';
 groups.forEach(function(g){
  var n=0,ok=0;g.items.forEach(function(i){var c=+i.nb||1;n+=c;if(i.statut==="dispo")ok+=c;});
  h+='<section class="group"><div class="ghead"><h2>'+esc(g.name)+'</h2><small><b>'+ok+'</b> dispo / '+n+'</small></div><ul class="items">';
  g.items.forEach(function(i){
   var title=[i.marque?'<span>'+esc(i.marque)+'</span>':'',i.ref?'<span class="mono">'+esc(i.ref)+'</span>':''].join("");
   if(!title)title='<span>'+esc(i.designation)+'</span>';
   var meta=[];
   if(i.energie)meta.push(esc(i.energie));
   if(i.annee)meta.push(esc(i.annee));
   if(i.serie)meta.push('N° <span class="mono">'+esc(i.serie)+'</span>');
   h+='<li class="item'+(admin.on?' edit':'')+(dirty[i.id]?' dirty':'')+'" data-id="'+esc(i.id)+'"'+(admin.on?' tabindex="0" role="button"':'')+'><div class="it-main"><div class="it-title">'+title+((+i.nb||1)>1?'<span class="nb">×'+esc(i.nb)+'</span>':'')+'</div>';
   if(meta.length)h+='<div class="it-meta">'+meta.map(function(m){return '<span>'+m+'</span>';}).join("")+'</div>';
   if(i.commentaire)h+='<div class="it-com">'+esc(i.commentaire)+'</div>';
   h+='</div><div class="it-side"><span class="pill p-'+esc(i.statut)+'">'+esc(ST[i.statut]||i.statut)+'</span>'+(i.localisation?'<span class="loc">'+I.pin+esc(i.localisation)+'</span>':'')+'</div></li>';
  });
  h+='</ul></section>';
 });
 h+='</main><footer class="wrap">Consultation libre · modifications réservées aux administrateurs</footer>';
 var cc=changeCount();
 if(admin.on&&cc){
  h+='<div class="spacer"></div><div class="pub" role="region" aria-label="Publication"><div class="wrap"><span>'+cc+' modification'+(cc>1?'s':'')+' en brouillon</span><div class="row"><button class="btn ghost" id="b-discard" type="button">Annuler tout</button><button class="btn" id="b-pub" type="button"'+(admin.busy?' disabled':'')+'>'+(admin.busy?'Publication…':'Publier pour l\'équipe')+'</button></div></div></div>';
 }
 if(sheet)h+=renderSheet();
 app.innerHTML=h;afterRender(fid,ss);
}
function afterRender(fid,ss){
 if(fid){var el=document.getElementById(fid);if(el){el.focus();try{if(ss!=null)el.setSelectionRange(ss,ss);}catch(e){}}}
 if(sheet&&(sheet.mode==="qr"||sheet.mode==="cfg"))drawQR();
}

function dl(id,vals){return '<datalist id="'+id+'">'+vals.map(function(v){return '<option value="'+esc(v)+'">';}).join("")+'</datalist>';}
function uniq(k){var s={};cur().items.forEach(function(i){if(i[k])s[i[k]]=1;});return Object.keys(s).sort();}
function fld(id,label,val,extra,cls){return '<div class="field'+(cls?' '+cls:'')+'"><label for="'+id+'">'+label+'</label><input id="'+id+'" value="'+esc(val)+'" '+(extra||"")+'></div>';}

function renderSheet(){
 var h='<div class="sheet-bg" id="sheet-bg"><div class="sheet" role="dialog" aria-modal="true">';
 if(sheet.mode==="qr"){
  h+='<h3>Accès rapide</h3><div class="qrbox"><div class="qr" id="qr"></div><p>Scannez avec l\'appareil photo du téléphone pour ouvrir cette page.</p><code>'+esc(PAGE_URL)+'</code></div><div class="actions"><span></span><button class="btn primary" id="s-close" type="button">Fermer</button></div>';
 } else if(sheet.mode==="login"){
  h+='<h3>Accès admin</h3><p class="help">Collez votre clé GitHub (elle commence par <span class="mono">github_pat_</span>). Elle reste enregistrée sur ce téléphone uniquement.</p><form id="f-login"><div class="field"><label for="l-token">Clé GitHub</label><input id="l-token" type="password" autocomplete="off" spellcheck="false" required></div>'+(sheet.err?'<div class="notice" style="margin-top:10px">'+esc(sheet.err)+'</div>':'')+'<div class="actions"><button class="btn" id="s-close" type="button">Annuler</button><button class="btn primary" type="submit"'+(sheet.busy?' disabled':'')+'>'+(sheet.busy?'Vérification…':'Valider')+'</button></div></form>';
 } else if(sheet.mode==="cfg"){
  var cfg=cur().config;
  h+='<h3>Réglages</h3><div class="fgrid">'+fld("c-titre","Titre de la page",cfg.titre,"","full")+fld("c-inv","Date du dernier inventaire",cfg.inventaire,'placeholder="21/10/2026"')+'</div>';
  h+='<div class="actions"><button class="btn" id="s-close" type="button">Annuler</button><button class="btn primary" id="c-save" type="button">Valider</button></div>';
 } else {
  var it=sheet.mode==="add"?(sheet.seed||{statut:"dispo",nb:1}):(cur().items.filter(function(x){return x.id===sheet.id;})[0]||{});
  h+='<h3>'+(sheet.mode==="add"?"Ajouter du matériel":"Modifier")+'</h3><form id="f-item"><div class="fgrid">';
  h+=fld("f-designation","Désignation",it.designation,'list="dl-des" required',"full");
  h+=fld("f-marque","Marque",it.marque,'list="dl-mar"');
  h+=fld("f-ref","Référence",it.ref,"");
  h+=fld("f-energie","Énergie",it.energie,'list="dl-ene"');
  h+=fld("f-nb","Quantité",it.nb==null?1:it.nb,'type="number" min="1" inputmode="numeric"');
  h+=fld("f-annee","Année",it.annee,'placeholder="06/2024"');
  h+=fld("f-serie","N° de série",it.serie,"");
  h+='<div class="field"><label for="f-statut">État</label><select id="f-statut">'+ORDER.map(function(k){return '<option value="'+k+'"'+(it.statut===k?' selected':'')+'>'+ST[k]+'</option>';}).join("")+'</select></div>';
  h+=fld("f-localisation","Localisation",it.localisation,'list="dl-loc"');
  h+='<div class="field full"><label for="f-commentaire">Commentaire</label><textarea id="f-commentaire">'+esc(it.commentaire)+'</textarea></div>';
  h+='</div>'+dl("dl-des",uniq("designation"))+dl("dl-mar",uniq("marque"))+dl("dl-ene",uniq("energie"))+dl("dl-loc",uniq("localisation"));
  h+='<div class="actions"><div class="row">';
  if(sheet.mode==="edit")h+='<button class="btn danger'+(sheet.armed?' armed':'')+'" id="s-del" type="button">'+(sheet.armed?'Confirmer la suppression':'Supprimer')+'</button><button class="btn" id="s-dup" type="button">Dupliquer</button>';
  h+='</div><div class="row"><button class="btn" id="s-close" type="button">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div></div></form>';
 }
 return h+'</div></div>';
}

function drawQR(){
 var box=document.getElementById("qr");if(!box)return;
 if(typeof qrcode!=="function"){box.innerHTML='<p style="color:#333;margin:0">Le générateur de QR code n\'a pas pu se charger.</p>';return;}
 try{var q=qrcode(0,"M");q.addData(PAGE_URL);q.make();box.innerHTML=q.createSvgTag({cellSize:6,margin:0,scalable:true});}catch(e){box.textContent="QR indisponible";}
}

function readForm(){
 function v(id){var e=document.getElementById(id);return e?e.value.trim():"";}
 var nb=parseInt(v("f-nb"),10);
 return {designation:v("f-designation"),marque:v("f-marque"),ref:v("f-ref"),energie:v("f-energie"),nb:nb>0?nb:1,annee:v("f-annee"),serie:v("f-serie"),statut:v("f-statut")||"dispo",localisation:v("f-localisation"),commentaire:v("f-commentaire")};
}
function newId(){var max=0;cur().items.concat(DATA.items).forEach(function(i){var n=parseInt(String(i.id).replace(/\D/g,""),10);if(n>max)max=n;});return "m"+String(max+1).padStart(3,"0");}
function touch(){admin.draft.config.maj=today();}
function focusId(id){var e=document.getElementById(id);if(e)e.focus();}

/* ---------- GitHub ---------- */
var API="https://api.github.com/repos/"+REPO.owner+"/"+REPO.repo+"/contents/"+REPO.path;
function gh(method,body){
 var o={method:method,headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+admin.token,"X-GitHub-Api-Version":"2022-11-28"},cache:"no-store"};
 if(body){o.headers["Content-Type"]="application/json";o.body=JSON.stringify(body);}
 return fetch(API+(method==="GET"?"?ref="+REPO.branch+"&t="+Date.now():""),o).then(function(r){
  return r.json().catch(function(){return {};}).then(function(j){if(!r.ok){var e=new Error(j.message||("HTTP "+r.status));e.status=r.status;throw e;}return j;});
 });
}
function b64decode(s){var bin=atob(s.replace(/\n/g,""));var bytes=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder().decode(bytes);}
function b64encode(str){var bytes=new TextEncoder().encode(str),bin="";for(var i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(bin);}
function ghErr(e){
 if(e.status===401)return "Clé GitHub refusée ou expirée. Retirez-la et entrez-en une nouvelle.";
 if(e.status===403||e.status===404)return "Cette clé n'a pas le droit de modifier le dépôt electroportatif (vérifiez « Contents : Read and write »).";
 if(e.status===409)return "La liste a été modifiée par quelqu'un d'autre entre-temps. Rechargez la page (votre brouillon est gardé) puis publiez à nouveau.";
 return "La publication a échoué ("+e.message+"). Vérifiez la connexion et réessayez.";
}
function serialize(state){
 /* une ligne par matériel : lisible dans GitHub et historique clair */
 var lines=state.items.map(function(i){return "  "+JSON.stringify(i);});
 return '{\n"config":'+JSON.stringify(state.config)+',\n"items":[\n'+lines.join(",\n")+'\n]}\n';
}
function publish(){
 if(!admin.draft||admin.busy)return;
 admin.busy=true;admin.msg="";admin.ok="";render();
 var state=clone(admin.draft);state.config.maj=today();
 var n=changeCount();
 gh("GET").then(function(remote){
  if(SHA&&remote.sha!==SHA){var e=new Error("conflict");e.status=409;throw e;}
  return gh("PUT",{message:"Mise à jour du matériel ("+n+" modification"+(n>1?"s":"")+")",content:b64encode(serialize(state)),sha:remote.sha,branch:REPO.branch});
 }).then(function(res){
  DATA=state;SHA=res&&res.content?res.content.sha:null;
  admin.draft=null;lsSet(DKEY,null);admin.busy=false;
  admin.ok="Publié. L'équipe verra la mise à jour d'ici une minute environ.";
  render();
 }).catch(function(e){admin.busy=false;admin.msg=ghErr(e);render();});
}
function login(token){
 sheet.busy=true;sheet.err="";render();
 admin.token=token;
 gh("GET").then(function(remote){
  lsSet(TKEY,token);
  try{DATA=JSON.parse(b64decode(remote.content));SHA=remote.sha;}catch(e){}
  admin.on=true;sheet=null;restoreDraft();render();
 }).catch(function(e){
  admin.token="";sheet.busy=false;
  sheet.err=e.status===401?"Clé refusée par GitHub. Vérifiez que vous l'avez copiée en entier.":(e.status===403||e.status===404)?"Cette clé n'a pas accès au dépôt electroportatif.":"Vérification impossible ("+e.message+").";
  render();
 });
}
function restoreDraft(){
 var raw=lsGet(DKEY);if(!raw)return;
 try{var d=JSON.parse(raw);if(d&&d.items&&d.config){admin.draft=d;if(!changeCount()){admin.draft=null;lsSet(DKEY,null);}}}catch(e){}
}

/* ---------- événements ---------- */
app.addEventListener("click",function(e){
 var t=e.target.closest("button,a,.item,#sheet-bg");if(!t)return;
 if(t.id==="sheet-bg"){if(e.target===t&&!(sheet&&sheet.busy)){sheet=null;render();}return;}
 if(t.id==="reset"){e.preventDefault();ui={q:"",statut:"all",loc:"all"};render();return;}
 if(t.id==="b-retry"){load();return;}
 if(t.id==="b-qr"){sheet={mode:"qr"};render();return;}
 if(t.id==="b-admin"){
  if(admin.on){admin.on=false;render();return;}
  if(admin.token){admin.on=true;render();return;}
  sheet={mode:"login"};render();focusId("l-token");return;
 }
 if(t.id==="b-logout"){lsSet(TKEY,null);admin.token="";admin.on=false;render();return;}
 if(t.id==="b-add"){sheet={mode:"add"};render();focusId("f-designation");return;}
 if(t.id==="b-cfg"){sheet={mode:"cfg"};render();return;}
 if(t.id==="s-close"){sheet=null;render();return;}
 if(t.dataset&&t.dataset.st){ui.statut=(ui.statut===t.dataset.st?"all":t.dataset.st);render();return;}
 if(t.id==="c-save"){ensureDraft();var c=admin.draft.config;c.titre=document.getElementById("c-titre").value.trim()||"Électroportatif";c.inventaire=document.getElementById("c-inv").value.trim();touch();saveDraft();sheet=null;render();return;}
 if(t.id==="s-dup"){var seed=readForm();seed.serie="";sheet={mode:"add",seed:seed};render();focusId("f-designation");return;}
 if(t.id==="s-del"){
  if(!sheet.armed){sheet.armed=true;render();return;}
  ensureDraft();admin.draft.items=admin.draft.items.filter(function(i){return i.id!==sheet.id;});touch();saveDraft();sheet=null;render();return;
 }
 if(t.id==="b-discard"){admin.draft=null;lsSet(DKEY,null);admin.msg="";render();return;}
 if(t.id==="b-pub"){publish();return;}
 if(t.classList.contains("item")&&admin.on){sheet={mode:"edit",id:t.dataset.id};render();return;}
});
app.addEventListener("keydown",function(e){
 if(e.key==="Escape"&&sheet){sheet=null;render();return;}
 var t=e.target;if((e.key==="Enter"||e.key===" ")&&t.classList&&t.classList.contains("item")&&admin.on){e.preventDefault();sheet={mode:"edit",id:t.dataset.id};render();}
});
app.addEventListener("input",function(e){if(e.target.id==="q"){ui.q=e.target.value;render();}});
app.addEventListener("change",function(e){if(e.target.id==="loc"){ui.loc=e.target.value;render();}});
app.addEventListener("submit",function(e){
 e.preventDefault();
 if(e.target.id==="f-login"){var tk=document.getElementById("l-token").value.trim();if(tk)login(tk);return;}
 if(e.target.id!=="f-item")return;
 var f=readForm();if(!f.designation){focusId("f-designation");return;}
 ensureDraft();
 if(sheet.mode==="add"){f.id=newId();admin.draft.items.push(f);}
 else{admin.draft.items=admin.draft.items.map(function(i){if(i.id!==sheet.id)return i;f.id=i.id;return f;});}
 sortItems(admin.draft.items);touch();saveDraft();sheet=null;render();
});

/* ---------- chargement ---------- */
function load(){
 loadErr="";render();
 if(admin.token){
  gh("GET").then(function(remote){DATA=JSON.parse(b64decode(remote.content));SHA=remote.sha;restoreDraft();render();}).catch(loadPages);
  return;
 }
 loadPages();
}
function loadPages(){
 fetch("materiel.json?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
 .then(function(j){DATA=j;if(admin.token)restoreDraft();render();})
 .catch(function(){loadErr="Impossible de charger la liste du matériel. Vérifiez la connexion internet.";render();});
}
admin.token=lsGet(TKEY)||"";
load();
})();
