(function(){
"use strict";
/* =====================================================================
   Inventaire matériel — une page, plusieurs sections.
   Chaque section a un « type » qui décrit ses colonnes, son état,
   ses filtres et son export PDF.
   ===================================================================== */

var RESULTS=[["Conforme","ok"],["Réformé","off"],["Réforme définitive","off"],["À faire réparer","warn"],["À envoyer au SERECT","out"],["Non présenté","warn"],["Prêt de matériel","out"],["Chargé dans le camion","out"],["-","none"]];
var RTONE={};RESULTS.forEach(function(r){RTONE[r[0]]=r[1];});

var TYPES={
 outil:{
  title:["marque","ref"],fallback:"designation",group:"designation",ok:"dispo",
  fields:[
   {k:"designation",l:"Désignation",dl:1,req:1,full:1},
   {k:"marque",l:"Marque",dl:1},
   {k:"ref",l:"Référence",mono:1},
   {k:"energie",l:"Énergie / caractéristique",dl:1,meta:1},
   {k:"nb",l:"Quantité",t:"num",def:1},
   {k:"annee",l:"Année",meta:1,ph:"06/2024"},
   {k:"serie",l:"N° de série",mono:1,meta:"N°"},
   {k:"statut",l:"État",t:"status"},
   {k:"localisation",l:"Lieu de rangement",dl:1,loc:1},
   {k:"commentaire",l:"Commentaire",t:"area",full:1}
  ],
  status:{key:"statut",opts:[["dispo","Disponible","ok"],["sorti","Sorti","out"],["verifier","À vérifier","warn"],["introuvable","Introuvable","bad"],["hs","Réformé HS","off"]],def:"dispo"},
  inv:{found:"dispo",missing:"verifier",from:["dispo"],reset:["verifier","introuvable","sorti"]},
  filters:[{k:"localisation",l:"Tous les lieux",empty:"Lieu non renseigné"}],
  pieces:"nb",
  pdf:[["marque","Marque",24],["ref","Référence",36],["energie","Énergie",20],["serie","N° de série",28],["annee","Année",16],["nb","Qté",10],["$status","État",22],["localisation","Lieu",28],["$com","Commentaire",0]]
 },
 mainta:{
  title:["description"],group:"description",groupFn:function(i){var d=String(i.description||"").replace(/\s*(nom\s*)?:.*$/i,"").trim();return d?norm(d).toUpperCase():"SANS DESCRIPTION";},ok:"conformes",
  fields:[
   {k:"description",l:"Description",req:1,full:1,dl:1},
   {k:"ft",l:"FT",dl:1,meta:1},
   {k:"icb",l:"N° ICB (EALICO)",mono:1,meta:"ICB"},
   {k:"cesar",l:"Code CESAR",meta:"CESAR"},
   {k:"serie",l:"N° de série",meta:"N°"},
   {k:"date_cr",l:"Date CR interne",meta:"CR"},
   {k:"ctrl",l:"Type de contrôle",t:"flags",full:1,opts:[["labo","Labo"],["ldv","Pers. qualifiée (LDV)"],["apave","APAVE"],["visuel","Examen visuel"],["metro","Labo métrologie"]]},
   {k:"res",l:"Retour labo",t:"results",full:1},
   {k:"commentaire",l:"Commentaire",t:"area",full:1}
  ],
  status:{fromResults:1,opts:RESULTS.map(function(r){return [r[0],r[0],r[1]];}).concat([["","Pas de résultat","none"]])},
  filters:[{k:"ft",l:"Toutes les FT",empty:"Sans FT",sort:"natural"},{k:"ctrl",l:"Tous les contrôles",flags:1},{results:1}],
  pdf:[["icb","ICB",23],["description","Description",58],["ft","FT",11],["cesar","CESAR",11],["$flags","Contrôle",17],["$years","",0],["$com","Commentaire",0]]
 },
 cordes:{
  title:["designation"],group:"designation",ok:"en service / en stock",
  fields:[
   {k:"designation",l:"Type de matériel",req:1,full:1,dl:1},
   {k:"icb",l:"N° DIA / ICB",mono:1,meta:"ICB"},
   {k:"categorie",l:"Catégorie",dl:1},
   {k:"ft",l:"N° FT",dl:1,meta:1},
   {k:"longueur",l:"Longueur (m)",meta:"L",unit:" m"},
   {k:"diametre",l:"Diamètre (mm)",meta:"Ø",unit:" mm"},
   {k:"couleur",l:"Couleur",dl:1,meta:1},
   {k:"nb",l:"Quantité"},
   {k:"mise_service",l:"Mise en service",meta:"MES"},
   {k:"fabrication",l:"Date de fabrication",meta:"Fab."},
   {k:"mainta",l:"MAINTA"},
   {k:"cesar",l:"Code CESAR",meta:"CESAR"},
   {k:"etat",l:"En stock / en service",t:"status"},
   {k:"res",l:"Contrôle réglementaire",t:"results",full:1},
   {k:"commentaire",l:"Commentaire",t:"area",full:1}
  ],
  status:{key:"etat",opts:[["En service","En service","ok"],["En stock","En stock","ok"],["À commander","À commander","warn"],["Réformé","Réformé","off"],["À supprimer","À supprimer","off"],["","Non renseigné","none"]],def:"En stock"},
  life:function(i){
   if(i.etat==="Réformé"||i.etat==="À supprimer")return null;
   var svc=i.etat==="En service",base=parseD(svc?i.mise_service:i.fabrication);
   if(!base)return {tone:"warn",k:"manq",txt:"Date "+(svc?"de mise en service":"de fabrication")+" manquante",rule:svc?"En service : 2 ans après la mise en service":"En stock : 5 ans après la fabrication"};
   var end=addM(base,svc?24:60),days=(end-new Date())/864e5,lab=String(end.getMonth()+1).padStart(2,"0")+"/"+end.getFullYear();
   var rule=svc?"En service : 2 ans après la mise en service ("+i.mise_service+")":"En stock : 5 ans après la fabrication ("+i.fabrication+")";
   if(days<0)return {tone:"bad",k:"perimee",txt:"Périmée depuis "+lab,lab:lab,rule:rule};
   if(days<183)return {tone:"warn",k:"bientot",txt:"Fin de vie "+lab,lab:lab,rule:rule};
   return {tone:"ok",k:"ok",txt:"Fin de vie "+lab,lab:lab,rule:rule};
  },
  autoCmd:function(i){var L=TYPES.cordes.life(i);if(!L)return "";if(L.k==="perimee")return "Corde périmée ("+L.lab+")";if(L.k==="bientot")return "Fin de vie "+L.lab;return "";},
  filters:[{life:1},{k:"ft",l:"Toutes les FT",empty:"Sans FT",sort:"natural"},{k:"categorie",l:"Toutes catégories"},{results:1}],
  pdf:[["designation","Type de matériel",48],["icb","ICB",24],["ft","FT",13],["longueur","Long.",11],["diametre","Ø",8],["couleur","Couleur",18],["mise_service","Mise en serv.",17],["fabrication","Fabric.",14],["$status","État",18],["$life","Fin de vie",24],["$years","",0],["$com","Commentaire",0]]
 },
 levage:{
  title:["description","carac"],group:"description",ok:"conformes",
  fields:[
   {k:"description",l:"Description",req:1,full:1,dl:1},
   {k:"carac",l:"Caractéristique (CMU, longueur…)"},
   {k:"icb",l:"N° ICB (EALICO)",mono:1,meta:"ICB"},
   {k:"serie",l:"N° de série",meta:"N°"},
   {k:"cesar",l:"Code CESAR",meta:"CESAR"},
   {k:"date_ctrl",l:"Date de contrôle",meta:"Contrôle"},
   {k:"cree",l:"Créé le"},
   {k:"ctrl",l:"Type de contrôle",t:"flags",full:1,opts:[["volontaire","Contrôle volontaire"],["apave","APAVE"]]},
   {k:"res_vol",l:"Résultat contrôle volontaire",t:"choice",opts:RESULTS.map(function(r){return r[0];}),meta:"Volontaire"},
   {k:"statut",l:"Statut du matériel",t:"status"},
   {k:"commentaire",l:"Commentaire",t:"area",full:1}
  ],
  status:{key:"statut",opts:[["Conforme","Conforme","ok"],["À réformer","À réformer","warn"],["À réparer","À réparer","warn"],["Manquant","Manquant","bad"],["Réformé","Réformé","off"],["Prêt de matériel","Prêt de matériel","out"],["","Non renseigné","none"]],def:""},
  filters:[{k:"ctrl",l:"Tous les contrôles",flags:1}],
  pdf:[["icb","ICB",30],["description","Description",62],["carac","Caract.",24],["serie","N° série",22],["cesar","CESAR",14],["date_ctrl","Date contrôle",20],["$flags","Contrôle",26],["$status","Statut",22],["$com","Commentaire",0]]
 },
 conso:{
  title:["designation"],group:"groupe",groupSort:"first",ok:"en stock",
  fields:[
   {k:"designation",l:"Article",req:1,full:1},
   {k:"groupe",l:"Famille",dl:1},
   {k:"qte",l:"Quantité en stock",ph:"Nombre ou « stock plein »"},
   {k:"mini",l:"Stock minimum",t:"num",ph:"Ex. : 5"},
   {k:"taille",l:"Taille",meta:"Taille"},
   {k:"ft",l:"N° FT",meta:1},
   {k:"commentaire",l:"Commentaire",t:"area",full:1}
  ],
  status:{derived:function(i){var q=i.qte;if(q===""||q==null)return "Non compté";var n=Number(q);if(isNaN(n))return "En stock";if(n<=0)return "Rupture";if(i.mini!==""&&i.mini!=null&&n<Number(i.mini))return "Stock bas";return "En stock";},
   opts:[["En stock","En stock","ok"],["Stock bas","Stock bas","warn"],["Rupture","Rupture","bad"],["Non compté","Non compté","none"]]},
  autoCmd:function(i,st){return st==="Rupture"?"Rupture de stock":st==="Stock bas"?"Stock bas (mini "+i.mini+")":"";},
  qty:function(i){return i.qte===""?"":String(i.qte);},
  pdf:[["designation","Article",70],["taille","Taille",30],["qte","Quantité",22],["mini","Mini",14],["$status","État",22],["$com","Commentaire",0]]
 },
 camion:{
  title:["designation"],group:"groupe",groupSort:"first",ok:"complets",
  fields:[
   {k:"designation",l:"Désignation / taille",req:1,full:1},
   {k:"groupe",l:"Famille",dl:1},
   {k:"qte_init",l:"Quantité prévue",t:"num"},
   {k:"qte",l:"Quantité présente",t:"num"},
   {k:"ref_facom",l:"Référence FACOM",mono:1,meta:"FACOM"},
   {k:"ref_dc",l:"Réf. Descours & Cabaud",meta:"D&C"},
   {k:"lien",l:"Lien fiche produit",t:"url",full:1},
   {k:"commentaire",l:"Commentaire",t:"area",full:1}
  ],
  status:{derived:function(i){if(i.qte_init===""||i.qte_init==null)return "Sans quantité";if(i.qte===""||i.qte==null)return "Non compté";return Number(i.qte)>=Number(i.qte_init)?"Complet":"Manquant";},
   opts:[["Complet","Complet","ok"],["Manquant","Manquant","bad"],["Non compté","Non compté","warn"],["Sans quantité","Sans quantité","none"]]},
  autoCmd:function(i,st){return st==="Manquant"?"Manque "+(Number(i.qte_init)-Number(i.qte)):"";},
  qty:function(i){return (i.qte===""?"?":i.qte)+(i.qte_init!==""?" / "+i.qte_init:"");},
  pieces:"qte_init",
  pdf:[["designation","Désignation",48],["qte_init","Prévu",14],["qte","Présent",14],["$miss","Manque",14],["ref_facom","Réf. FACOM",30],["ref_dc","Réf. D&C",34],["$status","État",22],["$com","Commentaire",0]]
 },
 conteneur:{
  title:["designation"],group:"designation",groupSort:"natural",ok:"complets",
  fields:[
   {k:"designation",l:"Désignation",req:1,full:1,dl:1},
   {k:"diametre",l:"Diamètre (mm)",meta:"Ø",unit:" mm"},
   {k:"cmu",l:"CMU",meta:"CMU"},
   {k:"longueur",l:"Longueur",meta:"L"},
   {k:"icb",l:"N° ICB (EALICO)",mono:1,meta:"ICB"},
   {k:"qte_init",l:"Quantité prévue",t:"num",def:1},
   {k:"qte",l:"Quantité présente",t:"num"},
   {k:"ref",l:"Référence / devis",meta:1},
   {k:"commentaire",l:"Commentaire",t:"area",full:1}
  ],
  status:{derived:function(i){if(i.qte_init===""||i.qte_init==null)return "À compléter";if(i.qte===""||i.qte==null)return "Non compté";return Number(i.qte)>=Number(i.qte_init)?"Complet":"Manquant";},
   opts:[["Complet","Complet","ok"],["Manquant","Manquant","bad"],["Non compté","Non compté","warn"],["À compléter","Quantité à compléter","none"]]},
  autoCmd:function(i,st){return st==="Manquant"?"Manque "+(Number(i.qte_init)-Number(i.qte)):"";},
  qty:function(i){if(i.qte_init===1)return "";return (i.qte===""?"?":i.qte)+(i.qte_init!==""?" / "+i.qte_init:"");},
  pieces:"qte_init",invQty:1,
  filters:[{missing:"icb",l:"Tous les ICB",lm:"ICB à saisir"}],
  pdf:[["designation","Désignation",62],["icb","ICB",28],["cmu","CMU",16],["qte_init","Prévu",13],["qte","Présent",13],["$miss","Manque",13],["$status","État",24],["$com","Commentaire",0]]
 },
 dotation:{
  title:["agent"],group:null,groupLabel:"Agents",noInventory:1,ok:"",
  fields:[
   {k:"agent",l:"Agent",req:1,full:1},
   {k:"chaussette",l:"Pointure chaussette",meta:"Chaussette"},
   {k:"chaussure",l:"Pointure chaussure",meta:"Chaussure"},
   {k:"combi",l:"Combi : taille de l'opérateur",meta:"Combi"},
   {k:"sous_combi",l:"Taille sous-combi",meta:"Sous-combi"},
   {k:"gants_cond",l:"Taille gants conducteurs",meta:"Gants cond."},
   {k:"gants_cuir",l:"Taille gants cuir",meta:"Gants cuir"},
   {k:"commentaire",l:"Commentaire",t:"area",full:1}
  ],
  status:null,
  pdf:[["agent","Agent",40],["chaussette","Chaussette",24],["chaussure","Chaussure",24],["combi","Combi",30],["sous_combi","Sous-combi",24],["gants_cond","Gants cond.",24],["gants_cuir","Gants cuir",24],["$com","Commentaire",0]]
 }
};

/* ---------- sections ---------- */
var SECTIONS=[
 {id:"electroportatif",nom:"Électroportatif",file:"materiel.json",type:"outil",pre:"m",hint:"Machines, batteries, chargeurs…"},
 {id:"dstm",nom:"DSTM",file:"dstm.json",type:"outil",pre:"d",hint:"Matériel DSTM"},
 {id:"gipfs-noir",nom:"Container noir",parent:"gipfs",file:"gipfs-noir.json",type:"conteneur",pre:"no"},
 {id:"gipfs-jaune",nom:"Container jaune",parent:"gipfs",file:"gipfs-jaune.json",type:"conteneur",pre:"ja"},
 {id:"gipfs-orange",nom:"Container orange",parent:"gipfs",file:"gipfs-orange.json",type:"conteneur",pre:"or"},
 {id:"gipfs-gris",nom:"Container gris",parent:"gipfs",file:"gipfs-gris.json",type:"conteneur",pre:"gr"},
 {id:"gipfs-violet",nom:"Container violet",parent:"gipfs",file:"gipfs-violet.json",type:"conteneur",pre:"vi"},
 {id:"gipfs-blanc",nom:"Container blanc",parent:"gipfs",file:"gipfs-blanc.json",type:"conteneur",pre:"bl"},
 {id:"tst-materiel",nom:"Matériel TST",parent:"tst",file:"tst-materiel.json",type:"mainta",pre:"t",hint:"Toutes les FT · contrôles et retours labo"},
 {id:"tst-cordes",nom:"Cordes, filins et butées à billes",parent:"tst",file:"tst-cordes.json",type:"cordes",pre:"r",hint:"Cordes, filins, butées · contrôles"},
 {id:"tst-levage",nom:"Levage",parent:"camion",file:"tst-levage.json",type:"levage",pre:"l",hint:"Estropes, manilles, poulies, palans"},
 {id:"tst-conso",nom:"Consommables",parent:"tst",file:"tst-consommables.json",type:"conso",pre:"c",hint:"EPI et consommables TST"},
 {id:"tst-camion",nom:"Outillage / inventaire",parent:"camion",file:"tst-camion.json",type:"camion",pre:"k",hint:"Douilles, clés, pinces, marteaux…"},
 {id:"tst-dotation",nom:"Dotation par agent",parent:"tst",file:"tst-dotation.json",type:"dotation",pre:"a",hint:"Tailles et pointures"}
];
var GROUPS=[{id:"gipfs",nom:"GIPFS",hint:"6 containers : noir, jaune, orange, gris, violet, blanc"},{id:"tst",nom:"TST",hint:"Matériel, cordes, camion, consommables, dotation"},{id:"camion",nom:"Camion",parent:"tst",hint:"Levage et outillage"}];
var HOME=["electroportatif","dstm","gipfs","tst"];
SECTIONS.push({id:"campagnes",nom:"Campagnes de contrôle",file:"tst-campagnes.json",type:"meta",hidden:1,pre:"z"});
TYPES.meta={title:[],fields:[],status:null,noInventory:1,pdf:[]};
var VIEWS=[{id:"campagne",nom:"Campagne de contrôle",parent:"tst",hint:"Chargement du camion, résultats, réparations"},{id:"aide",nom:"Mode d'emploi",hidden:1}];
function viewById(id){return VIEWS.filter(function(v){return v.id===id;})[0]||null;}
function grpById(id){return GROUPS.filter(function(g){return g.id===id;})[0]||null;}
function childrenOf(gid){var out=[];SECTIONS.forEach(function(s){if(s.parent===gid&&!s.hidden)out.push(s);});GROUPS.forEach(function(g){if(g.parent===gid)out.push(g);});VIEWS.forEach(function(v){if(v.parent===gid)out.push(v);});
 /* ordre d'affichage dans TST */var ord=["gipfs-noir","gipfs-jaune","gipfs-orange","gipfs-gris","gipfs-violet","gipfs-blanc","tst-materiel","tst-cordes","campagne","camion","tst-conso","tst-dotation","tst-levage","tst-camion"];out.sort(function(a,b){return ord.indexOf(a.id)-ord.indexOf(b.id);});return out;}
function sectionsUnder(gid){var out=[];childrenOf(gid).forEach(function(c){if(secById(c.id))out.push(c);else if(grpById(c.id))out=out.concat(sectionsUnder(c.id));});return out;}
function secById(id){return SECTIONS.filter(function(s){return s.id===id;})[0]||null;}

var PREVIEW=location.pathname.indexOf("/apercu/")>-1;
var BASE=PREVIEW?"apercu/":"";
var KP=PREVIEW?"apercu-":"";
var REPO={owner:"alexislanon-collab",repo:"electroportatif",path:"",branch:"main"};
var PAGE_URL=location.origin+location.pathname;
var TKEY="electro-gh-token";
function keysFor(sid){
 if(sid==="electroportatif"&&!PREVIEW)return {d:"electro-draft-v2",i:"electro-inv",o:"electro-open"};
 return {d:KP+"inv-"+sid+"-draft",i:KP+"inv-"+sid+"-inv",o:KP+"inv-"+sid+"-open"};
}
function jget(k,def){try{var v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch(e){return def;}}

var store={};
SECTIONS.forEach(function(s){var k=keysFor(s.id);store[s.id]={DATA:null,SHA:null,draft:null,err:"",INV:jget(k.i,null),openG:jget(k.o,{})||{}};});

/* état de la section courante */
var view="home",curSid=null,T=null;
var DATA=null,SHA=null,INV=null,openG={};
var DKEY="",IKEY="",OKEY="";
var ui=freshUi();
var admin={on:false,token:"",draft:null,busy:false,msg:"",ok:"",arm:""};
var sheet=null;
var app=document.getElementById("app");
function freshUi(){return {q:"",st:"all",f:{},ry:"",rv:"",lf:"",ct:""};}

function saveCtx(){if(!curSid)return;var s=store[curSid];s.DATA=DATA;s.SHA=SHA;s.draft=admin.draft;s.INV=INV;s.openG=openG;}
function loadCtx(sid){
 saveCtx();curSid=sid;var s=store[sid],k=keysFor(sid),sec=secById(sid);
 DATA=s.DATA;SHA=s.SHA;admin.draft=s.draft;INV=s.INV;openG=s.openG;T=TYPES[sec.type];
 DKEY=k.d;IKEY=k.i;OKEY=k.o;REPO.path=BASE+sec.file;
}
function saveOpen(){try{localStorage.setItem(OKEY,JSON.stringify(openG));}catch(e){}}
function saveInv(){try{if(INV)localStorage.setItem(IKEY,JSON.stringify(INV));else localStorage.removeItem(IKEY);}catch(e){}}

/* ---------- utilitaires ---------- */
var I={
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
 pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
 qr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v1M14 20h1M17 17h4v4h-4"/></svg>',
 key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
 pdf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M12 11v6M9 14l3 3 3-3"/></svg>',
 cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
 ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'
};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function norm(s){return String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();}
function clone(o){return JSON.parse(JSON.stringify(o));}
function cur(){return admin.draft||DATA;}
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}}
function natCmp(a,b){return String(a).localeCompare(String(b),"fr",{numeric:true,sensitivity:"base"});}
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function frToday(){var d=new Date();return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();}
function frDate(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||"");return m?m[3]+"/"+m[2]+"/"+m[1]:(s||"");}
function parseD(s){s=String(s||"").trim();var m=/^(\d{1,2})\/(\d{4})$/.exec(s);if(m)return new Date(+m[2],+m[1]-1,1);m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);if(m)return new Date(+m[3],+m[2]-1,+m[1]);return null;}
function addM(d,n){var x=new Date(d.getTime());x.setMonth(x.getMonth()+n);return x;}
function focusId(id){var e=document.getElementById(id);if(e)e.focus();}
function fieldBy(k){return T.fields.filter(function(f){return f.k===k;})[0];}
function flagLabel(k){var f=T.fields.filter(function(x){return x.t==="flags";})[0];if(!f)return k;var o=f.opts.filter(function(x){return x[0]===k;})[0];return o?o[1]:k;}
function years(d){return ((d||cur()).config.years||[]).slice().sort();}

