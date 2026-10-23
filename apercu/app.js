(function(){
"use strict";
/* ---------- sections ---------- */
var SECTIONS=[
 {id:"electroportatif",nom:"Électroportatif",file:"materiel.json",hint:"Machines, batteries, chargeurs…"},
 {id:"dstm",nom:"DSTM",file:"dstm.json",hint:"Matériel DSTM"},
 {id:"gipfs",nom:"GIPFS",file:"gipfs.json",hint:"Matériel GIPFS"}
];
var PREVIEW=location.pathname.indexOf("/apercu/")>-1;
var BASE=PREVIEW?"apercu/":"";
var KP=PREVIEW?"apercu-":"";
var REPO={owner:"alexislanon-collab",repo:"electroportatif",path:"",branch:"main"};
var PAGE_URL=location.origin+location.pathname;
var ST={dispo:"Disponible",sorti:"Sorti",verifier:"À vérifier",introuvable:"Introuvable",hs:"Réformé HS"};
var ORDER=["dispo","sorti","verifier","introuvable","hs"];
var TKEY="electro-gh-token";
function keysFor(sid){
 if(sid==="electroportatif"&&!PREVIEW)return {d:"electro-draft-v2",i:"electro-inv",o:"electro-open"};
 return {d:KP+"inv-"+sid+"-draft",i:KP+"inv-"+sid+"-inv",o:KP+"inv-"+sid+"-open"};
}
function secById(id){return SECTIONS.filter(function(s){return s.id===id;})[0]||null;}

var store={};
SECTIONS.forEach(function(s){
 var k=keysFor(s.id);
 store[s.id]={DATA:null,SHA:null,draft:null,err:"",
  INV:jget(k.i,null),openG:jget(k.o,{})||{}};
});
function jget(k,def){try{var v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch(e){return def;}}

/* état de la section courante (permuté à chaque changement de section) */
var view="home",curSid=null;
var DATA=null,SHA=null,INV=null,openG={};
var DKEY="",IKEY="",OKEY="";
var ui={q:"",statut:"all",loc:"all"};
var admin={on:false,token:"",draft:null,busy:false,msg:"",ok:"",arm:""};
var sheet=null;
var app=document.getElementById("app");

function saveCtx(){if(!curSid)return;var s=store[curSid];s.DATA=DATA;s.SHA=SHA;s.draft=admin.draft;s.INV=INV;s.openG=openG;}
function loadCtx(sid){
 saveCtx();curSid=sid;var s=store[sid],k=keysFor(sid),sec=secById(sid);
 DATA=s.DATA;SHA=s.SHA;admin.draft=s.draft;INV=s.INV;openG=s.openG;
 DKEY=k.d;IKEY=k.i;OKEY=k.o;REPO.path=BASE+sec.file;
}
function saveOpen(){try{localStorage.setItem(OKEY,JSON.stringify(openG));}catch(e){}}
function saveInv(){try{if(INV)localStorage.setItem(IKEY,JSON.stringify(INV));else localStorage.removeItem(IKEY);}catch(e){}}
function filtering(){return !!(ui.q.trim()||ui.statut!=="all"||ui.loc!=="all"||(invOn()&&INV.onlyTodo));}
function invOn(){return !!(admin.on&&INV&&view!=="home");}
function frToday(){var d=new Date();return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();}
function invStats(){var n=0,s=0;cur().items.forEach(function(i){n++;if(INV.seen[i.id])s++;});return {n:n,s:s};}
function endInventory(){
 ensureDraft();var found=0,miss=0;
 admin.draft.items.forEach(function(i){
  if(INV.seen[i.id]){found++;if(i.statut==="verifier"||i.statut==="introuvable"||i.statut==="sorti")i.statut="dispo";}
  else if(i.statut==="dispo"){i.statut="verifier";miss++;}
 });
 admin.draft.config.inventaire=frToday();touch();
 INV=null;saveInv();saveDraft();admin.arm="";
 admin.ok="Inventaire terminé : "+found+" ligne"+(found>1?"s":"")+" trouvée"+(found>1?"s":"")+", "+miss+" passée"+(miss>1?"s":"")+" en « À vérifier ». Contrôlez puis touchez « Publier pour l'équipe ».";
}

var I={
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
 pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
 qr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v1M14 20h1M17 17h4v4h-4"/></svg>',
 key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
 pdf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M12 11v6M9 14l3 3 3-3"/></svg>',
 cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>'
};

function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function norm(s){return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();}
function clone(o){return JSON.parse(JSON.stringify(o));}
function cur(){return admin.draft||DATA;}
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}}
function sortItems(a){a.sort(function(x,y){return norm(x.designation).localeCompare(norm(y.designation))||norm(x.marque).localeCompare(norm(y.marque))||norm(x.ref).localeCompare(norm(y.ref))||String(x.serie).localeCompare(String(y.serie));});}
function diffCount(base,draft){
 if(!draft||!base)return 0;
 var n=0,m={},ids={};base.items.forEach(function(i){m[i.id]=JSON.stringify(i);});
 draft.items.forEach(function(i){ids[i.id]=1;if(m[i.id]!==JSON.stringify(i))n++;});
 base.items.forEach(function(i){if(!ids[i.id])n++;});
 var a=clone(draft.config),b=clone(base.config);delete a.maj;delete b.maj;
 if(JSON.stringify(a)!==JSON.stringify(b))n++;
 return n;
}
function dirtyIds(){
 if(!admin.draft)return {};
 var o={},m={};DATA.items.forEach(function(i){m[i.id]=JSON.stringify(i);});
 admin.draft.items.forEach(function(i){if(m[i.id]!==JSON.stringify(i))o[i.id]=1;});
 return o;
}
function changeCount(){return diffCount(DATA,admin.draft);}
function ensureDraft(){if(!admin.draft)admin.draft=clone(DATA);}
function saveDraft(){lsSet(DKEY,changeCount()?JSON.stringify(admin.draft):null);}
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function frDate(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||"");return m?m[3]+"/"+m[2]+"/"+m[1]:(s||"");}
function pieces(items){return items.reduce(function(a,i){return a+(+i.nb||1);},0);}