/* ---------- logique par type ---------- */
function statusOfT(t,i,d){
 if(!t.status)return null;
 if(t.status.derived)return t.status.derived(i);
 if(t.status.fromResults){var ys=((d&&d.config.years)||[]).slice().sort().reverse();for(var n=0;n<ys.length;n++){var v=i.res&&i.res[ys[n]];if(v)return v;}return "";}
 return i[t.status.key]==null?"":i[t.status.key];
}
function statusOf(i){return statusOfT(T,i,cur());}
function stOpt(t,v){if(!t.status)return null;var o=t.status.opts.filter(function(x){return x[0]===v;})[0];return o||[v,v||"Non renseigné","none"];}
function toneOf(t,v){var o=stOpt(t,v);return o?o[2]:"none";}
function piecesOf(t,i){if(!t.pieces)return 1;var n=Number(i[t.pieces]);return isNaN(n)||i[t.pieces]===""?1:n;}
function orderInfo(t,i,d){
 var st=statusOfT(t,i,d),auto=t.autoCmd?t.autoCmd(i,st):"";
 if(i.commander)return {on:true,note:i.cmd_note||auto||""};
 if(auto)return {on:true,note:auto,auto:true};
 return {on:false};
}
function groupOf(i){if(T.groupFn)return T.groupFn(i);if(!T.group)return T.groupLabel||"Liste";var v=i[T.group];return v===""||v==null?(T.groupEmpty||"Sans désignation"):String(v);}
function titleOf(i){
 var parts=T.title.map(function(k){return i[k]?{k:k,v:i[k]}:null;}).filter(Boolean);
 if(!parts.length&&T.fallback)parts=[{k:T.fallback,v:i[T.fallback]}];
 return parts.map(function(p){var f=fieldBy(p.k);return '<span'+(f&&f.mono?' class="mono"':'')+'>'+esc(p.v)+'</span>';}).join("")||'<span>—</span>';
}
function titleText(i){var v=T.title.map(function(k){return i[k];}).filter(Boolean).join(" ");return v||(T.fallback?i[T.fallback]:"")||"";}
function sortItems(a){
 var gi={};a.forEach(function(i,n){var g=groupOf(i);if(!(g in gi))gi[g]=n;});if("Divers" in gi)gi["Divers"]=1e9;
 a.sort(function(x,y){
  var gx=groupOf(x),gy=groupOf(y);
  if(gx!==gy){if(T.groupSort==="first")return gi[gx]-gi[gy];return T.groupSort==="natural"?natCmp(gx,gy):norm(gx).localeCompare(norm(gy));}
  if(T.groupSort==="first")return 0;
  return natCmp(titleText(x),titleText(y))||String(x.serie||x.icb||"").localeCompare(String(y.serie||y.icb||""));
 });
}

/* ---------- brouillon ---------- */
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
function touch(){admin.draft.config.maj=today();}

/* ---------- inventaire ---------- */
function invOn(){return !!(admin.on&&INV&&secById(view)&&!T.noInventory);}
function invStats(){var n=0,s=0;cur().items.forEach(function(i){n++;if(INV.seen[i.id])s++;});return {n:n,s:s};}
function endInventory(){
 ensureDraft();var found=0,miss=0,inv=T.inv,d=today();
 admin.draft.items.forEach(function(i){
  if(T.invQty){if(INV.seen[i.id]){if(i.qte===""&&i.qte_init!=="")i.qte=i.qte_init;}else if(i.qte_init===1)i.qte=0;}
  if(INV.seen[i.id]){found++;i.vu=d;if(inv&&inv.reset.indexOf(i[T.status.key])>-1)i[T.status.key]=inv.found;}
  else{miss++;if(inv&&inv.from.indexOf(i[T.status.key])>-1)i[T.status.key]=inv.missing;}
 });
 admin.draft.config.inventaire=frToday();touch();
 INV=null;saveInv();saveDraft();admin.arm="";
 admin.ok="Inventaire terminé : "+found+" ligne"+(found>1?"s":"")+" trouvée"+(found>1?"s":"")+", "+miss+" non trouvée"+(miss>1?"s":"")+(inv?" (passées en « À vérifier » si elles étaient disponibles)":"")+". Contrôlez puis touchez « Publier pour l'équipe ».";
}

/* ---------- filtres ---------- */
function filtering(){
 if(ui.q.trim()||ui.st!=="all"||ui.rv||ui.lf)return true;
 for(var k in ui.f)if(ui.f[k])return true;
 return !!(invOn()&&INV.onlyTodo);
}
function hay(i){
 var p=[];T.fields.forEach(function(f){var v=i[f.k];if(v==null)return;if(f.t==="flags")p.push((v||[]).map(flagLabel).join(" "));else if(f.t==="results")for(var y in v)p.push(v[y]);else p.push(v);});
 p.push(i.cmd_note||"");return norm(p.join(" "));
}
function filtered(){
 var q=norm(ui.q).split(/\s+/).filter(Boolean),d=cur(),ry=ui.ry||String(years(d).slice(-1)[0]||"");
 return d.items.filter(function(i){
  if(invOn()&&INV.onlyTodo&&INV.seen[i.id])return false;
  if(ui.st==="$cmd"){if(!orderInfo(T,i,d).on)return false;}
  else if(ui.st!=="all"&&statusOf(i)!==ui.st)return false;
  for(var k in ui.f){var fv=ui.f[k];if(!fv)continue;var fd=fieldBy(k);
   if(k.indexOf("$miss_")===0){if(i[k.slice(6)])return false;continue;}
   if(fd&&fd.t==="flags"){if((i[k]||[]).indexOf(fv)<0)return false;}
   else if(String(i[k]==null?"":i[k])!==(fv==="$empty"?"":fv))return false;}
  if(ui.lf){var L=T.life&&T.life(i);if((L?L.k:"none")!==ui.lf)return false;}
  if(ui.rv){var rv=(i.res&&i.res[ry])||"";if(ui.rv==="$empty"?rv!=="":rv!==ui.rv)return false;}
  if(!q.length)return true;
  var h=hay(i),hc=h.replace(/[^a-z0-9]/g,"");return q.every(function(t){var tc=t.replace(/[^a-z0-9]/g,"");return h.indexOf(t)>-1||(tc&&hc.indexOf(tc)>-1);});
 });
}
function distinct(k){var s={};cur().items.forEach(function(i){var v=i[k];s[v==null?"":String(v)]=1;});return Object.keys(s);}

/* ---------- rendu ---------- */
function header(title,sub,isSection,backLabel){
 var h='<header class="top"><div class="wrap">';
 if(backLabel)h+='<button class="back" id="b-home" type="button">'+I.back+esc(backLabel)+'</button>';
 h+='<div class="hrow"><div class="htitle">'+(view==="home"?'<img class="hlogo" src="logo.png" alt="" width="58" height="66">':'')+'<div><h1>'+esc(title)+'</h1>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div></div><div class="hbtns">';
 h+='<button class="btn" id="b-help" type="button" aria-label="Mode d\'emploi">?</button><button class="btn" id="b-qr" type="button">'+I.qr+'QR code</button>';
 if(isSection)h+='<button class="btn" id="b-pdf" type="button">'+I.pdf+'PDF</button>';
 h+='<button class="btn'+(admin.on?' on':'')+'" id="b-admin" type="button" aria-pressed="'+admin.on+'">'+I.key+(admin.on?'Mode admin':'Admin')+'</button>';
 return h+'</div></div></div><div class="tape" aria-hidden="true"></div></header>';
}
function previewBanner(){return PREVIEW?'<div class="preview"><div class="wrap">Aperçu de la nouvelle version : les données ici sont une copie, la vraie page n\'est pas modifiée.</div></div>':'';}
function footer(){return '<footer class="wrap">Consultation libre · modifications réservées aux administrateurs</footer>';}

function render(){
 var fa=document.activeElement,fid=fa&&fa.id,ss=fa&&fa.selectionStart;
 if(view==="home")renderHome();else if(grpById(view))renderGroup();else if(view==="campagne")renderCamp();else if(view==="aide")renderHelp();else renderSection();
 afterRender(fid,ss);
}

function tileStats(secs){
 var r={loaded:true,err:false,ok:0,lines:0,pcs:0,tags:{},cmd:0,inv:false,draft:false,date:"",okWord:""};
 secs.forEach(function(sec){
  var s=store[sec.id],d=s.draft||s.DATA,t=TYPES[sec.type];
  if(!d){r.loaded=false;if(s.err)r.err=true;return;}
  if(secs.length===1)r.okWord=t.ok;
  d.items.forEach(function(i){
   r.lines++;r.pcs+=piecesOf(t,i);
   if(t.status){var st=statusOfT(t,i,d),tone=toneOf(t,st);
    if(tone==="ok")r.ok++;
    else if((tone==="warn"||tone==="bad")&&stOpt(t,st)[1]!=="À commander"){var lb=stOpt(t,st)[1];r.tags[lb]=r.tags[lb]||{n:0,tone:tone};r.tags[lb].n++;}}
   if(orderInfo(t,i,d).on)r.cmd++;
   if(t.life){var L=t.life(i);if(L&&(L.k==="perimee"||L.k==="bientot")){var lb2=L.k==="perimee"?"Périmées":"Fin de vie < 6 mois";r.tags[lb2]=r.tags[lb2]||{n:0,tone:L.tone};r.tags[lb2].n++;}}
  });
  if(s.INV)r.inv=true;if(s.draft&&diffCount(s.DATA,s.draft))r.draft=true;
  if(secs.length===1)r.date=d.config.inventaire||"";
 });
 return r;
}
function tileHtml(nom,secs,attr,hint){
 var r=tileStats(secs);
 var h='<button type="button" class="tile" '+attr+'><span class="t-name">'+esc(nom)+'</span>';
 if(!r.loaded&&!r.lines)h+='<span class="t-sub">'+(r.err?'Chargement impossible':'Chargement…')+'</span>';
 else if(!r.lines)h+='<span class="t-sub">'+(hint?esc(hint)+' · ':'')+'aucun matériel pour l\'instant</span>';
 else{
  if(r.okWord)h+='<span class="t-big"><b>'+r.ok+'</b> '+esc(r.okWord)+' / '+r.lines+' ligne'+(r.lines>1?'s':'')+'</span>';
  else h+='<span class="t-big"><b>'+r.lines+'</b> ligne'+(r.lines>1?'s':'')+'</span>';
  h+='<span class="t-sub">'+(hint?esc(hint):'')+(r.date?(hint?' · ':'')+'inventaire du '+esc(r.date):'')+'</span>';
 }
 var tags='',keys=Object.keys(r.tags).sort(function(a,b){return r.tags[b].n-r.tags[a].n;}).slice(0,3);
 keys.forEach(function(k){tags+='<span class="pill p-'+r.tags[k].tone+'">'+r.tags[k].n+' '+esc(k.toLowerCase())+'</span>';});
 if(r.cmd)tags+='<span class="pill p-cmd">'+r.cmd+' à commander</span>';
 if(admin.on&&r.inv)tags+='<span class="pill p-out">Inventaire en cours</span>';
 if(admin.on&&r.draft)tags+='<span class="pill p-off">Brouillon non publié</span>';
 if(tags)h+='<span class="t-tags">'+tags+'</span>';
 return h+'<span class="t-go" aria-hidden="true">'+I.arrow+'</span></button>';
}
function renderHome(){
 saveCtx();
 var h=previewBanner()+header("EEL Basse‑Seine","Inventaire matériel · choisissez une section",false,"")+'<main class="wrap"><div class="tiles">';
 HOME.forEach(function(id){
  var g=grpById(id);
  if(g)h+=tileHtml(g.nom,sectionsUnder(g.id),'data-sec="'+g.id+'"',g.hint);
  else{var sec=secById(id);h+=tileHtml(sec.nom,[sec],'data-sec="'+sec.id+'"',"");}
 });
 h+='</div></main>'+footer();
 if(sheet)h+=renderSheet();
 app.innerHTML=h;
}
function renderGroup(){
 saveCtx();
 var g=grpById(view);
 var h=previewBanner()+header(g.nom,"Choisissez une partie",false,g.parent?grpById(g.parent).nom:"Accueil")+'<main class="wrap"><div class="tiles">';
 childrenOf(g.id).forEach(function(c){h+=viewById(c.id)?campTile():tileHtml(c.nom,secById(c.id)?[c]:sectionsUnder(c.id),'data-sec="'+c.id+'"',secHint(c));});
 h+='</div></main>'+footer();
 if(sheet)h+=renderSheet();
 app.innerHTML=h;
}
function contDesc(cfg){return [cfg.taille,cfg.poids,cfg.ref?"réf. "+cfg.ref:""].filter(Boolean).join(" · ");}
function secHint(c){var sc=secById(c.id);if(!sc||sc.type!=="conteneur")return c.hint;var d=sdata(c.id);if(!d)return "";var t=contDesc(d.config),eq=d.config.equipement||[];return t+(eq.length?(t?" · ":"")+"équipé : "+eq.join(", ").toLowerCase():"");}
function backLabel(sec){return sec.parent?grpById(sec.parent).nom:"Accueil";}

function adminBar(sec){
 var h="";
 if(invOn()){
  var is=invStats(),pc=is.n?Math.round(is.s*100/is.n):0;
  h+='<section class="adminbar invbar"><h3>Inventaire en cours</h3><p>Commencé le '+esc(frDate(INV.start))+'. Cochez chaque matériel trouvé. Touchez une ligne pour corriger une information'+(T.status&&T.status.derived&&T.fields.some(function(f){return f.k==="qte";})?' ou la quantité présente':'')+'. Vous pouvez fermer la page et reprendre plus tard sur ce téléphone.</p>';
  h+='<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="'+is.n+'" aria-valuenow="'+is.s+'"><span style="width:'+pc+'%"></span></div><div class="ptext"><b>'+is.s+'</b> / '+is.n+' lignes pointées</div>';
  h+='<div class="row"><button class="btn'+(INV.onlyTodo?' on':'')+'" id="b-inv-todo" type="button" aria-pressed="'+!!INV.onlyTodo+'">Seulement les non pointés</button><button class="btn" id="b-add" type="button">'+I.plus+'Ajouter</button></div>';
  if(admin.arm==="end")h+='<div class="notice">'+(T.inv?'Le matériel coché passe en « Disponible ». Le matériel non coché qui était disponible passe en « À vérifier ». Le reste ne change pas.':'Le matériel coché reçoit la date du jour comme « vu le ». Les états et résultats ne sont pas modifiés.')+'</div>';
  if(admin.arm==="cancel")h+='<div class="notice">Les coches seront effacées. Les modifications déjà faites restent en brouillon.</div>';
  h+='<div class="row"><button class="btn primary'+(admin.arm==="end"?' armed':'')+'" id="b-inv-end" type="button">'+(admin.arm==="end"?'Confirmer : terminer':'Terminer l\'inventaire')+'</button><button class="btn danger'+(admin.arm==="cancel"?' armed':'')+'" id="b-inv-cancel" type="button">'+(admin.arm==="cancel"?'Confirmer l\'abandon':'Abandonner')+'</button></div>';
  return h+'</section>';
 }
 if(!admin.on)return "";
 var hasRes=T.fields.some(function(f){return f.t==="results";});
 h+='<section class="adminbar"><h3>Administration · '+esc(sec.nom)+'</h3><p>Touchez une ligne pour la modifier. Vos changements restent en brouillon sur cet appareil jusqu\'à ce que vous les publiiez. L\'équipe les voit environ 1 minute après.</p>';
 h+='<div class="row"><button class="btn primary" id="b-add" type="button">'+I.plus+'Ajouter</button>';
 if(!T.noInventory)h+='<button class="btn" id="b-inv-start" type="button">Démarrer un inventaire</button>';
 if(hasRes){var ny=(years().slice(-1)[0]||new Date().getFullYear()-1)+1;h+='<button class="btn'+(admin.arm==="year"?' armed-ok':'')+'" id="b-year" type="button">'+(admin.arm==="year"?'Confirmer : ajouter '+ny:'Nouvelle campagne '+ny)+'</button>';}
 h+='<button class="btn" id="b-cfg" type="button">Réglages</button><button class="btn" id="b-logout" type="button">Retirer ma clé</button></div>';
 if(admin.arm==="year")h+='<div class="notice">Une colonne « '+((years().slice(-1)[0]||0)+1)+' » vide sera ajoutée à chaque matériel. Les résultats des années précédentes sont conservés.</div>';
 if(admin.msg)h+='<div class="notice">'+esc(admin.msg)+'</div>';
 if(admin.ok)h+='<div class="notice ok">'+esc(admin.ok)+'</div>';
 return h+'</section>';
}

function filterBar(){
 var d=cur(),h='<div class="filters"><div class="search">'+I.search+'<input id="q" class="digits" type="search" autocorrect="off" spellcheck="false" placeholder="Chercher : nom, ICB, FT, référence…" value="'+esc(ui.q)+'" autocomplete="off" aria-label="Rechercher"></div>';
 (T.filters||[]).forEach(function(fl){
  if(fl.missing){var nm=d.items.filter(function(i){return !i[fl.missing];}).length;if(!nm&&!ui.f["$miss_"+fl.missing])return;
   h+='<select class="fsel" data-f="$miss_'+fl.missing+'" aria-label="'+esc(fl.l)+'"><option value="">'+esc(fl.l)+'</option><option value="1"'+(ui.f["$miss_"+fl.missing]?' selected':'')+'>'+esc(fl.lm)+' ('+nm+')</option></select>';return;}
  if(fl.life){
   var lc={};d.items.forEach(function(i){var L=T.life(i);var k=L?L.k:"none";lc[k]=(lc[k]||0)+1;});
   var lo=[["perimee","Périmées"],["bientot","Fin de vie dans moins de 6 mois"],["manq","Date manquante"],["ok","En règle"]];
   h+='<select id="f-lf" aria-label="Durée de vie"><option value="">Toutes les durées de vie</option>'+lo.filter(function(o){return lc[o[0]];}).map(function(o){return '<option value="'+o[0]+'"'+(ui.lf===o[0]?' selected':'')+'>'+o[1]+' ('+lc[o[0]]+')</option>';}).join("")+'</select>';
   return;
  }
  if(fl.results){
   var ys=years(d);if(!ys.length)return;
   var ry=ui.ry||String(ys[ys.length-1]);
   h+='<div class="fpair"><select id="f-ry" aria-label="Année de résultat">'+ys.slice().reverse().map(function(y){return '<option value="'+y+'"'+(String(y)===ry?' selected':'')+'>Résultat '+y+'</option>';}).join("")+'</select>';
   var vals={};d.items.forEach(function(i){var v=(i.res&&i.res[ry])||"";vals[v]=(vals[v]||0)+1;});
   h+='<select id="f-rv" aria-label="Valeur du résultat"><option value="">Tous les résultats</option>'+Object.keys(vals).sort(function(a,b){return (a===""?1:0)-(b===""?1:0)||natCmp(a,b);}).map(function(v){var key=v===""?"$empty":v;return '<option value="'+esc(key)+'"'+(ui.rv===key?' selected':'')+'>'+esc(v||"Pas de résultat")+' ('+vals[v]+')</option>';}).join("")+'</select></div>';
   return;
  }
  var cur_=ui.f[fl.k]||"",opts;
  if(fl.flags){var fd=fieldBy(fl.k),cnt={};d.items.forEach(function(i){(i[fl.k]||[]).forEach(function(x){cnt[x]=(cnt[x]||0)+1;});});
   opts=fd.opts.filter(function(o){return cnt[o[0]];}).map(function(o){return '<option value="'+o[0]+'"'+(cur_===o[0]?' selected':'')+'>'+esc(o[1])+' ('+cnt[o[0]]+')</option>';}).join("");}
  else{var vs=distinct(fl.k).sort(function(a,b){if(!a)return 1;if(!b)return -1;return fl.sort==="natural"?natCmp(a,b):a.localeCompare(b);});
   if(vs.length<2&&!cur_)return;
   opts=vs.map(function(v){var key=v===""?"$empty":v;return '<option value="'+esc(key)+'"'+(cur_===key?' selected':'')+'>'+esc(v||fl.empty||"Non renseigné")+'</option>';}).join("");}
  h+='<select class="fsel" data-f="'+fl.k+'" aria-label="'+esc(fl.l)+'"><option value="">'+esc(fl.l)+'</option>'+opts+'</select>';
 });
 return h+'</div>';
}