function filtered(){
 var q=norm(ui.q).split(/\s+/).filter(Boolean);
 return cur().items.filter(function(i){
  if(invOn()&&INV.onlyTodo&&INV.seen[i.id])return false;
  if(ui.statut==="cmd"){if(!i.commander)return false;}
  else if(ui.statut!=="all"&&i.statut!==ui.statut)return false;
  if(ui.loc!=="all"&&(i.localisation||"")!==ui.loc)return false;
  if(!q.length)return true;
  var h=norm([i.designation,i.marque,i.ref,i.serie,i.energie,i.localisation,i.commentaire,i.annee,i.cmd_note].join(" "));
  return q.every(function(t){return h.indexOf(t)>-1;});
 });
}
function locs(){var s={};cur().items.forEach(function(i){s[i.localisation||""]=1;});return Object.keys(s).sort(function(a,b){if(!a)return 1;if(!b)return -1;return a.localeCompare(b);});}

/* ---------- rendu ---------- */
function header(title,sub,isSection){
 var h='<header class="top"><div class="wrap">';
 if(isSection)h+='<button class="back" id="b-home" type="button">'+I.back+'Accueil</button>';
 h+='<div class="hrow"><div><h1>'+esc(title)+'</h1>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div><div class="hbtns">';
 h+='<button class="btn" id="b-qr" type="button">'+I.qr+'QR code</button>';
 if(isSection)h+='<button class="btn" id="b-pdf" type="button">'+I.pdf+'PDF</button>';
 h+='<button class="btn'+(admin.on?' on':'')+'" id="b-admin" type="button" aria-pressed="'+admin.on+'">'+I.key+(admin.on?'Mode admin':'Admin')+'</button>';
 return h+'</div></div></div><div class="tape" aria-hidden="true"></div></header>';
}
function previewBanner(){return PREVIEW?'<div class="preview"><div class="wrap">Aperçu de la nouvelle version : les données ici sont une copie, la vraie page n\'est pas modifiée.</div></div>':'';}

function render(){
 var fa=document.activeElement,fid=fa&&fa.id,ss=fa&&fa.selectionStart;
 if(view==="home")renderHome();else renderSection();
 afterRender(fid,ss);
}

function renderHome(){
 saveCtx();
 var h=previewBanner()+header("Inventaire matériel","Choisissez une section",false)+'<main class="wrap"><div class="tiles">';
 SECTIONS.forEach(function(sec){
  var s=store[sec.id],d=s.draft||s.DATA;
  h+='<button type="button" class="tile" data-sec="'+sec.id+'"><span class="t-name">'+esc(sec.nom)+'</span>';
  if(!d){h+='<span class="t-sub">'+(s.err?'Chargement impossible':'Chargement…')+'</span>';}
  else{
   var it=d.items,ok=0,ver=0,intr=0,cmd=0;
   it.forEach(function(i){var c=+i.nb||1;if(i.statut==="dispo")ok+=c;if(i.statut==="verifier")ver++;if(i.statut==="introuvable")intr++;if(i.commander)cmd++;});
   if(!it.length)h+='<span class="t-sub">Aucun matériel pour l\'instant</span>';
   else h+='<span class="t-big"><b>'+ok+'</b> dispo / '+pieces(it)+' pièces</span><span class="t-sub">'+it.length+' lignes'+(d.config.inventaire?' · inventaire du '+esc(d.config.inventaire):'')+'</span>';
   var tags='';
   if(ver)tags+='<span class="pill p-verifier">'+ver+' à vérifier</span>';
   if(intr)tags+='<span class="pill p-introuvable">'+intr+' introuvable'+(intr>1?'s':'')+'</span>';
   if(cmd)tags+='<span class="pill p-cmd">'+cmd+' à commander</span>';
   if(admin.on&&s.INV)tags+='<span class="pill p-sorti">Inventaire en cours</span>';
   if(admin.on&&s.draft&&diffCount(s.DATA,s.draft))tags+='<span class="pill p-hs">Brouillon non publié</span>';
   if(tags)h+='<span class="t-tags">'+tags+'</span>';
  }
  h+='<span class="t-go" aria-hidden="true">'+I.arrow+'</span></button>';
 });
 h+='</div></main><footer class="wrap">Consultation libre · modifications réservées aux administrateurs</footer>';
 if(sheet)h+=renderSheet();
 app.innerHTML=h;
}