function summaryBar(items){
 var d=cur(),h='<div class="summary">',total=items.length;
 h+='<button type="button" class="stat" data-st="all" aria-pressed="'+(ui.st==="all")+'"><b>'+total+'</b><span>Tout</span></button>';
 if(T.status){
  var c={};items.forEach(function(i){var s=statusOf(i);c[s]=(c[s]||0)+1;});
  T.status.opts.forEach(function(o){if(!c[o[0]])return;h+='<button type="button" class="stat s-'+o[2]+'" data-st="'+esc(o[0])+'" aria-pressed="'+(ui.st===o[0])+'"><b>'+c[o[0]]+'</b><span>'+esc(o[1])+'</span></button>';});
  Object.keys(c).forEach(function(v){if(!T.status.opts.some(function(o){return o[0]===v;}))h+='<button type="button" class="stat" data-st="'+esc(v)+'" aria-pressed="'+(ui.st===v)+'"><b>'+c[v]+'</b><span>'+esc(v)+'</span></button>';});
 }
 var nc=items.filter(function(i){return orderInfo(T,i,d).on;}).length;
 var dup=T.status&&T.status.opts.some(function(o){return o[1]==="À commander";});
 if(nc)h+='<button type="button" class="stat s-cmd" data-st="$cmd" aria-pressed="'+(ui.st==="$cmd")+'"><b>'+nc+'</b><span>'+(dup?'Liste de commande':'À commander')+'</span></button>';
 return h+'</div>';
}

function itemHtml(i,dirty){
 var d=cur(),seen=invOn()&&!!INV.seen[i.id],meta=[],chips="";
 T.fields.forEach(function(f){
  var v=i[f.k];if(!f.meta||v==null||v==="")return;
  var lab=f.meta===1?"":f.meta+" ";
  meta.push(esc(lab)+(f.mono?'<span class="mono">'+esc(v)+'</span>':esc(v)+(f.unit&&/^[\d.,]+$/.test(String(v))?f.unit:"")));
 });
 if(i.vu)meta.push("Vu le "+esc(frDate(i.vu)));
 if(T===TYPES.conteneur&&!i.icb&&i.qte_init===1)chips+='<span class="res r-warn">ICB à saisir</span>';
 if(T.life){var LV=T.life(i);if(LV)chips+='<span class="res r-'+LV.tone+'">'+esc(LV.txt)+'</span>';}
 var ff=T.fields.filter(function(f){return f.t==="flags";})[0];
 if(ff&&(i[ff.k]||[]).length)chips+=(i[ff.k]||[]).map(function(x){return '<span class="chip">'+esc(flagLabel(x))+'</span>';}).join("");
 var rf=T.fields.filter(function(f){return f.t==="results";})[0],rh="";
 if(rf){var ys=years(d).slice().reverse().filter(function(y){return i.res&&i.res[y];}).slice(0,4);
  rh="";}
 var qty=T.qty?T.qty(i):(T.pieces==="nb"&&(+i.nb||1)>1?"×"+i.nb:"");
 var st=T.status?statusOf(i):null,o=orderInfo(T,i,d);
 var h='<li class="item edit'+(invOn()?' inv':'')+(seen?' seen':'')+(dirty[i.id]?' dirty':'')+'" data-id="'+esc(i.id)+'" tabindex="0" role="button">';
 if(invOn())h+='<button type="button" class="chk" data-chk="'+esc(i.id)+'" aria-pressed="'+seen+'" aria-label="'+(seen?'Trouvé':'Marquer comme trouvé')+'"></button>';
 h+='<div class="it-main"><div class="it-title">'+titleOf(i)+(qty?'<span class="nb">'+esc(qty)+'</span>':'')+'</div>';
 if(meta.length)h+='<div class="it-meta">'+meta.map(function(m){return '<span>'+m+'</span>';}).join("")+'</div>';
 if(chips||rh)h+='<div class="it-chips">'+chips+rh+'</div>';
 if(i.commentaire)h+='<div class="it-com">'+esc(i.commentaire)+'</div>';
 if(o.on)h+='<div class="it-cmd">'+I.cart+'À commander'+(o.note?' : '+esc(o.note):'')+'</div>';
 if(i.lien)h+='<a class="it-link" href="'+esc(i.lien)+'" target="_blank" rel="noopener">'+I.ext+'Fiche produit</a>';
 h+='</div><div class="it-side">';
 if(T.status){var so=stOpt(T,st);h+='<span class="pill p-'+so[2]+'">'+esc(so[1])+'</span>';}
 if(i.localisation)h+='<span class="loc">'+I.pin+esc(i.localisation)+'</span>';
 var ca=campActive();if(ca&&i.suivi&&i.suivi.c===campKey(ca)&&(i.suivi.e==="camion"||i.suivi.e==="reparation"))h+='<span class="pill p-'+ETAPES[i.suivi.e][1]+'">'+esc(ETAPES[i.suivi.e][0])+'</span>';
 return h+'</div></li>';
}

function renderSection(){
 var sec=secById(curSid),h=previewBanner();
 if(!DATA){
  var err=store[curSid].err;
  h+=header(sec.nom,"",true,backLabel(sec))+'<main class="wrap"><div class="empty">'+(err?esc(err)+' <br><br><button class="btn" id="b-retry" type="button">Réessayer</button>':'Chargement de la liste…')+'</div></main>';
  if(sheet)h+=renderSheet();
  app.innerHTML=h;return;
 }
 var d=cur(),items=d.items,cfg=d.config;
 var f=filtered(),groups=[],gm={};
 f.forEach(function(i){var k=groupOf(i);if(!gm[k]){gm[k]={name:k,items:[]};groups.push(gm[k]);}gm[k].items.push(i);});
 if(T.groupSort==="natural")groups.sort(function(a,b){return natCmp(a.name,b.name);});
 else if(T.groupSort==="first")groups.sort(function(a,b){return (a.name==="Divers")-(b.name==="Divers");});
 var dirty=dirtyIds();
 var sub=(cfg.inventaire?'Inventaire du '+esc(cfg.inventaire)+' · ':'')+(cfg.maj?'mis à jour le '+esc(frDate(cfg.maj))+' · ':'')+items.length+' ligne'+(items.length>1?'s':'');
 h+=header(sec.nom,sub,true,backLabel(sec))+'<main class="wrap">'+adminBar(sec);
 if(sec.type==="conteneur"){var cdsc=contDesc(cfg),ceq=cfg.equipement||[];h+='<section class="contbox"><div class="cdesc">'+(cdsc?esc(cdsc):'Référence, taille et poids à renseigner (Réglages)')+'</div>'+(ceq.length?'<div class="ceq"><b>Équipement du container :</b> '+ceq.map(esc).join(" · ")+'</div>':'')+'</section>';}
 if(cfg.dotation_type&&cfg.dotation_type.length)h+='<details class="info"><summary>Dotation type par agent (cordes)</summary><ul>'+cfg.dotation_type.map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul></details>';
 if(!items.length){
  h+='<div class="empty"><p><b>Aucun matériel dans '+esc(sec.nom)+' pour l\'instant.</b></p><p>'+(admin.on?'Touchez « Ajouter » pour créer la première ligne.':'La liste sera bientôt complétée.')+'</p></div>';
 } else {
  h+=summaryBar(items)+filterBar();
  var single=groups.length===1&&!T.group;
  h+='<div class="count">'+f.length+' ligne'+(f.length>1?'s':'')+(filtering()?' affichée'+(f.length>1?'s':'')+' · <a href="#" id="reset">tout afficher</a>':(single?'':' · <a href="#" id="open-all">tout ouvrir</a> · <a href="#" id="close-all">tout fermer</a>'))+'</div>';
  if(!groups.length)h+='<div class="empty">Aucun matériel ne correspond à cette recherche.</div>';
  groups.forEach(function(g){
   var n=g.items.length,ok=0;if(T.status)g.items.forEach(function(i){if(toneOf(T,statusOf(i))==="ok")ok++;});
   var isOpen=single||filtering()||!!openG[g.name];
   var gs=0;if(invOn())g.items.forEach(function(i){if(INV.seen[i.id])gs++;});
   var gc=g.items.some(function(i){return orderInfo(T,i,d).on;});
   var cnt=invOn()?'<small class="'+(gs===n?'done':'')+'"><b>'+gs+'</b> / '+n+' pointés</small>':(T.status?'<small><b>'+ok+'</b> '+esc(T.ok)+' / '+n+'</small>':'<small>'+n+'</small>');
   h+='<section class="group"><button type="button" class="ghead" data-g="'+esc(g.name)+'" aria-expanded="'+isOpen+'"><span class="chev" aria-hidden="true"></span><h2>'+esc(g.name)+'</h2>'+(gc?'<span class="dot-cmd" title="Matériel à commander"></span>':'')+cnt+'</button>';
   if(!isOpen){h+='</section>';return;}
   h+='<ul class="items">'+g.items.map(function(i){return itemHtml(i,dirty);}).join("")+'</ul></section>';
  });
 }
 h+='</main>'+footer();
 var cc=changeCount();
 if(admin.on&&cc)h+='<div class="spacer"></div><div class="pub" role="region" aria-label="Publication"><div class="wrap"><span>'+cc+' modification'+(cc>1?'s':'')+' en brouillon</span><div class="row"><button class="btn ghost" id="b-discard" type="button">Annuler tout</button><button class="btn" id="b-pub" type="button"'+(admin.busy?' disabled':'')+'>'+(admin.busy?'Publication…':'Publier pour l\'équipe')+'</button></div></div></div>';
 if(sheet)h+=renderSheet();
 app.innerHTML=h;
}
function afterRender(fid,ss){
 if(fid){var el=document.getElementById(fid);if(el){el.focus();try{if(ss!=null)el.setSelectionRange(ss,ss);}catch(e){}}}
 if(sheet&&sheet.mode==="qr")drawQR();
}

/* ---------- feuilles (formulaires) ---------- */
function dl(id,vals){return '<datalist id="'+id+'">'+vals.map(function(v){return '<option value="'+esc(v)+'">';}).join("")+'</datalist>';}
function uniq(k){var s={};cur().items.forEach(function(i){if(i[k]!=null&&i[k]!=="")s[i[k]]=1;});return Object.keys(s).sort(natCmp);}
function qrUrl(){return PAGE_URL+(view!=="home"?"#"+view:"");}

function formField(f,it){
 var id="f-"+f.k,v=it[f.k],cls='field'+(f.full||f.t==="area"||f.t==="flags"||f.t==="results"?' full':'');
 if(f.t==="area")return '<div class="'+cls+'"><label for="'+id+'">'+esc(f.l)+'</label><textarea id="'+id+'">'+esc(v)+'</textarea></div>';
 if(f.t==="status"){var so=T.status.opts.slice();if(v&&!so.some(function(o){return o[0]===v;}))so.push([v,v]);
  return '<div class="'+cls+'"><label for="'+id+'">'+esc(f.l)+'</label><select id="'+id+'">'+so.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(v==null?"":v)===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join("")+'</select></div>';}
 if(f.t==="choice"){var co=[""].concat(f.opts);if(v&&co.indexOf(v)<0)co.push(v);
  return '<div class="'+cls+'"><label for="'+id+'">'+esc(f.l)+'</label><select id="'+id+'">'+co.map(function(o){return '<option value="'+esc(o)+'"'+(String(v||"")===o?' selected':'')+'>'+esc(o||"—")+'</option>';}).join("")+'</select></div>';}
 if(f.t==="flags")return '<div class="'+cls+'"><span class="flabel">'+esc(f.l)+'</span><div class="flagbox">'+f.opts.map(function(o){return '<label class="cb"><input type="checkbox" data-flag="'+f.k+'" value="'+o[0]+'"'+((v||[]).indexOf(o[0])>-1?' checked':'')+'> '+esc(o[1])+'</label>';}).join("")+'</div></div>';
 if(f.t==="results"){var ys=years().slice().reverse();
  return '<div class="'+cls+'"><span class="flabel">'+esc(f.l)+'</span><div class="resgrid">'+ys.map(function(y){var rv=(v&&v[y])||"",ro=RESULTS.map(function(r){return r[0];});if(rv&&ro.indexOf(rv)<0)ro.push(rv);
   return '<label class="ry"><span>'+y+'</span><select data-res="'+y+'"><option value="">—</option>'+ro.map(function(o){return '<option value="'+esc(o)+'"'+(rv===o?' selected':'')+'>'+esc(o)+'</option>';}).join("")+'</select></label>';}).join("")+'</div></div>';}
 if(f.k==="icb"){
  var pc={};cur().items.forEach(function(x){var m=/^(.*-)\d+$/.exec(String(x.icb||""));if(m){var k=m[1].toUpperCase();pc[k]=(pc[k]||0)+1;}});
  var pre=Object.keys(pc).sort(function(a,b){return pc[b]-pc[a];}).slice(0,6);
  return '<div class="'+cls+'"><label for="'+id+'">'+esc(f.l)+'</label><input id="'+id+'" class="digits" inputmode="text" autocapitalize="characters" autocorrect="off" autocomplete="off" spellcheck="false" value="'+esc(v==null?"":v)+'" placeholder="Ex. : DIB1-0047800">'+(pre.length?'<div class="prechips">'+pre.map(function(x){return '<button type="button" class="chip prechip" data-pre="'+esc(x)+'">'+esc(x)+'</button>';}).join("")+'</div>':'')+'</div>';
 }
 var type=f.t==="num"?'type="number" inputmode="decimal"':f.t==="url"?'type="url" inputmode="url"':'';
 return '<div class="'+cls+'"><label for="'+id+'">'+esc(f.l)+'</label><input id="'+id+'" '+type+(/^(serie|cesar|ref|ref_facom|ref_dc|mainta)$/.test(f.k)?' class="digits" autocorrect="off" spellcheck="false"':'')+' value="'+esc(v==null?"":v)+'"'+(f.dl?' list="dl-'+f.k+'"':'')+(f.ph?' placeholder="'+esc(f.ph)+'"':'')+(f.req?' required':'')+'></div>';
}

function renderSheet(){
 var h='<div class="sheet-bg" id="sheet-bg"><div class="sheet" role="dialog" aria-modal="true">';
 if(sheet.mode==="qr"){
  var nm=view==="home"?"l'accueil":grpById(view)?"la partie "+grpById(view).nom:"la section "+secById(curSid).nom;
  h+='<h3>Accès rapide</h3><div class="qrbox"><div class="qr" id="qr"></div><p>Ce QR code ouvre directement '+esc(nm)+'. Scannez-le avec l\'appareil photo du téléphone.</p><code>'+esc(qrUrl())+'</code></div><div class="actions"><span></span><button class="btn primary" id="s-close" type="button">Fermer</button></div>';
 } else if(sheet.mode==="pdf"){
  var sec=secById(curSid),d=cur(),fl=filtered(),nc=d.items.filter(function(i){return orderInfo(T,i,d).on;}).length;
  h+='<h3>Exporter en PDF</h3><p class="help">Section '+esc(sec.nom)+(admin.draft?', brouillon compris':'')+'.</p><div class="choices">';
  h+='<button type="button" class="choice" id="p-inv"><b>Liste complète</b><span>'+d.items.length+' lignes, regroupées'+(T.fields.some(function(x){return x.t==="results";})?', avec les résultats de chaque année':'')+(invOn()?', et la colonne « Pointé » de l\'inventaire en cours':'')+'.</span></button>';
  if(filtering()&&fl.length!==d.items.length)h+='<button type="button" class="choice" id="p-flt"><b>Seulement l\'affichage filtré</b><span>'+fl.length+' lignes correspondant à la recherche et aux filtres en cours.</span></button>';
  h+='<button type="button" class="choice" id="p-cmd"'+(nc?'':' disabled')+'><b>Liste à commander</b><span>'+(nc?nc+' ligne'+(nc>1?'s':'')+' avec références et note de commande.':'Aucun matériel à commander.')+'</span></button>';
  h+='</div>'+(sheet.err?'<div class="notice" style="margin-top:10px">'+esc(sheet.err)+'</div>':'')+(sheet.busy?'<p class="help" style="margin-top:10px">Préparation du PDF…</p>':'');
  h+='<div class="actions"><span></span><button class="btn" id="s-close" type="button">Fermer</button></div>';
 } else if(sheet.mode==="pdf-camp"){
  h+='<h3>PDF de la campagne</h3><p class="help">Préparation du PDF…</p>';
 } else if(sheet.mode==="view"){
  var vi=cur().items.filter(function(x){return x.id===sheet.id;})[0]||{};
  h+='<h3 class="vtitle">'+esc(titleText(vi))+'</h3>';
  if(T.status){var vo=stOpt(T,statusOf(vi));h+='<p><span class="pill p-'+vo[2]+'">'+esc(vo[1])+'</span></p>';}
  h+='<dl class="fiche">';
  T.fields.forEach(function(f){
   var v=vi[f.k];
   if(f.t==="results"){var ys=years().slice().reverse();if(!ys.length)return;
    h+='<dt>'+esc(f.l)+'</dt><dd><table class="hist">'+ys.map(function(y){var r=(v&&v[y])||"";return '<tr><th>'+y+'</th><td class="'+(r?'r-'+(RTONE[r]||"none"):'muted')+'">'+esc(r||"—")+'</td></tr>';}).join("")+'</table></dd>';return;}
   if(f.t==="flags"){if(!(v||[]).length)return;h+='<dt>'+esc(f.l)+'</dt><dd>'+(v||[]).map(flagLabel).map(esc).join(", ")+'</dd>';return;}
   if(f.t==="status"||v==null||v==="")return;
   if(f.t==="url"){h+='<dt>'+esc(f.l)+'</dt><dd><a href="'+esc(v)+'" target="_blank" rel="noopener">Ouvrir la fiche produit</a></dd>';return;}
   h+='<dt>'+esc(f.l)+'</dt><dd'+(f.mono?' class="mono"':'')+'>'+esc(v)+(f.unit&&/^[\d.,]+$/.test(String(v))?f.unit:"")+'</dd>';
  });
  var vo2=orderInfo(T,vi,cur());if(vo2.on)h+='<dt>À commander</dt><dd>'+esc(vo2.note||"Oui")+'</dd>';
  if(T.life){var LF=T.life(vi);if(LF)h+='<dt>Fin de vie</dt><dd class="r-'+LF.tone+'"><b>'+esc(LF.txt)+'</b><br><small>'+esc(LF.rule)+'</small></dd>';}
  if(vi.suivi&&vi.suivi.c){h+='<dt>Dernière campagne</dt><dd>'+esc(campLabelKey(vi.suivi.c))+' : '+esc(ETAPES[vi.suivi.e||""][0])+(vi.suivi.r?' ('+esc(vi.suivi.r)+')':'')+(vi.suivi.dest?' · envoyé à '+esc(vi.suivi.dest):'')+'</dd>';}
  if(vi.vu)h+='<dt>Vu pour la dernière fois</dt><dd>'+esc(frDate(vi.vu))+'</dd>';
  h+='</dl><div class="actions"><span></span><button class="btn primary" id="s-close" type="button">Fermer</button></div>';
 } else if(sheet.mode==="login"){
  h+='<h3>Accès admin</h3><p class="help">Collez votre clé GitHub (elle commence par <span class="mono">github_pat_</span>). Elle reste enregistrée sur ce téléphone uniquement.</p><form id="f-login"><div class="field"><label for="l-token">Clé GitHub</label><input id="l-token" type="password" autocomplete="off" spellcheck="false" required></div>'+(sheet.err?'<div class="notice" style="margin-top:10px">'+esc(sheet.err)+'</div>':'')+'<div class="actions"><button class="btn" id="s-close" type="button">Annuler</button><button class="btn primary" type="submit"'+(sheet.busy?' disabled':'')+'>'+(sheet.busy?'Vérification…':'Valider')+'</button></div></form>';
 } else if(sheet.mode==="cfg"){
  var cfg=cur().config;
  h+='<h3>Réglages</h3><div class="fgrid"><div class="field full"><label for="c-inv">Date du dernier inventaire</label><input id="c-inv" value="'+esc(cfg.inventaire)+'" placeholder="21/10/2026"></div>';
  if(secById(curSid).type==="conteneur")h+='<div class="field full"><label for="c-ref">Référence du container</label><input id="c-ref" class="digits" value="'+esc(cfg.ref||"")+'"></div><div class="field"><label for="c-taille">Taille</label><input id="c-taille" value="'+esc(cfg.taille||"")+'" placeholder="10 pieds"></div><div class="field"><label for="c-poids">Poids / charge</label><input id="c-poids" value="'+esc(cfg.poids||"")+'" placeholder="6 t"></div><div class="field full"><label for="c-eq">Équipement du container (une ligne par élément)</label><textarea id="c-eq">'+esc((cfg.equipement||[]).join("\n"))+'</textarea></div>';
  h+='</div>';
  h+='<div class="actions"><button class="btn" id="s-close" type="button">Annuler</button><button class="btn primary" id="c-save" type="button">Valider</button></div>';
 } else {
  var it=sheet.mode==="add"?(sheet.seed||defaults()):(cur().items.filter(function(x){return x.id===sheet.id;})[0]||{});
  h+='<h3>'+(sheet.mode==="add"?"Ajouter":"Modifier")+'</h3><form id="f-item"><div class="fgrid">';
  h+=T.fields.map(function(f){return formField(f,it);}).join("");
  h+='<div class="field full cmdbox"><label class="cb"><input type="checkbox" id="f-commander"'+(it.commander?' checked':'')+'> À commander</label><input id="f-cmd_note" value="'+esc(it.cmd_note)+'" placeholder="Ex. : 2 unités, remplacer la lame…" aria-label="Note de commande"></div>';
  h+='</div>'+T.fields.filter(function(f){return f.dl;}).map(function(f){return dl("dl-"+f.k,uniq(f.k));}).join("");
  h+='<div class="actions"><div class="row">';
  if(sheet.mode==="edit")h+='<button class="btn danger'+(sheet.armed?' armed':'')+'" id="s-del" type="button">'+(sheet.armed?'Confirmer la suppression':'Supprimer')+'</button><button class="btn" id="s-dup" type="button">Dupliquer</button>';
  h+='</div><div class="row"><button class="btn" id="s-close" type="button">Annuler</button><button class="btn" type="submit" id="s-next">Enregistrer et suivant</button><button class="btn primary" type="submit">Enregistrer</button></div></div></form>';
 }
 return h+'</div></div>';
}
function defaults(){var o={};T.fields.forEach(function(f){o[f.k]=f.t==="flags"?[]:f.t==="results"?{}:(f.def!=null?f.def:"");});if(T.status&&T.status.key)o[T.status.key]=T.status.def||"";return o;}
function readForm(){
 var o={};
 T.fields.forEach(function(f){
  if(f.t==="flags"){o[f.k]=[].slice.call(document.querySelectorAll('input[data-flag="'+f.k+'"]:checked')).map(function(x){return x.value;});return;}
  if(f.t==="results"){var r={};[].slice.call(document.querySelectorAll('select[data-res]')).forEach(function(s){if(s.value)r[s.dataset.res]=s.value;});o[f.k]=r;return;}
  var e=document.getElementById("f-"+f.k),v=e?e.value.trim():"";
  if(f.t==="num"&&v!==""){var n=Number(v.replace(",","."));v=isNaN(n)?v:n;}
  else if(f.k==="qte"&&v!==""&&!isNaN(Number(v)))v=Number(v);
  o[f.k]=v;
 });
 var cmd=document.getElementById("f-commander");
 if(cmd&&cmd.checked){o.commander=true;o.cmd_note=(document.getElementById("f-cmd_note").value||"").trim();}
 return o;
}
function newId(){
 var sc=secById(curSid),max=0;cur().items.concat(DATA.items).forEach(function(i){var n=parseInt(String(i.id).replace(/\D/g,""),10);if(n>max)max=n;});
 return sc.pre+String(max+1).padStart(3,"0");
}
function drawQR(){
 var box=document.getElementById("qr");if(!box)return;
 if(typeof qrcode!=="function"){box.innerHTML='<p style="color:#333;margin:0">Le générateur de QR code n\'a pas pu se charger.</p>';return;}
 try{var q=qrcode(0,"M");q.addData(qrUrl());q.make();box.innerHTML=q.createSvgTag({cellSize:6,margin:0,scalable:true});}catch(e){box.textContent="QR indisponible";}
}