function renderSection(){
 var sec=secById(curSid),h=previewBanner();
 if(!DATA){
  var err=store[curSid].err;
  h+=header(sec.nom,"",true)+'<main class="wrap"><div class="empty">'+(err?esc(err)+' <br><br><button class="btn" id="b-retry" type="button">Réessayer</button>':'Chargement de la liste du matériel…')+'</div></main>';
  if(sheet)h+=renderSheet();
  app.innerHTML=h;return;
 }
 var d=cur(),items=d.items,cfg=d.config;
 var counts={};ORDER.forEach(function(k){counts[k]=0;});items.forEach(function(i){counts[i.statut]=(counts[i.statut]||0)+(+i.nb||1);});
 var ncmd=items.filter(function(i){return i.commander;}).length;
 var total=pieces(items);
 var f=filtered(),groups=[],gm={};
 f.forEach(function(i){var k=i.designation||"Sans désignation";if(!gm[k]){gm[k]={name:k,items:[]};groups.push(gm[k]);}gm[k].items.push(i);});
 var dirty=dirtyIds();
 var sub=(cfg.inventaire?'Inventaire du '+esc(cfg.inventaire)+' · ':'')+(cfg.maj?'mis à jour le '+esc(frDate(cfg.maj))+' · ':'')+total+' pièce'+(total>1?'s':'');
 h+=header(sec.nom,sub,true)+'<main class="wrap">';
 if(invOn()){
  var is=invStats(),pc=is.n?Math.round(is.s*100/is.n):0;
  h+='<section class="adminbar invbar"><h3>Inventaire en cours</h3><p>Commencé le '+esc(frDate(INV.start))+'. Cochez chaque matériel trouvé. Touchez une ligne pour changer son lieu ou son état. Vous pouvez fermer la page et reprendre plus tard sur ce téléphone.</p>';
  h+='<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="'+is.n+'" aria-valuenow="'+is.s+'"><span style="width:'+pc+'%"></span></div><div class="ptext"><b>'+is.s+'</b> / '+is.n+' lignes pointées</div>';
  h+='<div class="row"><button class="btn'+(INV.onlyTodo?' on':'')+'" id="b-inv-todo" type="button" aria-pressed="'+!!INV.onlyTodo+'">Seulement les non pointés</button><button class="btn" id="b-add" type="button">'+I.plus+'Ajouter</button></div>';
  if(admin.arm==="end")h+='<div class="notice">Le matériel coché passe en « Disponible ». Le matériel non coché qui était disponible passe en « À vérifier ». Le matériel sorti ou réformé HS non coché ne change pas.</div>';
  if(admin.arm==="cancel")h+='<div class="notice">Les coches seront effacées. Les modifications de lieu ou d\'état déjà faites restent en brouillon.</div>';
  h+='<div class="row"><button class="btn primary'+(admin.arm==="end"?' armed':'')+'" id="b-inv-end" type="button">'+(admin.arm==="end"?'Confirmer : terminer':'Terminer l\'inventaire')+'</button><button class="btn danger'+(admin.arm==="cancel"?' armed':'')+'" id="b-inv-cancel" type="button">'+(admin.arm==="cancel"?'Confirmer l\'abandon':'Abandonner')+'</button></div>';
  h+='</section>';
 } else if(admin.on){
  h+='<section class="adminbar"><h3>Administration · '+esc(sec.nom)+'</h3><p>Touchez une ligne pour la modifier. Vos changements restent en brouillon sur cet appareil jusqu\'à ce que vous les publiiez. L\'équipe les voit environ 1 minute après.</p>';
  h+='<div class="row"><button class="btn primary" id="b-add" type="button">'+I.plus+'Ajouter du matériel</button><button class="btn" id="b-inv-start" type="button">Démarrer un inventaire</button><button class="btn" id="b-cfg" type="button">Réglages</button><button class="btn" id="b-logout" type="button">Retirer ma clé</button></div>';
  if(admin.msg)h+='<div class="notice">'+esc(admin.msg)+'</div>';
  if(admin.ok)h+='<div class="notice ok">'+esc(admin.ok)+'</div>';
  h+='</section>';
 }
 if(!items.length){
  h+='<div class="empty"><p><b>Aucun matériel dans '+esc(sec.nom)+' pour l\'instant.</b></p><p>'+(admin.on?'Touchez « Ajouter du matériel » pour créer la première ligne, ou démarrez un inventaire et ajoutez au fur et à mesure.':'La liste sera bientôt complétée.')+'</p></div>';
 } else {
  h+='<div class="summary">';
  h+='<button type="button" class="stat" data-st="all" aria-pressed="'+(ui.statut==="all")+'"><b>'+total+'</b><span>Tout</span></button>';
  ORDER.forEach(function(k){if(!counts[k]&&k!=="dispo")return;h+='<button type="button" class="stat s-'+k+'" data-st="'+k+'" aria-pressed="'+(ui.statut===k)+'"><b>'+counts[k]+'</b><span>'+ST[k]+'</span></button>';});
  if(ncmd)h+='<button type="button" class="stat s-cmd" data-st="cmd" aria-pressed="'+(ui.statut==="cmd")+'"><b>'+ncmd+'</b><span>À commander</span></button>';
  h+='</div>';
  h+='<div class="filters"><div class="search">'+I.search+'<input id="q" type="search" placeholder="Chercher : boulonneuse, DTW, 3/4, TST…" value="'+esc(ui.q)+'" autocomplete="off" aria-label="Rechercher"></div>';
  h+='<select id="loc" aria-label="Localisation"><option value="all">Tous les lieux</option>';
  locs().forEach(function(l){h+='<option value="'+esc(l)+'"'+(ui.loc===l?' selected':'')+'>'+esc(l||"Lieu non renseigné")+'</option>';});
  h+='</select></div>';
  h+='<div class="count">'+f.length+' ligne'+(f.length>1?'s':'')+(filtering()?' affichée'+(f.length>1?'s':'')+' · <a href="#" id="reset">tout afficher</a>':' · <a href="#" id="open-all">tout ouvrir</a> · <a href="#" id="close-all">tout fermer</a>')+'</div>';
  if(!groups.length)h+='<div class="empty">Aucun matériel ne correspond à cette recherche.</div>';
 }
 groups.forEach(function(g){
  var n=0,ok=0;g.items.forEach(function(i){var c=+i.nb||1;n+=c;if(i.statut==="dispo")ok+=c;});
  var isOpen=filtering()||!!openG[g.name];
  var gs=0;if(invOn())g.items.forEach(function(i){if(INV.seen[i.id])gs++;});
  var gc=g.items.some(function(i){return i.commander;});
  h+='<section class="group"><button type="button" class="ghead" data-g="'+esc(g.name)+'" aria-expanded="'+isOpen+'"><span class="chev" aria-hidden="true"></span><h2>'+esc(g.name)+'</h2>'+(gc?'<span class="dot-cmd" title="Matériel à commander" aria-label="Matériel à commander"></span>':'')+(invOn()?'<small class="'+(gs===g.items.length?'done':'')+'"><b>'+gs+'</b> / '+g.items.length+' pointés</small>':'<small><b>'+ok+'</b> dispo / '+n+'</small>')+'</button>';
  if(!isOpen){h+='</section>';return;}
  h+='<ul class="items">';
  g.items.forEach(function(i){
   var title=[i.marque?'<span>'+esc(i.marque)+'</span>':'',i.ref?'<span class="mono">'+esc(i.ref)+'</span>':''].join("");
   if(!title)title='<span>'+esc(i.designation)+'</span>';
   var meta=[];
   if(i.energie)meta.push(esc(i.energie));
   if(i.annee)meta.push(esc(i.annee));
   if(i.serie)meta.push('N° <span class="mono">'+esc(i.serie)+'</span>');
   var seen=invOn()&&!!INV.seen[i.id];
   h+='<li class="item'+(admin.on?' edit':'')+(invOn()?' inv':'')+(seen?' seen':'')+(dirty[i.id]?' dirty':'')+'" data-id="'+esc(i.id)+'"'+(admin.on?' tabindex="0" role="button"':'')+'>'+(invOn()?'<button type="button" class="chk" data-chk="'+esc(i.id)+'" aria-pressed="'+seen+'" aria-label="'+(seen?'Trouvé':'Marquer comme trouvé')+'"></button>':'')+'<div class="it-main"><div class="it-title">'+title+((+i.nb||1)>1?'<span class="nb">×'+esc(i.nb)+'</span>':'')+'</div>';
   if(meta.length)h+='<div class="it-meta">'+meta.map(function(m){return '<span>'+m+'</span>';}).join("")+'</div>';
   if(i.commentaire)h+='<div class="it-com">'+esc(i.commentaire)+'</div>';
   if(i.commander)h+='<div class="it-cmd">'+I.cart+'À commander'+(i.cmd_note?' : '+esc(i.cmd_note):'')+'</div>';
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
 app.innerHTML=h;
}
function afterRender(fid,ss){
 if(fid){var el=document.getElementById(fid);if(el){el.focus();try{if(ss!=null)el.setSelectionRange(ss,ss);}catch(e){}}}
 if(sheet&&sheet.mode==="qr")drawQR();
}

function dl(id,vals){return '<datalist id="'+id+'">'+vals.map(function(v){return '<option value="'+esc(v)+'">';}).join("")+'</datalist>';}
function uniq(k){var s={};SECTIONS.forEach(function(sec){var st=store[sec.id],d=(sec.id===curSid?cur():(st.draft||st.DATA));if(d)d.items.forEach(function(i){if(i[k])s[i[k]]=1;});});return Object.keys(s).sort();}
function fld(id,label,val,extra,cls){return '<div class="field'+(cls?' '+cls:'')+'"><label for="'+id+'">'+label+'</label><input id="'+id+'" value="'+esc(val)+'" '+(extra||"")+'></div>';}
function qrUrl(){return PAGE_URL+(view!=="home"?"#"+curSid:"");}

function renderSheet(){
 var h='<div class="sheet-bg" id="sheet-bg"><div class="sheet" role="dialog" aria-modal="true">';
 if(sheet.mode==="qr"){
  var nm=view==="home"?"l'accueil":"la section "+secById(curSid).nom;
  h+='<h3>Accès rapide</h3><div class="qrbox"><div class="qr" id="qr"></div><p>Ce QR code ouvre directement '+esc(nm)+'. Scannez-le avec l\'appareil photo du téléphone.</p><code>'+esc(qrUrl())+'</code></div><div class="actions"><span></span><button class="btn primary" id="s-close" type="button">Fermer</button></div>';
 } else if(sheet.mode==="pdf"){
  var sec=secById(curSid),d=cur(),nc=d.items.filter(function(i){return i.commander;}).length;
  h+='<h3>Exporter en PDF</h3><p class="help">Le fichier reprend la liste de la section '+esc(sec.nom)+' telle qu\'elle est enregistrée'+(admin.draft?', brouillon compris':'')+'.</p><div class="choices">';
  h+='<button type="button" class="choice" id="p-inv"><b>Inventaire complet</b><span>'+d.items.length+' lignes, regroupées par type, avec état et lieu de rangement'+(invOn()?', et la colonne « Pointé » de l\'inventaire en cours':'')+'.</span></button>';
  h+='<button type="button" class="choice" id="p-cmd"'+(nc?'':' disabled')+'><b>Liste à commander</b><span>'+(nc?nc+' ligne'+(nc>1?'s':'')+' avec marque, référence et note de commande.':'Aucun matériel marqué « À commander ».')+'</span></button>';
  h+='</div>'+(sheet.err?'<div class="notice" style="margin-top:10px">'+esc(sheet.err)+'</div>':'')+(sheet.busy?'<p class="help" style="margin-top:10px">Préparation du PDF…</p>':'');
  h+='<div class="actions"><span></span><button class="btn" id="s-close" type="button">Fermer</button></div>';
 } else if(sheet.mode==="login"){
  h+='<h3>Accès admin</h3><p class="help">Collez votre clé GitHub (elle commence par <span class="mono">github_pat_</span>). Elle reste enregistrée sur ce téléphone uniquement.</p><form id="f-login"><div class="field"><label for="l-token">Clé GitHub</label><input id="l-token" type="password" autocomplete="off" spellcheck="false" required></div>'+(sheet.err?'<div class="notice" style="margin-top:10px">'+esc(sheet.err)+'</div>':'')+'<div class="actions"><button class="btn" id="s-close" type="button">Annuler</button><button class="btn primary" type="submit"'+(sheet.busy?' disabled':'')+'>'+(sheet.busy?'Vérification…':'Valider')+'</button></div></form>';
 } else if(sheet.mode==="cfg"){
  var cfg=cur().config;
  h+='<h3>Réglages</h3><div class="fgrid">'+fld("c-inv","Date du dernier inventaire",cfg.inventaire,'placeholder="21/10/2026"',"full")+'</div>';
  h+='<div class="actions"><button class="btn" id="s-close" type="button">Annuler</button><button class="btn primary" id="c-save" type="button">Valider</button></div>';
 } else {
  var it=sheet.mode==="add"?(sheet.seed||{statut:"dispo",nb:1}):(cur().items.filter(function(x){return x.id===sheet.id;})[0]||{});
  h+='<h3>'+(sheet.mode==="add"?"Ajouter du matériel":"Modifier")+'</h3><form id="f-item"><div class="fgrid">';
  h+=fld("f-designation","Désignation",it.designation,'list="dl-des" required',"full");
  h+=fld("f-marque","Marque",it.marque,'list="dl-mar"');
  h+=fld("f-ref","Référence",it.ref,"");
  h+=fld("f-energie","Énergie / caractéristique",it.energie,'list="dl-ene"');
  h+=fld("f-nb","Quantité",it.nb==null?1:it.nb,'type="number" min="1" inputmode="numeric"');
  h+=fld("f-annee","Année",it.annee,'placeholder="06/2024"');
  h+=fld("f-serie","N° de série",it.serie,"");
  h+='<div class="field"><label for="f-statut">État</label><select id="f-statut">'+ORDER.map(function(k){return '<option value="'+k+'"'+(it.statut===k?' selected':'')+'>'+ST[k]+'</option>';}).join("")+'</select></div>';
  h+=fld("f-localisation","Lieu de rangement",it.localisation,'list="dl-loc"');
  h+='<div class="field full"><label for="f-commentaire">Commentaire</label><textarea id="f-commentaire">'+esc(it.commentaire)+'</textarea></div>';
  h+='<div class="field full cmdbox"><label class="cb"><input type="checkbox" id="f-commander"'+(it.commander?' checked':'')+'> À commander</label><input id="f-cmd_note" value="'+esc(it.cmd_note)+'" placeholder="Ex. : 2 batteries 5 Ah, remplacer la lame…" aria-label="Note de commande"></div>';
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
 try{var q=qrcode(0,"M");q.addData(qrUrl());q.make();box.innerHTML=q.createSvgTag({cellSize:6,margin:0,scalable:true});}catch(e){box.textContent="QR indisponible";}
}

function readForm(){
 function v(id){var e=document.getElementById(id);return e?e.value.trim():"";}
 var nb=parseInt(v("f-nb"),10),cmd=document.getElementById("f-commander");
 var o={designation:v("f-designation"),marque:v("f-marque"),ref:v("f-ref"),energie:v("f-energie"),nb:nb>0?nb:1,annee:v("f-annee"),serie:v("f-serie"),statut:v("f-statut")||"dispo",localisation:v("f-localisation"),commentaire:v("f-commentaire")};
 if(cmd&&cmd.checked){o.commander=true;o.cmd_note=v("f-cmd_note");}
 return o;
}
function newId(){
 var pre=curSid==="electroportatif"?"m":curSid.charAt(0);
 var max=0;cur().items.concat(DATA.items).forEach(function(i){var n=parseInt(String(i.id).replace(/\D/g,""),10);if(n>max)max=n;});
 return pre+String(max+1).padStart(3,"0");
}
function touch(){admin.draft.config.maj=today();}
function focusId(id){var e=document.getElementById(id);if(e)e.focus();}

/* ---------- PDF ---------- */
var PDF_LIBS=["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js","https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"];
var pdfReady=null;
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement("script");s.src=src;s.onload=res;s.onerror=function(){rej(new Error("load"));};document.head.appendChild(s);});}
function loadPdf(){if(!pdfReady)pdfReady=loadScript(PDF_LIBS[0]).then(function(){return loadScript(PDF_LIBS[1]);}).catch(function(e){pdfReady=null;throw e;});return pdfReady;}
function pdfSafe(s){return String(s==null?"":s).replace(/[  ]/g," ").replace(/[^\x00-\xFFŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/g,"?");}
var PCOL={dispo:[31,122,77],sorti:[29,78,137],verifier:[154,91,0],introuvable:[180,35,24],hs:[95,107,119]};
function exportPdf(kind){
 var sec=secById(curSid),d=cur(),withInv=invOn()&&kind==="inv";
 sheet.busy=true;sheet.err="";render();
 loadPdf().then(function(){
  var J=window.jspdf.jsPDF,doc=new J({orientation:"landscape",unit:"mm",format:"a4"});
  var W=doc.internal.pageSize.getWidth();
  var items=d.items.slice();sortItems(items);
  if(kind==="cmd")items=items.filter(function(i){return i.commander;});
  doc.setFillColor(242,194,48);doc.rect(0,0,W,4,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(20,32,43);
  doc.text(pdfSafe((kind==="cmd"?"Matériel à commander – ":"Inventaire – ")+sec.nom),14,16);
  doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(86,99,112);
  var line="Édité le "+frToday();
  if(kind==="inv"){
   line+=(d.config.inventaire?"  ·  Dernier inventaire : "+d.config.inventaire:"")+"  ·  "+items.length+" lignes, "+pieces(items)+" pièces";
   var c={};items.forEach(function(i){c[i.statut]=(c[i.statut]||0)+(+i.nb||1);});
   line+="  ·  "+ORDER.filter(function(k){return c[k];}).map(function(k){return ST[k]+" : "+c[k];}).join("  ·  ");
   if(withInv){var st=invStats();line+="  ·  Inventaire en cours : "+st.s+"/"+st.n+" pointées";}
  } else line+="  ·  "+items.length+" ligne"+(items.length>1?"s":"");
  doc.text(pdfSafe(line),14,22);
  var head,body=[],cols;
  if(kind==="cmd"){
   head=[["Désignation","Marque","Référence","Qté en stock","Lieu","À commander"]];
   items.forEach(function(i){body.push([i.designation,i.marque,i.ref,String(+i.nb||1),i.localisation,i.cmd_note||"—"].map(pdfSafe));});
   cols={0:{cellWidth:50},1:{cellWidth:32},2:{cellWidth:45},3:{cellWidth:22,halign:"center"},4:{cellWidth:35}};
  } else {
   head=[["Marque","Référence","Énergie","N° de série","Année","Qté","État","Lieu","Commentaire"].concat(withInv?["Pointé"]:[])];
   var lastG=null;
   items.forEach(function(i){
    var g=i.designation||"Sans désignation";
    if(g!==lastG){
     var gi=items.filter(function(x){return (x.designation||"Sans désignation")===g;});
     var ok=gi.reduce(function(a,x){return a+(x.statut==="dispo"?(+x.nb||1):0);},0);
     body.push([{content:pdfSafe(g.toUpperCase()+"   ("+ok+" dispo / "+pieces(gi)+")"),colSpan:head[0].length,styles:{fillColor:[230,234,238],fontStyle:"bold",textColor:[20,32,43]}}]);
     lastG=g;
    }
    var com=i.commentaire||"";if(i.commander)com=(com?com+" · ":"")+"À commander"+(i.cmd_note?" : "+i.cmd_note:"");
    var row=[i.marque,i.ref,i.energie,i.serie,i.annee,String(+i.nb||1),ST[i.statut]||i.statut,i.localisation,com].map(pdfSafe);
    if(withInv)row.push(INV.seen[i.id]?"Oui":"");
    row._st=i.statut;body.push(row);
   });
   cols={0:{cellWidth:24},1:{cellWidth:38},2:{cellWidth:20},3:{cellWidth:28},4:{cellWidth:16},5:{cellWidth:10,halign:"center"},6:{cellWidth:22},7:{cellWidth:28}};
  }
  doc.autoTable({head:head,body:body,startY:27,margin:{left:14,right:14,bottom:14},theme:"grid",
   styles:{font:"helvetica",fontSize:8.5,cellPadding:1.6,lineColor:[211,218,225],lineWidth:0.2,textColor:[20,32,43],overflow:"linebreak"},
   headStyles:{fillColor:[20,32,43],textColor:[255,255,255],fontStyle:"bold"},
   columnStyles:cols,
   didParseCell:function(data){
    if(data.section==="body"&&kind==="inv"&&data.column.index===6&&data.row.raw&&data.row.raw._st){var c=PCOL[data.row.raw._st];if(c){data.cell.styles.textColor=c;data.cell.styles.fontStyle="bold";}}
   },
   didDrawPage:function(){
    doc.setFontSize(8);doc.setTextColor(86,99,112);
    doc.text(pdfSafe(sec.nom+" · page "+doc.internal.getNumberOfPages()),W-14,doc.internal.pageSize.getHeight()-7,{align:"right"});
   }
  });
  var fn=(kind==="cmd"?"a-commander-":"inventaire-")+sec.id+"-"+today()+".pdf";
  doc.save(fn);
  sheet=null;render();
 }).catch(function(){
  if(sheet){sheet.busy=false;sheet.err="Le PDF n'a pas pu être créé. Vérifiez la connexion internet et réessayez.";render();}
 });
}

/* ---------- GitHub ---------- */
function apiUrl(path){return "https://api.github.com/repos/"+REPO.owner+"/"+REPO.repo+"/contents/"+path;}
function gh(method,body,path){
 var o={method:method,headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+admin.token,"X-GitHub-Api-Version":"2022-11-28"},cache:"no-store"};
 if(body){o.headers["Content-Type"]="application/json";o.body=JSON.stringify(body);}
 return fetch(apiUrl(path||REPO.path)+(method==="GET"?"?ref="+REPO.branch+"&t="+Date.now():""),o).then(function(r){
  return r.json().catch(function(){return {};}).then(function(j){if(!r.ok){var e=new Error(j.message||("HTTP "+r.status));e.status=r.status;throw e;}return j;});
 });
}
function b64decode(s){var bin=atob(s.replace(/\n/g,""));var bytes=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder().decode(bytes);}
function b64encode(str){var bytes=new TextEncoder().encode(str),bin="";for(var i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(bin);}
function ghErr(e){
 if(e.status===401)return "Clé GitHub refusée ou expirée. Retirez-la et entrez-en une nouvelle.";
 if(e.status===403)return "Cette clé n'a pas le droit de modifier le dépôt electroportatif (vérifiez « Contents : Read and write »).";
 if(e.status===409)return "La liste a été modifiée par quelqu'un d'autre entre-temps. Rechargez la page (votre brouillon est gardé) puis publiez à nouveau.";
 return "La publication a échoué ("+e.message+"). Vérifiez la connexion et réessayez.";
}
function serialize(state){
 var lines=state.items.map(function(i){return "  "+JSON.stringify(i);});
 return '{\n"config":'+JSON.stringify(state.config)+',\n"items":[\n'+lines.join(",\n")+'\n]}\n';
}
function publish(){
 if(!admin.draft||admin.busy)return;
 var sid=curSid,sec=secById(sid);
 admin.busy=true;admin.msg="";admin.ok="";render();
 var state=clone(admin.draft);state.config.maj=today();
 var n=changeCount();
 gh("GET").then(function(remote){
  if(SHA&&remote.sha!==SHA){var e=new Error("conflict");e.status=409;throw e;}
  return remote.sha;
 },function(e){if(e.status===404&&!SHA)return null;throw e;}).then(function(sha){
  var body={message:sec.nom+" : mise à jour du matériel ("+n+" modification"+(n>1?"s":"")+")",content:b64encode(serialize(state)),branch:REPO.branch};
  if(sha)body.sha=sha;
  return gh("PUT",body);
 }).then(function(res){
  DATA=state;SHA=res&&res.content?res.content.sha:null;
  admin.draft=null;lsSet(DKEY,null);admin.busy=false;
  admin.ok="Publié. L'équipe verra la mise à jour d'ici une minute environ.";
  saveCtx();render();
 }).catch(function(e){admin.busy=false;admin.msg=ghErr(e);render();});
}
function login(token){
 sheet.busy=true;sheet.err="";render();
 admin.token=token;
 gh("GET",null,BASE+SECTIONS[0].file).then(function(){
  lsSet(TKEY,token);admin.on=true;sheet=null;loadAll();
 }).catch(function(e){
  admin.token="";sheet.busy=false;
  sheet.err=e.status===401?"Clé refusée par GitHub. Vérifiez que vous l'avez copiée en entier.":(e.status===403||e.status===404)?"Cette clé n'a pas accès au dépôt electroportatif.":"Vérification impossible ("+e.message+").";
  render();
 });
}
function restoreDraftFor(sid){
 var s=store[sid],raw=lsGet(keysFor(sid).d);if(!raw||!s.DATA)return;
 try{var d=JSON.parse(raw);if(d&&d.items&&d.config){if(diffCount(s.DATA,d))s.draft=d;else lsSet(keysFor(sid).d,null);}}catch(e){}
}

/* ---------- navigation ---------- */
function show(target){
 sheet=null;ui={q:"",statut:"all",loc:"all"};admin.msg="";admin.ok="";admin.arm="";
 if(target&&secById(target)){loadCtx(target);view=target;}
 else{saveCtx();view="home";}
 render();window.scrollTo(0,0);
}
function route(){var h=(location.hash||"").replace(/^#/,"");show(secById(h)?h:null);}
function goTo(sid){
 if(sid){if(location.hash==="#"+sid)route();else location.hash=sid;}
 else{try{history.pushState(null,"",location.pathname+location.search);}catch(e){}show(null);}
}
window.addEventListener("hashchange",route);
window.addEventListener("popstate",route);

/* ---------- événements ---------- */
app.addEventListener("click",function(e){
 var t=e.target.closest("button,a,.item,#sheet-bg");if(!t)return;
 if(t.id==="sheet-bg"){if(e.target===t&&!(sheet&&sheet.busy)){sheet=null;render();}return;}
 if(t.dataset&&t.dataset.sec){goTo(t.dataset.sec);return;}
 if(t.id==="b-home"){goTo(null);return;}
 if(t.dataset&&t.dataset.g!=null){if(filtering())return;var gname=t.dataset.g;if(openG[gname])delete openG[gname];else openG[gname]=1;saveOpen();render();var gb=document.querySelector('.ghead[data-g="'+CSS.escape(gname)+'"]');if(gb)gb.focus();return;}
 if(t.id==="open-all"){e.preventDefault();cur().items.forEach(function(i){openG[i.designation||"Sans désignation"]=1;});saveOpen();render();return;}
 if(t.id==="close-all"){e.preventDefault();openG={};saveOpen();render();return;}
 if(t.id==="reset"){e.preventDefault();ui={q:"",statut:"all",loc:"all"};render();return;}
 if(t.id==="b-retry"){loadAll();return;}
 if(t.id==="b-qr"){sheet={mode:"qr"};render();return;}
 if(t.id==="b-pdf"){sheet={mode:"pdf"};render();return;}
 if(t.id==="p-inv"){exportPdf("inv");return;}
 if(t.id==="p-cmd"){exportPdf("cmd");return;}
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
 if(t.id==="c-save"){ensureDraft();admin.draft.config.inventaire=document.getElementById("c-inv").value.trim();touch();saveDraft();sheet=null;render();return;}
 if(t.id==="s-dup"){var seed=readForm();seed.serie="";sheet={mode:"add",seed:seed};render();focusId("f-designation");return;}
 if(t.id==="s-del"){
  if(!sheet.armed){sheet.armed=true;render();return;}
  ensureDraft();admin.draft.items=admin.draft.items.filter(function(i){return i.id!==sheet.id;});touch();saveDraft();sheet=null;render();return;
 }
 if(t.dataset&&t.dataset.chk){var cid=t.dataset.chk;if(INV.seen[cid])delete INV.seen[cid];else INV.seen[cid]=1;saveInv();render();var cb=document.querySelector('.chk[data-chk="'+CSS.escape(cid)+'"]');if(cb)cb.focus();return;}
 if(t.id==="b-inv-start"){INV={start:today(),seen:{},onlyTodo:false};saveInv();admin.ok="";admin.msg="";admin.arm="";render();return;}
 if(t.id==="b-inv-todo"){INV.onlyTodo=!INV.onlyTodo;saveInv();render();return;}
 if(t.id==="b-inv-end"){if(admin.arm!=="end"){admin.arm="end";render();return;}endInventory();render();return;}
 if(t.id==="b-inv-cancel"){if(admin.arm!=="cancel"){admin.arm="cancel";render();return;}INV=null;saveInv();admin.arm="";render();return;}
 if(t.id==="b-discard"){admin.draft=null;lsSet(DKEY,null);admin.msg="";render();return;}
 if(t.id==="b-pub"){publish();return;}
 if(t.classList.contains("item")&&admin.on){sheet={mode:"edit",id:t.dataset.id};render();return;}
});
app.addEventListener("keydown",function(e){
 if(e.key==="Escape"&&sheet&&!sheet.busy){sheet=null;render();return;}
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
 if(sheet.mode==="add"){f.id=newId();admin.draft.items.push(f);if(INV){INV.seen[f.id]=1;saveInv();}}
 else{admin.draft.items=admin.draft.items.map(function(i){if(i.id!==sheet.id)return i;f.id=i.id;return f;});}
 sortItems(admin.draft.items);touch();saveDraft();sheet=null;render();
});

/* ---------- chargement ---------- */
function emptyData(sec){return {config:{titre:sec.nom,inventaire:"",maj:""},items:[]};}
function loadOne(sec){
 var s=store[sec.id];s.err="";
 function fromPages(){
  return fetch(sec.file+"?t="+Date.now(),{cache:"no-store"}).then(function(r){
   if(r.status===404)return emptyData(sec);
   if(!r.ok)throw new Error("HTTP "+r.status);return r.json();
  }).then(function(j){s.DATA=j;s.SHA=null;});
 }
 var p=admin.token?gh("GET",null,BASE+sec.file).then(function(remote){s.DATA=JSON.parse(b64decode(remote.content));s.SHA=remote.sha;},function(e){if(e.status===404){s.DATA=emptyData(sec);s.SHA=null;return;}return fromPages();}):fromPages();
 return p.then(function(){if(admin.token)restoreDraftFor(sec.id);}).catch(function(){s.err="Impossible de charger la liste. Vérifiez la connexion internet.";})
 .then(function(){if(curSid===sec.id){DATA=s.DATA;SHA=s.SHA;admin.draft=s.draft;}render();});
}
function loadAll(){
 SECTIONS.forEach(function(sec){var s=store[sec.id];s.DATA=null;s.draft=null;});
 if(curSid){DATA=null;admin.draft=null;}
 render();
 SECTIONS.forEach(loadOne);
}
admin.token=lsGet(TKEY)||"";
route();
loadAll();
})();