/* ---------- PDF ---------- */
var PDF_LIBS=["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js","https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"];
var pdfReady=null;
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement("script");s.src=src;s.onload=res;s.onerror=function(){rej(new Error("load"));};document.head.appendChild(s);});}
function loadPdf(){if(!pdfReady)pdfReady=loadScript(PDF_LIBS[0]).then(function(){return loadScript(PDF_LIBS[1]);}).catch(function(e){pdfReady=null;throw e;});return pdfReady;}
function pdfSafe(s){return String(s==null?"":s).replace(/[  ]/g," ").replace(/[^\x00-\xFFŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/g,"?");}
var PTONE={ok:[31,122,77],warn:[154,91,0],bad:[180,35,24],off:[95,107,119],out:[29,78,137],none:[95,107,119]};
function exportPdf(kind){
 var sec=secById(curSid),d=cur(),withInv=invOn()&&kind!=="cmd";
 sheet.busy=true;sheet.err="";render();
 loadPdf().then(function(){
  var J=window.jspdf.jsPDF,doc=new J({orientation:"landscape",unit:"mm",format:"a4"});
  var W=doc.internal.pageSize.getWidth();
  var items=(kind==="flt"?filtered():d.items).slice();sortItems(items);
  if(kind==="cmd")items=items.filter(function(i){return orderInfo(T,i,d).on;});
  doc.setFillColor(242,194,48);doc.rect(0,0,W,4,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(20,32,43);
  var title=(kind==="cmd"?"Matériel à commander – ":"Inventaire – ")+(sec.parent?grpById(sec.parent).nom+" · ":"")+sec.nom;
  doc.text(pdfSafe(title),14,16);
  doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(86,99,112);
  var line="Édité le "+frToday()+"  ·  "+items.length+" ligne"+(items.length>1?"s":"");
  if(kind!=="cmd"){
   if(d.config.inventaire)line+="  ·  Dernier inventaire : "+d.config.inventaire;
   if(T.status){var c={};items.forEach(function(i){var s=stOpt(T,statusOf(i))[1];c[s]=(c[s]||0)+1;});line+="  ·  "+Object.keys(c).map(function(k){return k+" : "+c[k];}).join("  ·  ");}
   if(kind==="flt"){var fx=[];if(ui.q)fx.push("recherche « "+ui.q+" »");for(var k in ui.f)if(ui.f[k]){if(k.indexOf("$miss_")===0){fx.push("ICB à saisir");continue;}var fd=fieldBy(k);fx.push((fd?fd.l:k)+" : "+(fd&&fd.t==="flags"?flagLabel(ui.f[k]):ui.f[k]==="$empty"?"vide":ui.f[k]));}
    if(ui.rv)fx.push("résultat "+(ui.ry||years().slice(-1)[0])+" : "+(ui.rv==="$empty"?"aucun":ui.rv));if(ui.st!=="all")fx.push("état : "+(ui.st==="$cmd"?"à commander":stOpt(T,ui.st)[1]));
    if(fx.length)line+="  ·  Filtre : "+fx.join(", ");}
   if(withInv){var st=invStats();line+="  ·  Inventaire en cours : "+st.s+"/"+st.n+" pointées";}
  }
  doc.text(doc.splitTextToSize(pdfSafe(line),W-28),14,22);
  var cols=[];
  if(kind==="cmd"){
   cols.push({h:"Désignation",w:62,g:function(i){return titleText(i)+(T.group&&T.group!==T.title[0]&&groupOf(i)?" ("+groupOf(i)+")":"");}});
   T.fields.forEach(function(f){if(/ref|icb|ft|carac|taille/.test(f.k)&&f.k!==T.title[0]&&f.k!==T.title[1])cols.push({h:f.l,w:26,g:function(i){return i[f.k];}});});
   if(T.qty)cols.push({h:"Quantité",w:16,g:function(i){return T.qty(i);}});
   cols.push({h:"À commander",w:T.fields.some(function(f){return f.k==="lien";})?30:0,g:function(i){return orderInfo(T,i,d).note||"—";}});
   if(T.fields.some(function(f){return f.k==="lien";}))cols.push({h:"Lien",w:0,g:function(i){return i.lien||"";},small:1});
  } else {
   T.pdf.forEach(function(p){
    var k=p[0];
    if(k==="$years"){years().forEach(function(y){cols.push({h:String(y),w:15.5,g:function(i){return (i.res&&i.res[y])||"";},res:1});});return;}
    if(k==="$status")cols.push({h:p[1],w:p[2],g:function(i){return stOpt(T,statusOf(i))[1];},st:1});
    else if(k==="$flags")cols.push({h:p[1],w:p[2],g:function(i){return (i.ctrl||[]).map(flagLabel).join(", ");}});
    else if(k==="$life")cols.push({h:p[1],w:p[2],g:function(i){var L=T.life(i);return L?L.txt:"";},life:1});
    else if(k==="$miss")cols.push({h:p[1],w:p[2],g:function(i){var m=Number(i.qte_init)-Number(i.qte);return i.qte===""||i.qte_init===""||isNaN(m)||m<=0?"":String(m);}});
    else if(k==="$com")cols.push({h:p[1],w:0,g:function(i){var c=i.commentaire||"",o=orderInfo(T,i,d);if(o.on)c=(c?c+" · ":"")+"À commander"+(o.note?" : "+o.note:"");if(i.vu)c=(c?c+" · ":"")+"Vu le "+frDate(i.vu);return c;}});
    else cols.push({h:p[1],w:p[2],g:function(i){return i[k];}});
   });
   if(withInv)cols.push({h:"Pointé",w:13,g:function(i){return INV.seen[i.id]?"Oui":"";}});
  }
  var head=[cols.map(function(c){return pdfSafe(c.h);})],body=[],lastG=null;
  items.forEach(function(i){
   var g=groupOf(i);
   if(T.group&&g!==lastG&&kind!=="cmd"){body.push([{content:pdfSafe(g.toUpperCase()),colSpan:cols.length,styles:{fillColor:[230,234,238],fontStyle:"bold",textColor:[20,32,43]}}]);lastG=g;}
   var row=cols.map(function(c){var v=c.g(i);return pdfSafe(v==null?"":v);});
   row._i=i;body.push(row);
  });
  var cs={};cols.forEach(function(c,n){cs[n]={};if(c.w)cs[n].cellWidth=c.w;if(c.small)cs[n].fontSize=6.5;});
  doc.autoTable({head:head,body:body,startY:28,margin:{left:10,right:10,bottom:14},theme:"grid",
   styles:{font:"helvetica",fontSize:7.6,cellPadding:1.4,lineColor:[211,218,225],lineWidth:0.2,textColor:[20,32,43],overflow:"linebreak"},
   headStyles:{fillColor:[20,32,43],textColor:[255,255,255],fontStyle:"bold",fontSize:7.6},
   columnStyles:cs,
   didParseCell:function(data){
    if(data.section!=="body"||!data.row.raw||!data.row.raw._i)return;var c=cols[data.column.index];if(!c)return;
    if(c.st){var tn=toneOf(T,statusOf(data.row.raw._i));data.cell.styles.textColor=PTONE[tn];data.cell.styles.fontStyle="bold";}
    if(c.life){var L=T.life(data.row.raw._i);if(L){data.cell.styles.textColor=PTONE[L.tone];if(L.tone!=="ok")data.cell.styles.fontStyle="bold";}}
    if(c.res){var v=data.cell.raw;if(v){data.cell.styles.textColor=PTONE[RTONE[v]||"none"];if(RTONE[v]!=="ok")data.cell.styles.fontStyle="bold";}}
   },
   didDrawPage:function(){doc.setFontSize(8);doc.setTextColor(86,99,112);doc.text(pdfSafe(sec.nom+" · page "+doc.internal.getNumberOfPages()),W-10,doc.internal.pageSize.getHeight()-7,{align:"right"});}
  });
  doc.save((kind==="cmd"?"a-commander-":"inventaire-")+sec.id+(kind==="flt"?"-filtre":"")+"-"+today()+".pdf");
  sheet=null;render();
 }).catch(function(){if(sheet){sheet.busy=false;sheet.err="Le PDF n'a pas pu être créé. Vérifiez la connexion internet et réessayez.";render();}});
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
function publishSec(sid){
 var s=store[sid],sec=secById(sid),state=clone(s.draft),n=diffCount(s.DATA,s.draft),path=BASE+sec.file;
 state.config.maj=today();
 return gh("GET",null,path).then(function(remote){
  if(s.SHA&&remote.sha!==s.SHA){var e=new Error("conflict");e.status=409;throw e;}
  return remote.sha;
 },function(e){if(e.status===404&&!s.SHA)return null;throw e;}).then(function(sha){
  var body={message:sec.nom+" : mise à jour ("+n+" modification"+(n>1?"s":"")+")",content:b64encode(serialize(state)),branch:REPO.branch};
  if(sha)body.sha=sha;
  return gh("PUT",body,path);
 }).then(function(res){s.DATA=state;s.SHA=res&&res.content?res.content.sha:null;s.draft=null;lsSet(keysFor(sid).d,null);});
}
function pendingSecs(){return SECTIONS.filter(function(sc){var st=store[sc.id];return st.draft&&diffCount(st.DATA,st.draft);});}
function publishAll(){
 if(admin.busy)return;saveCtx();
 var list=pendingSecs();if(!list.length)return;
 admin.busy=true;admin.msg="";admin.ok="";render();
 list.reduce(function(pr,sc){return pr.then(function(){return publishSec(sc.id);});},Promise.resolve()).then(function(){
  admin.busy=false;admin.ok="Publié. L'équipe verra la mise à jour d'ici une minute environ.";
  if(curSid){var st=store[curSid];DATA=st.DATA;SHA=st.SHA;admin.draft=st.draft;}
  render();
 }).catch(function(e){admin.busy=false;admin.msg=ghErr(e);if(curSid){var st=store[curSid];DATA=st.DATA;SHA=st.SHA;admin.draft=st.draft;}render();});
}
function publish(){
 if(!admin.draft||admin.busy)return;
 var sec=secById(curSid);
 admin.busy=true;admin.msg="";admin.ok="";render();
 var state=clone(admin.draft);state.config.maj=today();
 var n=changeCount();
 gh("GET").then(function(remote){
  if(SHA&&remote.sha!==SHA){var e=new Error("conflict");e.status=409;throw e;}
  return remote.sha;
 },function(e){if(e.status===404&&!SHA)return null;throw e;}).then(function(sha){
  var body={message:sec.nom+" : mise à jour ("+n+" modification"+(n>1?"s":"")+")",content:b64encode(serialize(state)),branch:REPO.branch};
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


/* ---------- campagne de contrôle ---------- */
var CTYPES=[["labo","Labo"],["ldv","Personne qualifiée (LDV)"],["apave","APAVE"],["visuel","Examen visuel"],["metro","Labo métrologie"],["volontaire","Contrôle volontaire"]];
var CAMP_SECS=["tst-materiel","tst-levage"];
var ETAPES={"":["À charger","none"],camion:["Dans le camion","out"],atelier:["Revenu à l'atelier","ok"],reparation:["En réparation","warn"],repare:["Réparé, revenu à l'atelier","ok"],reforme:["Réformé","off"]};
function ctLabel(k){var o=CTYPES.filter(function(x){return x[0]===k;})[0];return o?o[1]:k;}
function campData(){var s=store.campagnes;return s&&(s.draft||s.DATA);}
function campActive(){var d=campData();return d&&d.config.active||null;}
function campKey(a){return a.annee+"-"+a.type;}
function campLabelKey(k){var m=/^(\d+)-(.+)$/.exec(k||"");return m?ctLabel(m[2])+" "+m[1]:k;}
function sdata(sid){var s=store[sid];return s&&(s.draft||s.DATA);}
function campItems(a){
 var key=campKey(a),out=[];
 CAMP_SECS.forEach(function(sid){var d=sdata(sid);if(!d)return;d.items.forEach(function(i){
  if((i.ctrl||[]).indexOf(a.type)>-1||(i.suivi&&i.suivi.c===key))out.push({sid:sid,i:i,e:(i.suivi&&i.suivi.c===key)?(i.suivi.e||""):""});});});
 out.sort(function(x,y){return natCmp(x.i.description||"",y.i.description||"")||natCmp(x.i.icb||"",y.i.icb||"");});
 return out;
}
function editSec(sid,fnItems,fnCfg){
 var s=store[sid];if(!s.DATA)return;if(!s.draft)s.draft=clone(s.DATA);
 if(fnItems)fnItems(s.draft);if(fnCfg)fnCfg(s.draft.config);
 s.draft.config.maj=today();lsSet(keysFor(sid).d,diffCount(s.DATA,s.draft)?JSON.stringify(s.draft):null);
}
function campEdit(sid,id,fn){
 var a=campActive();if(!a)return;var key=campKey(a);
 editSec(sid,function(d){var it=d.items.filter(function(x){return x.id===id;})[0];if(!it)return;if(!it.suivi||it.suivi.c!==key)it.suivi={c:key,e:""};fn(it);});
}
function campLoad(sid,id){
 campEdit(sid,id,function(i){if(i.suivi.e===""){i.suivi.e="camion";i.suivi.dc=today();}else if(i.suivi.e==="camion"&&!i.suivi.r){i.suivi.e="";delete i.suivi.dc;}});
 render();var b=document.querySelector('[data-load="'+CSS.escape(id)+'"][data-sid="'+sid+'"]');if(b)b.focus();
}
function campResult(sid,id,val){
 var a=campActive();if(!a)return;
 campEdit(sid,id,function(i){
  i.suivi.r=val;i.suivi.dr=val?today():"";
  var e=i.suivi.e||"camion";
  if(!val)e="camion";
  else if(val==="Conforme"||val==="Non présenté")e="atelier";
  else if(val==="Réformé"||val==="Réforme définitive")e="reforme";
  else if(val==="À faire réparer"||val==="À envoyer au SERECT")e="reparation";
  i.suivi.e=e;
  if(sid==="tst-materiel"){i.res=i.res||{};if(val)i.res[String(a.annee)]=val;else delete i.res[String(a.annee)];}
  if(sid==="tst-levage"){i.res_vol=val;i.date_ctrl=val?frToday():i.date_ctrl;var mp={"Conforme":"Conforme","Réformé":"Réformé","Réforme définitive":"Réformé","À faire réparer":"À réparer","À envoyer au SERECT":"À réparer"};if(mp[val])i.statut=mp[val];}
 });
 if(sid==="tst-materiel")editSec(sid,null,function(c){c.years=c.years||[];if(c.years.indexOf(a.annee)<0){c.years.push(a.annee);c.years.sort();}});
}
function campStart(){
 var y=parseInt(document.getElementById("c-annee").value,10),tp=document.getElementById("c-type").value;
 if(!y||!tp)return;
 editSec("campagnes",null,function(c){c.active={annee:y,type:tp,debut:today()};});
 ui.ct="charger";admin.ok="";render();
}
function campClose(){
 var a=campActive();if(!a)return;var its=campItems(a),c={};its.forEach(function(x){c[x.e]=(c[x.e]||0)+1;});
 editSec("campagnes",null,function(cf){cf.historique=cf.historique||[];cf.historique.unshift({annee:a.annee,type:a.type,debut:a.debut,fin:today(),total:its.length,bilan:c});cf.active=null;});
 admin.arm="";admin.ok="Campagne clôturée. Touchez « Publier » pour l'enregistrer.";render();
}
function campCounts(its){var c={"":0,camion:0,atelier:0,reparation:0,repare:0,reforme:0};its.forEach(function(x){c[x.e]=(c[x.e]||0)+1;});return c;}
function campTile(){
 var a=campActive(),h='<button type="button" class="tile tile-camp" data-sec="campagne"><span class="t-name">Campagne de contrôle</span>';
 if(!campData())h+='<span class="t-sub">Chargement…</span>';
 else if(!a)h+='<span class="t-sub">Aucune campagne en cours · chargement du camion, résultats, réparations</span>';
 else{var its=campItems(a),c=campCounts(its),ch=its.length-c[""];
  h+='<span class="t-big"><b>'+ch+'</b> chargés / '+its.length+'</span><span class="t-sub">'+esc(ctLabel(a.type))+' '+a.annee+' · lancée le '+esc(frDate(a.debut))+'</span><span class="t-tags">';
  if(c.camion)h+='<span class="pill p-out">'+c.camion+' dans le camion</span>';
  if(c.reparation)h+='<span class="pill p-warn">'+c.reparation+' en réparation</span>';
  h+='</span>';}
 return h+'<span class="t-go" aria-hidden="true">'+I.arrow+'</span></button>';
}
function pubBar(){
 var n=0;SECTIONS.forEach(function(sc){var st=store[sc.id];if(st.draft)n+=diffCount(st.DATA,st.draft);});
 if(!admin.on||!n)return "";
 return '<div class="spacer"></div><div class="pub" role="region" aria-label="Publication"><div class="wrap"><span>'+n+' modification'+(n>1?'s':'')+' en brouillon</span><div class="row"><button class="btn ghost" id="c-discard" type="button">Annuler tout</button><button class="btn" id="c-pub" type="button"'+(admin.busy?' disabled':'')+'>'+(admin.busy?'Publication…':'Publier pour l\'équipe')+'</button></div></div></div>';
}
function renderCamp(){
 var h=previewBanner()+header("Campagne de contrôle","",false,"TST")+'<main class="wrap">';
 if(admin.msg)h+='<div class="notice" style="margin-top:14px">'+esc(admin.msg)+'</div>';
 if(admin.ok)h+='<div class="notice ok" style="margin-top:14px">'+esc(admin.ok)+'</div>';
 var cd=campData(),loaded=CAMP_SECS.every(function(sid){return sdata(sid);});
 if(!cd||!loaded){h+='<div class="empty">Chargement…</div></main>';app.innerHTML=h;return;}
 var a=campActive();
 if(!a){
  if(admin.on){
   var cnt={};CAMP_SECS.forEach(function(sid){sdata(sid).items.forEach(function(i){(i.ctrl||[]).forEach(function(k){cnt[k]=(cnt[k]||0)+1;});});});
   var sel=document.getElementById("c-type"),tv=sel?sel.value:"labo",yv=(document.getElementById("c-annee")||{}).value||new Date().getFullYear();
   h+='<section class="adminbar"><h3>Lancer une campagne</h3><p>Choisissez le type de contrôle : la liste de chargement reprend automatiquement tout le matériel de Matériel TST et de Levage qui a ce type de contrôle.</p><div class="fgrid">';
   h+='<div class="field"><label for="c-annee">Année</label><input id="c-annee" type="number" inputmode="numeric" value="'+esc(yv)+'"></div>';
   h+='<div class="field"><label for="c-type">Type de contrôle</label><select id="c-type">'+CTYPES.filter(function(o){return cnt[o[0]];}).map(function(o){return '<option value="'+o[0]+'"'+(tv===o[0]?' selected':'')+'>'+esc(o[1])+' ('+cnt[o[0]]+' matériels)</option>';}).join("")+'</select></div></div>';
   h+='<div class="row"><button class="btn primary" id="c-start" type="button">Lancer la campagne</button></div></section>';
  } else h+='<div class="empty"><p><b>Aucune campagne de contrôle en cours.</b></p><p>Les campagnes sont lancées par l\'administrateur.</p></div>';
  var hist=cd.config.historique||[];
  if(hist.length)h+='<h2 class="h2">Campagnes passées</h2><ul class="hist-list">'+hist.map(function(x){return '<li><b>'+esc(ctLabel(x.type))+' '+x.annee+'</b> · '+esc(frDate(x.debut))+' → '+esc(frDate(x.fin))+' · '+x.total+' matériels'+(x.bilan&&x.bilan.reparation?' · '+x.bilan.reparation+' encore en réparation':'')+'</li>';}).join("")+'</ul>';
  h+='</main>'+footer()+pubBar();app.innerHTML=h;return;
 }
 var its=campItems(a),c=campCounts(its);
 if(!ui.ct)ui.ct=c[""]?"charger":c.camion?"resultats":c.reparation?"reparations":"tout";
 h+='<div class="camp-head"><b>'+esc(ctLabel(a.type))+' '+a.annee+'</b> · lancée le '+esc(frDate(a.debut))+' · '+its.length+' matériels</div>';
 var tabs=[["charger","1. Chargement",c[""],"À charger"],["resultats","2. Résultats",c.camion,"Dans le camion"],["reparations","3. Réparations",c.reparation,"En réparation"],["tout","Tout",its.length,"Total"]];
 h+='<div class="ctabs" role="tablist">'+tabs.map(function(t){return '<button type="button" role="tab" class="ctab'+(ui.ct===t[0]?' on':'')+'" data-ctab="'+t[0]+'" aria-selected="'+(ui.ct===t[0])+'"><span>'+t[1]+'</span><b>'+t[2]+'</b><small>'+t[3]+'</small></button>';}).join("")+'</div>';
 var done=c.atelier+c.repare,pc=its.length?Math.round((its.length-c[""])*100/its.length):0;
 h+='<div class="progress"><span style="width:'+pc+'%"></span></div><div class="ptext"><b>'+(its.length-c[""])+'</b> / '+its.length+' chargés · '+done+' revenus à l\'atelier · '+c.reforme+' réformés</div>';
 h+='<div class="filters"><div class="search">'+I.search+'<input id="q" class="digits" type="search" autocorrect="off" spellcheck="false" placeholder="Chercher : nom, ICB, FT…" value="'+esc(ui.q)+'" autocomplete="off" aria-label="Rechercher"></div></div>';
 var q=norm(ui.q).split(/\s+/).filter(Boolean);
 var list=its.filter(function(x){
  if(ui.ct==="charger"&&!(x.e===""||(x.e==="camion"&&!(x.i.suivi&&x.i.suivi.r))))return false;
  if(ui.ct==="resultats"&&!(x.e==="camion"||((x.e==="atelier"||x.e==="reforme"||x.e==="reparation")&&x.i.suivi&&x.i.suivi.dr===today())))return false;
  if(ui.ct==="reparations"&&!(x.e==="reparation"||x.e==="repare"))return false;
  if(!q.length)return true;
  var hh=norm([x.i.description,x.i.carac,x.i.icb,x.i.ft,x.i.cesar,x.i.serie].join(" ")),hc=hh.replace(/[^a-z0-9]/g,"");
  return q.every(function(t){var tc=t.replace(/[^a-z0-9]/g,"");return hh.indexOf(t)>-1||(tc&&hc.indexOf(tc)>-1);});
 });
 var help={charger:"Cochez chaque matériel au moment où il monte dans le camion.",resultats:"Au retour du contrôle, choisissez le résultat de chaque matériel. Conforme : retour à l'atelier. À réparer ou SERECT : passe en réparation. Réformé : sort de la dotation.",reparations:"Indiquez où le matériel est parti et la date de retour prévue. Touchez « Revenu à l'atelier » à son retour.",tout:"Vue d'ensemble de la campagne."}[ui.ct];
 h+='<p class="help">'+esc(help)+(admin.on?'':' (lecture seule : mode admin nécessaire pour pointer)')+'</p>';
 if(!list.length)h+='<div class="empty">Rien à afficher dans cet onglet.</div>';
 h+='<ul class="items camp">';
 list.forEach(function(x){
  var i=x.i,su=i.suivi&&i.suivi.c===campKey(a)?i.suivi:{},et=ETAPES[x.e]||ETAPES[""],sec=secById(x.sid);
  var meta=[esc(sec.nom)];if(i.ft)meta.push(esc(i.ft));if(i.icb)meta.push('ICB <span class="mono">'+esc(i.icb)+'</span>');if(i.carac)meta.push(esc(i.carac));
  h+='<li class="item'+(ui.ct==="charger"&&admin.on?' inv':'')+'">';
  if(ui.ct==="charger"&&admin.on){var on=x.e!=="";h+='<button type="button" class="chk" data-load="'+esc(i.id)+'" data-sid="'+x.sid+'" aria-pressed="'+on+'" aria-label="'+(on?'Chargé':'Marquer comme chargé')+'"'+(su.r?' disabled':'')+'></button>';}
  h+='<div class="it-main"><div class="it-title"><span>'+esc(i.description||"—")+'</span></div><div class="it-meta">'+meta.map(function(m){return '<span>'+m+'</span>';}).join("")+'</div>';
  if(su.dc)h+='<div class="it-meta"><span>Chargé le '+esc(frDate(su.dc))+'</span>'+(su.r?'<span>Résultat : '+esc(su.r)+'</span>':'')+(su.dret?'<span>Revenu le '+esc(frDate(su.dret))+'</span>':'')+'</div>';
  if(admin.on&&ui.ct==="resultats"){var ro=RESULTS.map(function(r){return r[0];});h+='<div class="row camp-ctl"><select data-resu="'+esc(i.id)+'" data-sid="'+x.sid+'" aria-label="Résultat du contrôle"><option value="">Résultat…</option>'+ro.map(function(o){return '<option value="'+esc(o)+'"'+(su.r===o?' selected':'')+'>'+esc(o)+'</option>';}).join("")+'</select></div>';}
  if(admin.on&&ui.ct==="reparations"&&x.e==="reparation")h+='<div class="row camp-ctl"><input data-dest="'+esc(i.id)+'" data-sid="'+x.sid+'" value="'+esc(su.dest||"")+'" placeholder="Envoyé à (SERECT, fabricant…)" aria-label="Envoyé à"><input type="date" data-ret="'+esc(i.id)+'" data-sid="'+x.sid+'" value="'+esc(su.ret||"")+'" aria-label="Retour prévu"><button type="button" class="btn primary" data-back="'+esc(i.id)+'" data-sid="'+x.sid+'">Revenu à l\'atelier</button></div>';
  else if(su.dest||su.ret)h+='<div class="it-meta">'+(su.dest?'<span>Envoyé à '+esc(su.dest)+'</span>':'')+(su.ret?'<span>Retour prévu '+esc(frDate(su.ret))+'</span>':'')+'</div>';
  h+='</div><div class="it-side"><span class="pill p-'+et[1]+'">'+esc(et[0])+'</span></div></li>';
 });
 h+='</ul>';
 h+='<div class="row" style="margin-top:16px"><button class="btn" id="c-pdf" type="button">'+I.pdf+'PDF de la campagne</button>';
 if(admin.on)h+='<button class="btn danger'+(admin.arm==="close"?' armed':'')+'" id="c-close" type="button">'+(admin.arm==="close"?'Confirmer la clôture':'Clôturer la campagne')+'</button>';
 h+='</div>';
 if(admin.arm==="close")h+='<div class="notice" style="margin-top:10px">La campagne passera dans l\'historique. Les résultats saisis restent dans les fiches du matériel.'+(c.camion||c.reparation?' Attention : '+(c.camion?c.camion+' matériel(s) encore dans le camion. ':'')+(c.reparation?c.reparation+' en réparation.':''):'')+'</div>';
 h+='</main>'+footer()+pubBar();
 if(sheet)h+=renderSheet();
 app.innerHTML=h;
}
function campPdf(){
 var a=campActive();if(!a)return;var its=campItems(a),c=campCounts(its);
 sheet={mode:"pdf-camp",busy:true};render();
 loadPdf().then(function(){
  var J=window.jspdf.jsPDF,doc=new J({orientation:"landscape",unit:"mm",format:"a4"}),W=doc.internal.pageSize.getWidth();
  doc.setFillColor(242,194,48);doc.rect(0,0,W,4,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(20,32,43);
  doc.text(pdfSafe("Campagne de contrôle – "+ctLabel(a.type)+" "+a.annee),10,16);
  doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(86,99,112);
  doc.text(pdfSafe("Édité le "+frToday()+"  ·  lancée le "+frDate(a.debut)+"  ·  "+its.length+" matériels  ·  À charger : "+c[""]+"  ·  Dans le camion : "+c.camion+"  ·  En réparation : "+c.reparation+"  ·  Revenus à l'atelier : "+(c.atelier+c.repare)+"  ·  Réformés : "+c.reforme),10,22);
  var body=its.map(function(x){var su=x.i.suivi&&x.i.suivi.c===campKey(a)?x.i.suivi:{};return [secById(x.sid).nom,x.i.description||"",x.i.carac||"",x.i.ft||"",x.i.icb||"",su.dc?frDate(su.dc):"",su.r||"",ETAPES[x.e][0],[su.dest?"Envoyé à "+su.dest:"",su.ret?"retour prévu "+frDate(su.ret):"",su.dret?"revenu le "+frDate(su.dret):""].filter(Boolean).join(", "),""].map(pdfSafe);});
  doc.autoTable({head:[["Partie","Description","Caract.","FT","ICB","Chargé le","Résultat","Étape","Réparation","Visa"]],body:body,startY:27,margin:{left:10,right:10,bottom:14},theme:"grid",
   styles:{font:"helvetica",fontSize:7.6,cellPadding:1.4,lineColor:[211,218,225],lineWidth:0.2,textColor:[20,32,43]},headStyles:{fillColor:[20,32,43],textColor:[255,255,255]},
   columnStyles:{0:{cellWidth:22},1:{cellWidth:72},2:{cellWidth:20},3:{cellWidth:13},4:{cellWidth:26},5:{cellWidth:17},6:{cellWidth:24},7:{cellWidth:28},9:{cellWidth:14}},
   didDrawPage:function(){doc.setFontSize(8);doc.setTextColor(86,99,112);doc.text(pdfSafe("Campagne "+ctLabel(a.type)+" "+a.annee+" · page "+doc.internal.getNumberOfPages()),W-10,doc.internal.pageSize.getHeight()-7,{align:"right"});}});
  doc.save("campagne-"+a.type+"-"+a.annee+"-"+today()+".pdf");sheet=null;render();
 }).catch(function(){sheet=null;admin.msg="Le PDF n'a pas pu être créé. Vérifiez la connexion internet.";render();});
}

/* ---------- mode d'emploi ---------- */
function renderHelp(){
 var G=[
  ["Consulter le matériel",["Scannez le QR code ou ouvrez le lien, puis choisissez une section (Électroportatif, DSTM, GIPFS, TST…).","Tapez dans la barre de recherche un nom, une FT, une référence ou seulement quelques chiffres d'un numéro ICB (par exemple les 4 derniers).","Touchez une ligne pour ouvrir sa fiche complète : historique des contrôles année par année, dates, commentaires.","Les menus déroulants (par type de matériel) s'ouvrent d'un appui. Les filtres en haut permettent de trier par FT, type de contrôle, résultat d'une année, durée de vie…"]],
  ["Passer en mode admin (une seule fois par téléphone)",["Touchez « Admin » en haut de la page.","Collez votre clé GitHub (elle commence par github_pat_) puis « Valider ».","Le bouton devient jaune « Mode admin » : vous pouvez modifier. Retouchez-le pour revenir en simple consultation."]],
  ["Ajouter du matériel",["Allez dans la bonne partie, en mode admin.","Touchez « + Ajouter », remplissez la fiche puis « Enregistrer ».","Pour plusieurs matériels identiques : ouvrez le premier et touchez « Dupliquer », il ne reste qu'à changer l'ICB ou le n° de série.","Touchez « Publier pour l'équipe » en bas de l'écran quand vous avez fini."]],
  ["Modifier ou supprimer",["En mode admin, touchez la ligne : la fiche s'ouvre en modification.","Changez ce qu'il faut puis « Enregistrer ». « Supprimer » demande une confirmation.","Tant que vous n'avez pas touché « Publier pour l'équipe », rien n'est visible par les autres : « Annuler tout » efface le brouillon."]],
  ["Faire un inventaire",["Dans une partie, en mode admin, touchez « Démarrer un inventaire ».","Une case apparaît devant chaque ligne : cochez ce que vous trouvez. « Seulement les non pointés » montre ce qu'il reste.","Vous pouvez fermer la page et reprendre plus tard sur le même téléphone.","Touchez « Terminer l'inventaire » puis confirmez : chaque matériel coché reçoit la date « vu le » du jour. Publiez, puis sortez le PDF si besoin."]],
  ["Campagne de contrôle (camion atelier)",["TST → « Campagne de contrôle », en mode admin : choisissez l'année et le type de contrôle (Labo, APAVE…), puis « Lancer la campagne ». La liste reprend tout le matériel concerné.","Onglet 1 « Chargement » : cochez chaque matériel au moment où il monte dans le camion.","Onglet 2 « Résultats » : au retour, choisissez le résultat. Conforme → retour atelier. À faire réparer / SERECT → passe en réparation. Réformé → sort de la dotation. Le résultat s'inscrit automatiquement dans l'historique de l'année.","Onglet 3 « Réparations » : notez où le matériel est parti et le retour prévu, puis « Revenu à l'atelier » à son retour.","Publiez régulièrement. En fin de campagne : « PDF de la campagne » puis « Clôturer la campagne »."]],
  ["Retours labo saisis à la main",["Si besoin, en mode admin dans Matériel TST : « Nouvelle campagne 2027 » ajoute la colonne de l'année.","Touchez une ligne et choisissez le résultat dans la case de l'année."]],
  ["Cordes : durée de vie",["Une corde en service est à remplacer 2 ans après sa mise en service ; en stock, 5 ans après sa fabrication.","La date de fin de vie s'affiche sur chaque corde (rouge = périmée, orange = moins de 6 mois). Le filtre « Durée de vie » les liste, et elles passent automatiquement « À commander ».","Pensez à remplir la date de mise en service quand une corde sort du stock, et à passer son état « En service »."]],
  ["Commandes et PDF",["Cochez « À commander » dans la fiche d'un matériel (avec une note). Les manquants du camion, les ruptures de consommables et les cordes en fin de vie y passent tout seuls.","Bouton « PDF » : liste complète, seulement ce qui est filtré à l'écran, ou liste à commander avec les références."]],
  ["QR codes",["Le bouton « QR code » donne le code de la page affichée : accueil, TST, ou une partie précise. Imprimez-le et collez-le à l'endroit du matériel."]]
 ];
 var h=previewBanner()+header("Mode d'emploi","",false,"Retour")+'<main class="wrap guide">';
 G.forEach(function(g,n){h+='<details'+(n===0?' open':'')+'><summary>'+esc(g[0])+'</summary><ol>'+g[1].map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ol></details>';});
 h+='</main>'+footer();app.innerHTML=h;
}

/* ---------- navigation ---------- */
function show(target){
 sheet=null;ui=freshUi();admin.msg="";admin.ok="";admin.arm="";
 if(target&&secById(target)){loadCtx(target);view=target;openG={};saveOpen();}
 else if(target&&(grpById(target)||viewById(target))){saveCtx();curSid=null;T=null;view=target;}
 else{saveCtx();view="home";}
 render();window.scrollTo(0,0);
}
var lastView="home";
function route(){var h=(location.hash||"").replace(/^#/,"");if(h!=="aide")lastView=h||"home";show((secById(h)&&!secById(h).hidden)||grpById(h)||viewById(h)?h:null);}
function goTo(sid){
 if(sid){if(location.hash==="#"+sid)route();else location.hash=sid;}
 else{try{history.pushState(null,"",location.pathname+location.search);}catch(e){}show(null);}
}
window.addEventListener("hashchange",route);
window.addEventListener("popstate",route);

/* ---------- événements ---------- */
app.addEventListener("click",function(e){
 var t=e.target.closest("button,a,.item,#sheet-bg");if(!t)return;
 if(t.classList.contains("it-link"))return;
 if(t.id==="sheet-bg"){if(e.target===t&&!(sheet&&sheet.busy)){sheet=null;render();}return;}
 if(t.dataset&&t.dataset.sec){goTo(t.dataset.sec);return;}
 if(t.id==="b-home"){if(view==="aide"){goTo(lastView==="home"?null:lastView);return;}var cs=secById(view)||grpById(view)||viewById(view);goTo(cs&&cs.parent?cs.parent:null);return;}
 if(t.id==="b-help"){goTo("aide");return;}
 if(t.dataset&&t.dataset.pre!=null){var ic=document.getElementById("f-icb");if(ic){var rest=ic.value.replace(/^.*-/,"").replace(/\D/g,"");ic.value=t.dataset.pre+rest;ic.focus();try{ic.setSelectionRange(ic.value.length,ic.value.length);}catch(er){}}return;}
 if(t.dataset&&t.dataset.load){campLoad(t.dataset.sid,t.dataset.load);return;}
 if(t.dataset&&t.dataset.back){campEdit(t.dataset.sid,t.dataset.back,function(i){i.suivi.e="repare";i.suivi.dret=today();});render();return;}
 if(t.dataset&&t.dataset.ctab){ui.ct=t.dataset.ctab;render();return;}
 if(t.id==="c-start"){campStart();return;}
 if(t.id==="c-close"){if(admin.arm!=="close"){admin.arm="close";render();return;}campClose();return;}
 if(t.id==="c-pub"){publishAll();return;}
 if(t.id==="c-discard"){SECTIONS.forEach(function(sc){var st=store[sc.id];st.draft=null;lsSet(keysFor(sc.id).d,null);});render();return;}
 if(t.id==="c-pdf"){campPdf();return;}
 if(t.dataset&&t.dataset.g!=null){if(filtering())return;var gname=t.dataset.g;if(openG[gname])delete openG[gname];else openG[gname]=1;saveOpen();render();var gb=document.querySelector('.ghead[data-g="'+CSS.escape(gname)+'"]');if(gb)gb.focus();return;}
 if(t.id==="open-all"){e.preventDefault();cur().items.forEach(function(i){openG[groupOf(i)]=1;});saveOpen();render();return;}
 if(t.id==="close-all"){e.preventDefault();openG={};saveOpen();render();return;}
 if(t.id==="reset"){e.preventDefault();ui=freshUi();render();return;}
 if(t.id==="b-retry"){loadAll();return;}
 if(t.id==="b-qr"){sheet={mode:"qr"};render();return;}
 if(t.id==="b-pdf"){sheet={mode:"pdf"};render();return;}
 if(t.id==="p-inv"){exportPdf("inv");return;}
 if(t.id==="p-flt"){exportPdf("flt");return;}
 if(t.id==="p-cmd"){exportPdf("cmd");return;}
 if(t.id==="b-admin"){
  if(admin.on){admin.on=false;render();return;}
  if(admin.token){admin.on=true;render();return;}
  sheet={mode:"login"};render();focusId("l-token");return;
 }
 if(t.id==="b-logout"){lsSet(TKEY,null);admin.token="";admin.on=false;render();return;}
 if(t.id==="b-add"){sheet={mode:"add"};render();focusId("f-"+T.fields[0].k);return;}
 if(t.id==="b-cfg"){sheet={mode:"cfg"};render();return;}
 if(t.id==="b-year"){
  if(admin.arm!=="year"){admin.arm="year";render();return;}
  ensureDraft();var ys=(admin.draft.config.years||[]).slice();ys.push((ys.length?Math.max.apply(null,ys):new Date().getFullYear()-1)+1);admin.draft.config.years=ys;touch();saveDraft();admin.arm="";ui.ry="";admin.ok="Campagne "+ys[ys.length-1]+" ajoutée. Touchez une ligne pour saisir son résultat.";render();return;
 }
 if(t.id==="s-close"){sheet=null;render();return;}
 if(t.dataset&&t.dataset.st){ui.st=(ui.st===t.dataset.st?"all":t.dataset.st);render();return;}
 if(t.id==="c-save"){ensureDraft();admin.draft.config.inventaire=document.getElementById("c-inv").value.trim();
  if(document.getElementById("c-ref")){var cf=admin.draft.config;cf.ref=document.getElementById("c-ref").value.trim();cf.taille=document.getElementById("c-taille").value.trim();cf.poids=document.getElementById("c-poids").value.trim();cf.equipement=document.getElementById("c-eq").value.split("\n").map(function(x){return x.trim();}).filter(Boolean);}touch();saveDraft();sheet=null;render();return;}
 if(t.id==="s-dup"){var seed=readForm();["serie","icb","cesar"].forEach(function(k){if(k in seed)seed[k]="";});sheet={mode:"add",seed:seed};render();focusId("f-"+T.fields[0].k);return;}
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
 if(t.classList.contains("item")&&t.dataset.id&&T){sheet={mode:admin.on?"edit":"view",id:t.dataset.id};render();return;}
});
app.addEventListener("keydown",function(e){
 if(e.key==="Escape"&&sheet&&!sheet.busy){sheet=null;render();return;}
 var t=e.target;if((e.key==="Enter"||e.key===" ")&&t.classList&&t.classList.contains("item")&&t.dataset.id&&T){e.preventDefault();sheet={mode:admin.on?"edit":"view",id:t.dataset.id};render();}
});
app.addEventListener("input",function(e){if(e.target.id==="q"){ui.q=e.target.value;render();}});
app.addEventListener("change",function(e){
 var t=e.target;
 if(t.classList.contains("fsel")){ui.f[t.dataset.f]=t.value;render();return;}
 if(t.id==="f-ry"){ui.ry=t.value;ui.rv="";render();return;}
 if(t.id==="f-rv"){ui.rv=t.value;render();return;}
 if(t.id==="f-lf"){ui.lf=t.value;render();return;}
 if(t.dataset&&t.dataset.dest!=null){campEdit(t.dataset.sid,t.dataset.dest,function(i){i.suivi.dest=t.value.trim();});render();return;}
 if(t.dataset&&t.dataset.ret!=null){campEdit(t.dataset.sid,t.dataset.ret,function(i){i.suivi.ret=t.value;});render();return;}
 if(t.dataset&&t.dataset.resu!=null){campResult(t.dataset.sid,t.dataset.resu,t.value);render();return;}
});
app.addEventListener("submit",function(e){
 e.preventDefault();
 if(e.target.id==="f-login"){var tk=document.getElementById("l-token").value.trim();if(tk)login(tk);return;}
 if(e.target.id!=="f-item")return;
 var f=readForm(),k0=T.fields.filter(function(x){return x.req;})[0];
 if(k0&&!f[k0.k]){focusId("f-"+k0.k);return;}
 ensureDraft();
 if(sheet.mode==="add"){f.id=newId();admin.draft.items.push(f);if(INV){INV.seen[f.id]=1;saveInv();}}
 else{admin.draft.items=admin.draft.items.map(function(i){if(i.id!==sheet.id)return i;f.id=i.id;if(i.vu)f.vu=i.vu;return f;});}
 sortItems(admin.draft.items);touch();saveDraft();
 if(e.submitter&&e.submitter.id==="s-next"){var nx=clone(f);delete nx.id;delete nx.vu;["icb","serie","cesar"].forEach(function(k){if(k in nx)nx[k]="";});if(nx.qte_init===1)nx.qte="";sheet={mode:"add",seed:nx};admin.ok="";render();var fk=document.getElementById("f-icb")||document.getElementById("f-serie")||document.getElementById("f-"+T.fields[0].k);if(fk)fk.focus();return;}
 sheet=null;render();
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
/* ---------- barre de chiffres au-dessus du clavier (champs ICB) ---------- */
var dbar=document.createElement("div");dbar.id="digitbar";dbar.hidden=true;dbar.setAttribute("aria-hidden","true");
dbar.innerHTML="1234567890-".split("").map(function(c){return '<button type="button" tabindex="-1" data-k="'+c+'">'+c+'</button>';}).join("");
document.body.appendChild(dbar);
var dTarget=null;
function placeBar(){if(dbar.hidden)return;var vv=window.visualViewport,h=dbar.offsetHeight;var top=vv?vv.offsetTop+vv.height-h:window.innerHeight-h;dbar.style.top=Math.max(0,top)+"px";}
document.addEventListener("focusin",function(e){if(e.target.classList&&e.target.classList.contains("digits")){dTarget=e.target;dbar.hidden=false;document.body.classList.add("dbar-on");placeBar();setTimeout(placeBar,300);setTimeout(placeBar,700);}});
document.addEventListener("focusout",function(e){if(e.target===dTarget)setTimeout(function(){if(document.activeElement!==dTarget){dbar.hidden=true;dTarget=null;document.body.classList.remove("dbar-on");}},120);});
if(window.visualViewport){window.visualViewport.addEventListener("resize",placeBar);window.visualViewport.addEventListener("scroll",placeBar);}
window.addEventListener("scroll",placeBar);
function dPress(e){var b=e.target.closest("button[data-k]");if(!b||!dTarget)return;e.preventDefault();
 var el=dTarget,st=el.selectionStart==null?el.value.length:el.selectionStart,en=el.selectionEnd==null?st:el.selectionEnd;
 el.value=el.value.slice(0,st)+b.dataset.k+el.value.slice(en);try{el.setSelectionRange(st+1,st+1);}catch(er){}
 el.dispatchEvent(new Event("input",{bubbles:true}));}
dbar.addEventListener("pointerdown",function(e){if(e.pointerType==="touch")return;dPress(e);});
dbar.addEventListener("mousedown",function(e){e.preventDefault();});
dbar.addEventListener("touchstart",function(e){e.preventDefault();dPress(e);},{passive:false});

admin.token=lsGet(TKEY)||"";
route();
loadAll();
})();
