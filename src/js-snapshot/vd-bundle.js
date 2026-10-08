/* vd-bundle v1 09.10.2026 — head.liquid inline scriptlerinden taşındı */
/* s5 */

try{
(function(){if(window.__vordienGallery)return;window.__vordienGallery=true;var CACHE={};var GQ=[],GT=null,GR={};function gflush(){GT=null;var ids=GQ.splice(0,50);if(GQ.length)GT=setTimeout(gflush,0);fetch('/products_by_id/'+ids.join(',')+'.json',{credentials:'include'}).then(function(r){return r.json();}).then(function(j){var mp={};(j.products||[]).forEach(function(p){mp[String(p.id)]=p;});ids.forEach(function(x){var p=mp[String(x)]||{};GR[x]((p.images||[]).slice().sort(function(a,b){return (a.position||0)-(b.position||0);}).map(function(im){return im.large_url||im.medium_url||im.url;}).filter(Boolean));});}).catch(function(){ids.forEach(function(x){GR[x]([]);});});}function getImgs(id){if(CACHE[id])return CACHE[id];CACHE[id]=new Promise(function(res){GR[id]=res;});GQ.push(id);if(!GT)GT=setTimeout(gflush,80);return CACHE[id];}function build(card){if(card.getAttribute('data-vg'))return;var id=card.getAttribute('data-product-id');if(!id)return;var inner=card.querySelector('.img-ratio__inner');if(!inner)return;var link=card.querySelector('.product-preview__photo-variant');var img=inner.querySelector('img');if(!img)return;card.setAttribute('data-vg','pending');getImgs(id).then(function(urls){if(!urls||urls.length<2){card.setAttribute('data-vg','single');return;}card.setAttribute('data-vg','on');var href=link?link.getAttribute('href'):null;var idx=0,prepared=false;function prepare(){if(prepared)return;prepared=true;var pic=img.closest('picture');if(pic){pic.querySelectorAll('source').forEach(function(s){s.remove();});}img.removeAttribute('srcset');}var dots=document.createElement('div');dots.className='vg-dots';var dotEls=[];urls.forEach(function(_,k){var d=document.createElement('span');d.className='vg-dot'+(k===0?' vg-dot--on':'');dots.appendChild(d);dotEls.push(d);});var zones=document.createElement('div');zones.className='vg-zones';function show(i){i=(i%urls.length+urls.length)%urls.length;idx=i;prepare();img.src=urls[i];dotEls.forEach(function(d,di){d.className='vg-dot'+(di===i?' vg-dot--on':'');});[(i+1)%urls.length,(i-1+urls.length)%urls.length].forEach(function(n){var im=new Image();im.src=urls[n];});}urls.forEach(function(_,z){var s=document.createElement('div');s.className='vg-zone';s.addEventListener('mouseenter',function(){show(z);});s.addEventListener('click',function(ev){if(href){ev.preventDefault();ev.stopPropagation();window.location.href=href;}});zones.appendChild(s);});inner.appendChild(zones);inner.appendChild(dots);inner.addEventListener('mouseleave',function(){if(prepared)show(0);});var sx=0,sy=0,mv=false;inner.addEventListener('touchstart',function(e){var t=e.touches[0];sx=t.clientX;sy=t.clientY;mv=false;},{passive:true});inner.addEventListener('touchmove',function(e){var t=e.touches[0];if(Math.abs(t.clientX-sx)>10&&Math.abs(t.clientX-sx)>Math.abs(t.clientY-sy))mv=true;},{passive:true});inner.addEventListener('touchend',function(e){if(!mv)return;var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>25)show(idx+(dx<0?1:-1));var b=function(ev){ev.preventDefault();ev.stopPropagation();inner.removeEventListener('click',b,true);};inner.addEventListener('click',b,true);setTimeout(function(){inner.removeEventListener('click',b,true);},450);});});}function scan(){document.querySelectorAll('.grid-list .product-preview[data-product-id]').forEach(build);}function init(){scan();if('MutationObserver'in window){var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(scan,150);}).observe(document.body,{childList:true,subtree:true});}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();
}catch(e){if(window.console)console.warn("vd-bundle s5",e)}

/* s6 */
try{
(function(){function fill(){var L=document.querySelectorAll('img:not([alt]),img[alt=""]');for(var n=0;n<L.length;n++){(function(img){if(img.getAttribute('data-af'))return;img.setAttribute('data-af','1');var alt='';var src=(img.getAttribute('src')||img.getAttribute('data-src')||'');if(/zyro-image|logo/i.test(src)||(img.closest('.header__logo,[class*=logo]'))){alt='Vordien Home — домашний текстиль из Турции';}if(!alt){var a=img.closest('a');if(a){alt=(a.getAttribute('title')||a.getAttribute('aria-label')||'').trim();if(!alt){var tx=(a.textContent||'').replace(/\s+/g,' ').trim();if(tx&&tx.length<=80)alt=tx;}}}if(!alt){alt=(img.getAttribute('title')||'').trim();}if(alt)img.setAttribute('alt',alt);})(L[n]);}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fill);else fill();if('MutationObserver'in window){var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(fill,300);}).observe(document.documentElement,{childList:true,subtree:true});}})();
}catch(e){if(window.console)console.warn("vd-bundle s6",e)}

/* s8 */
try{
(function(){var C=111939871;function g(n){try{if(window.ym)ym(C,'reachGoal',n);}catch(e){}}var of=window.fetch;if(of){window.fetch=function(){try{var a=arguments,u=a[0],url=(typeof u==='string'?u:(u&&u.url)||''),m=((a[1]&&a[1].method)||(u&&u.method)||'GET');if(/\/cart_items(\b|\/|\?|$)/.test(url)&&/post/i.test(m))g('add_to_cart');}catch(e){}return of.apply(this,arguments);};}var ox=window.XMLHttpRequest&&XMLHttpRequest.prototype.open;if(ox){XMLHttpRequest.prototype.open=function(method,url){try{if(/\/cart_items(\b|\/|\?|$)/.test(url)&&/post/i.test(method))this.addEventListener('load',function(){g('add_to_cart');});}catch(e){}return ox.apply(this,arguments);};}function chk(){try{var p=location.pathname;if(/^\/orders\/[^\/]{6,}$/.test(p)&&p.indexOf('/new')<0){var k='vg_p_'+p;var seen=false;try{seen=sessionStorage.getItem(k);}catch(e){}if(!seen){try{sessionStorage.setItem(k,'1');}catch(e){}g('purchase');}}}catch(e){}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',chk);else chk();})();
}catch(e){if(window.console)console.warn("vd-bundle s8",e)}

/* vordien-enhance-js */
try{

(function(){
 if(window.__vdEnh)return;window.__vdEnh=1;
 var P=location.pathname;
 var isHome=(P==='/'||P==='');
 var isColl=P.indexOf('/collection/')===0;
 var isProd=P.indexOf('/product/')===0;
 var isCheckout=['cart','checkout','order','client_account','favorite','compare'].some(function(k){return P.indexOf(k)!==-1;});
 function E(h){var d=document.createElement('div');d.innerHTML=h;return d.firstElementChild;}
 function main(){return document.querySelector('.page_layout main')||document.querySelector('main');}
 function beforeFooter(node){var m=main();if(m){m.appendChild(node);return;}var f=document.querySelector('footer');if(f&&f.parentNode)f.parentNode.insertBefore(node,f);else document.body.appendChild(node);}
 var CATS=[
  ['Постельное бельё','/collection/postelnoe-belie','https://cdn.insales-shop.ru/files/1/3593/135867913/original/vordien-cat-tile-1-640.webp'],
  ['Халаты','/collection/halaty','https://cdn.insales-shop.ru/files/1/3601/135867921/original/vordien-cat-tile-2-640.webp'],
  ['Пледы и покрывала','/collection/pledy-i-pokryvala','https://cdn.insales-shop.ru/files/1/3609/135867929/original/vordien-cat-tile-3-640.webp'],
  ['Подушки и одеяла','/collection/podushki-i-odeyala','https://cdn.insales-shop.ru/files/1/3617/135867937/original/vordien-cat-tile-4-640.webp'],
  ['Спальня','/collection/spalnya','https://cdn.insales-shop.ru/files/1/3625/135867945/original/vordien-cat-tile-5-640.webp'],
  ['Ванная','/collection/vannaya','https://cdn.insales-shop.ru/files/1/3633/135867953/original/vordien-cat-tile-6-640.webp'],
  ['Кухня','/collection/kuhnya','https://cdn.insales-shop.ru/files/1/3641/135867961/original/vordien-cat-tile-7-640.webp'],
  ['Домашняя одежда','/collection/domashnyaya-odezhda','https://cdn.insales-shop.ru/files/1/3649/135867969/original/vordien-cat-tile-8-640.webp']
 ];
 function popcat(){
  if(document.getElementById('vd-popcat'))return;
  var sec=E('<section class="vd-section" id="vd-popcat"><h2 class="vd-h2">Популярные категории</h2><div class="vd-popcat-grid"></div></section>');
  var grid=sec.querySelector('.vd-popcat-grid');
  for(var i=0;i<CATS.length;i++){var c=CATS[i];var a=document.createElement('a');a.className='vd-tile';a.href=c[1];a.setAttribute('data-bg',c[2]);a.innerHTML='<span>'+c[0]+'</span>';grid.appendChild(a);}
  var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var t=e.target;t.style.backgroundImage='url("'+t.getAttribute('data-bg')+'")';io.unobserve(t)}})},{rootMargin:'400px 0px'}):null;
  [].forEach.call(grid.querySelectorAll('.vd-tile'),function(t){if(io)io.observe(t);else t.style.backgroundImage='url("'+t.getAttribute('data-bg')+'")'});
  beforeFooter(sec);
 }
 function trust(){
  if(document.getElementById('vd-trust'))return;
  var truck='<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
  var card='<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>';
  var ret='<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
  var shield='<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
  var items=[[truck,'Доставка по всей России','СДЭК и Яндекс Доставка'],[card,'Безопасная оплата','СБП, SberPay или картой'],[ret,'Лёгкий возврат','14 дней на обмен'],[shield,'Гарантия качества','сертифицированный текстиль из Турции']];
  var h='<section class="vd-section" id="vd-trust"><div class="vd-trust">';
  for(var i=0;i<items.length;i++){h+='<div class="vd-trust__i">'+items[i][0]+'<div><b>'+items[i][1]+'</b><small>'+items[i][2]+'</small></div></div>';}
  h+='</div></section>';beforeFooter(E(h));
 }
 function why(){
  if(document.getElementById('vd-why'))return;
  var b=[['Натуральные материалы','Хлопок, сатин, ранфорс, бамбук и махра премиального качества из Турции.'],['Известные бренды','NUSA, Pupilla, Karacan, Zalel — проверенные турецкие производители.'],['Для всего дома','Спальня, ванная, кухня и гостиная — текстиль в едином стиле.'],['Бережная упаковка','Каждый заказ аккуратно упакован и готов стать подарком.']];
  var h='<section class="vd-section" id="vd-why"><h2 class="vd-h2">Почему Vordien Home</h2><div class="vd-why">';
  for(var i=0;i<b.length;i++){h+='<div class="vd-why__c"><b>'+b[i][0]+'</b><p>'+b[i][1]+'</p></div>';}
  h+='</div></section>';beforeFooter(E(h));
 }
 function catseo(){
  if(document.getElementById('vd-catseo'))return;
  var h1=document.querySelector('h1');var name=h1?(h1.textContent||'').trim():'';
  var intro=name?('В категории «'+name+'» представлен домашний текстиль из Турции с доставкой по всей России. '):'';
  var txt=intro+'Мы предлагаем натуральные ткани — сатин, ранфорс, поплин, махра и бамбук — от известных турецких брендов NUSA, Pupilla, Karacan и Zalel. Подберите постельное бельё, полотенца, халаты и пледы в едином стиле для спальни, ванной и кухни.';
  var links='';for(var i=0;i<CATS.length;i++){links+='<a href="'+CATS[i][1]+'">'+CATS[i][0]+'</a>';}
  var h='<section class="vd-section" id="vd-catseo"><div class="vd-catseo"><h2>Турецкий домашний текстиль Vordien Home</h2><p>'+txt+'</p><div class="vd-links">'+links+'</div></div></section>';
  beforeFooter(E(h));
 }
 function footer(){
  var f=document.querySelector('footer');if(!f||document.getElementById('vd-foot'))return;
  var catLinks='';for(var i=0;i<CATS.length;i++){catLinks+='<a href="'+CATS[i][1]+'">'+CATS[i][0]+'</a>';}
  var info='<a href="/collection/all">Весь ассортимент</a><a href="/page/about-us">О компании</a><a href="/page/delivery">Доставка</a><a href="/page/payment">Оплата</a><a href="/page/exchange">Обмен и возврат</a><a href="/page/contacts">Контакты</a><a href="/blogs/blog">Блог и советы</a>';
  var h='<div class="vd-foot" id="vd-foot"><div><h4>Vordien Home</h4><p>Домашний текстиль из Турции: постельное бельё, полотенца, халаты, пледы и декор от брендов NUSA, Pupilla, Karacan и Zalel. Доставка по всей России.</p></div><div><h4>Категории</h4>'+catLinks+'</div><div><h4>Покупателям</h4>'+info+'<a href="tel:+79691021024">+7 969 102-10-24 — служба поддержки</a></div><div><h4>Оптовым покупателям</h4><a href="/page/opt">Опт и сотрудничество</a><a href="/page/opt#vd-opt-form">Оставить заявку на опт</a><a href="tel:+79999016788">+7 999 901-67-88 — оптовый отдел</a></div></div>';
  f.appendChild(E(h));
 }
 function announce(){
  if(document.getElementById('vd-announce'))return;
  var bar=E('<div class="vd-announce" id="vd-announce">Скидка 7% на первый заказ — промокод <b>VORDIEN7</b> · Бесплатная доставка в пункт выдачи от 3 000 ₽</div>');
  var pl=document.querySelector('.page_layout');var hd=document.querySelector('header');
  if(pl&&hd)pl.insertBefore(bar,hd);else document.body.insertBefore(bar,document.body.firstChild);
 }
 function search(){
  var s=document.querySelector('input[name="q"]');if(!s||s.__vd)return;s.__vd=1;
  var ph=['Постельное бельё евро','Набор полотенец','Махровый халат','Покрывало с наволочками','Плед хлопок','Коврик для ванной','Домашний халат','Одеяло'];var i=0;
  setInterval(function(){i=(i+1)%ph.length;s.setAttribute('placeholder',ph[i]);},2600);
 }
 function num(t){t=(t||'').replace(/[^0-9]/g,'');return t?parseInt(t,10):0;}
 function badges(root){
  var cards=(root||document).querySelectorAll('.product-preview');
  for(var i=0;i<cards.length;i++){(function(card){
   if(card.__vdb)return;
   var oldE=card.querySelector('.product-preview__price-old');var curE=card.querySelector('.product-preview__price');
   if(!oldE||!curE)return;var o=num(oldE.textContent),c=num(curE.textContent);
   if(o>0&&c>0&&o>c){var d=Math.round((1-c/o)*100);if(d>=3){card.__vdb=1;var host=card.querySelector('.img-ratio__inner')||card;if(getComputedStyle(host).position==='static')host.style.position='relative';host.appendChild(E('<span class="vd-badge">-'+d+'%</span>'));}}
  })(cards[i]);}
 }
 function init(){
  try{announce();}catch(e){}
  try{search();}catch(e){}
  try{footer();}catch(e){}
  if(!isCheckout){
   if(isHome){try{popcat();}catch(e){}try{trust();}catch(e){}try{why();}catch(e){}}
   if(isColl){try{catseo();}catch(e){}try{trust();}catch(e){}}
   if(isProd){try{trust();}catch(e){}}
  }
  try{badges(document);}catch(e){}
  var mo=new MutationObserver(function(muts){var t=null;for(var i=0;i<muts.length;i++){if(muts[i].addedNodes&&muts[i].addedNodes.length){t=1;break;}}if(t){clearTimeout(window.__vdbT);window.__vdbT=setTimeout(function(){try{badges(document);}catch(e){}try{search();}catch(e){}},200);}});
  try{mo.observe(document.body,{childList:true,subtree:true});}catch(e){}
 }
 if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();

}catch(e){if(window.console)console.warn("vd-bundle vordien-enhance-js",e)}

/* vd-reco */
try{
(function(){
var d=document,P=location.pathname,isHome=(P==='/'||P==='');
var F='https://cdn.insales-shop.ru/files/1/';
/* 1) Акции: 3 новых баннера в начале слайдера */
var B=[
{h:'/collection/nabor-polotenets',t:'Наборы полотенец из Турции',s:'Хлопок 100% · Karacan, Hazangülü, Pupilla, Velora',d:F+'6121/135845865/original/vordien-banner-towels-1600.webp',m:F+'6129/135845873/original/vordien-banner-towels-800.webp'},
{h:'/collection/dzhempery-i-svitery',t:'Женские джемперы',s:'Мягкая вязка · свободный крой · новая коллекция',d:F+'6145/135845889/original/vordien-banner-sweaters-1600.webp',m:F+'6153/135845897/original/vordien-banner-sweaters-800.webp'},
{h:'/collection/all',t:'−7% на первый заказ',s:'Промокод VORDIEN7 · доставка в ПВЗ бесплатно от 3 000 ₽',d:F+'1169/135242897/original/vordien-banner-promo-1600.webp',m:F+'1177/135242905/original/vordien-banner-promo-800.webp'},
{h:'/collection/halaty',t:'Махровые халаты',s:'Из Турции · для неё и для него',d:F+'1153/135242881/original/vordien-banner-robes-1600.webp',m:F+'1161/135242889/original/vordien-banner-robes-800.webp'}
];
function slide(b,i){return '<div class="splide__slide vd-slide"><a href="'+b.h+'" class="promo-slider__item"><div class="promo-slider__item-photo"><div class="img-ratio img-ratio_cover"><div class="img-ratio__inner"><picture><source media="(max-width:768px)" srcset="'+b.m+'" type="image/webp"><img src="'+b.d+'" alt="'+b.t+'" decoding="async"'+(i?' loading="lazy"':' fetchpriority="high"')+'></picture></div></div></div><div class="promo-slider__item-content"><div class="promo-slider__item-content-inner"><div class="promo-slider__item-content__title">'+b.t+'</div><div class="promo-slider__item-content__description">'+b.s+'</div></div></div></a></div>';}
var SLQ='.widget-type_system_widget_v4_promo_slider_19 .splide__list';
function inject(l){if(!l||l.getAttribute('data-vd-b'))return;l.setAttribute('data-vd-b','1');l.insertAdjacentHTML('afterbegin',B.map(slide).join(''));}
var BT=[["cassoli","5081/135246809/original/vd-brand-tile-cassoli.webp"],["gelinhome","5089/135246817/original/vd-brand-tile-gelin-home.webp"],["images__1_","5097/135246825/original/vd-brand-tile-nusa.webp"],["limasso","5105/135246833/original/vd-brand-tile-limasso.webp"],["imgi_201","5113/135246841/original/vd-brand-tile-santfair.webp"],["zalel","5121/135246849/original/vd-brand-tile-zalel.webp"],["majoli","5129/135246857/original/vd-brand-tile-majoli.webp"],["footer_logo","5137/135246865/original/vd-brand-tile-hazangulu.webp"],["imgi_39","5145/135246873/original/vd-brand-tile-pupilla.webp"],["vordien","5153/135246881/original/vd-brand-tile-vordien.webp"],["class-new","5161/135246889/original/vd-brand-tile-class-home.webp"],["karacan","5169/135246897/original/vd-brand-tile-karacan.webp"],["clasy","5177/135246905/original/vd-brand-tile-clasy.webp"]],BQ='.widget-type_system_widget_v4_banner_list_27 .splide__list';
function brands(){var l=d.querySelector(BQ);if(!l)return;[].forEach.call(l.querySelectorAll('.splide__slide'),function(s){var im=s.querySelector('img');if(!im||im.getAttribute('data-vd-t'))return;var n=decodeURIComponent((im.getAttribute('data-src')||'')+' '+(im.getAttribute('src')||'')+' '+[].map.call(s.querySelectorAll('source'),function(x){return (x.getAttribute('data-srcset')||'')+' '+(x.getAttribute('srcset')||'')}).join(' ')).toLowerCase();if(n.indexOf('images-new-scale-4_00x-picsart')>-1){s.parentNode.removeChild(s);return;}for(var k=0;k<BT.length;k++){if(n.indexOf(BT[k][0])>-1){var u=F+BT[k][1];[].forEach.call(s.querySelectorAll('source'),function(x){x.setAttribute('srcset',u);x.setAttribute('data-srcset',u)});im.setAttribute('data-src',u);im.setAttribute('src',u);im.removeAttribute('srcset');im.setAttribute('data-vd-l','1');im.setAttribute('data-vd-t','1');im.classList.add('vd-btile');var VL={cassoli:'cassoli',gelinhome:'gelin-home',images__1_:'nusa',limasso:'limasso',zalel:'zalel',majoli:'majoli',footer_logo:'hazangulu',imgi_39:'pupilla',karacan:'karacan'}[BT[k][0]];if(VL&&!s.querySelector('a.vd-bl')){var A=d.createElement('a');A.className='vd-bl';A.href='/collection/'+VL;A.setAttribute('aria-label','Товары бренда '+VL);A.style.display='block';while(s.firstChild)A.appendChild(s.firstChild);s.appendChild(A);}break;}}});}
var DROP=/podushki-i-odeyala/;function drop(){[].forEach.call(d.querySelectorAll(SLQ+' > .splide__slide:not(.vd-slide)'),function(s){var a=s.querySelector('a');if(a&&DROP.test(a.getAttribute('href')||''))s.parentNode.removeChild(s);});}
if(isHome&&window.MutationObserver){var mo=new MutationObserver(function(){var l=d.querySelector(SLQ);if(l){inject(l);drop();}brands();});mo.observe(d.documentElement,{childList:true,subtree:true});d.addEventListener('DOMContentLoaded',function(){mo.disconnect();inject(d.querySelector(SLQ));drop();brands();});}
/* 2) Товарные подборки */
function ls(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||'null');localStorage.setItem(k,JSON.stringify(v));}catch(e){return null}}
function sh(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function rub(n){return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' ₽'}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var CNT={'reklama-direct':139,'postelnoe-belie':105,'nabor-polotenets':58,'halaty':47,'pledy-i-pokryvala':21,'podushki-i-odeyala':13,'kovriki-dlya-vannoy':48,'domashnie-halaty':12,'kovry-i-kovriki':39};
function load(h,size,pg){if(!pg){var c=ls('vd_cnt_'+h)||CNT[h]||size;pg=1+Math.floor(Math.random()*Math.max(1,Math.ceil(c/size)));}
return fetch('/collection/'+h+'.json?page_size='+size+'&page='+pg,{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){if(j&&j.count)ls('vd_cnt_'+h,j.count);return (j&&j.products||[]).filter(function(p){return p.available&&p.first_image&&p.variants&&p.variants.some(function(v){return v.available})}).map(function(p){p._h=h;return p})}).catch(function(){return []});}
function mix(groups,n,key){var seen=ls(key)||[],ids={},gs=[],out=[];
groups.forEach(function(g){g=g.filter(function(p){if(ids[p.id])return false;ids[p.id]=1;return true});if(!g.length)return;g=sh(g);gs.push(g.filter(function(p){return seen.indexOf(p.id)<0}).concat(g.filter(function(p){return seen.indexOf(p.id)>=0})));});
gs=sh(gs);var i=0;while(out.length<n&&gs.some(function(g){return g.length})){var g=gs[i%gs.length];if(g.length)out.push(g.shift());i++;}
ls(key,out.map(function(p){return p.id}).concat(seen).slice(0,60));return sh(out);}
function kind(t){t=t.toLowerCase();return /халат/.test(t)?'robe':/полотен/.test(t)?'towel':/плед|покрывал/.test(t)?'pled':/постельн|кпб|простын|пододеял/.test(t)?'bed':'other';}
function pages(h,size,k){var c=ls('vd_cnt_'+h)||CNT[h]||size,n=Math.max(1,Math.ceil(c/size)),a=[];for(var i=1;i<=n;i++)a.push(i);return sh(a).slice(0,k);}
function card(p){var v=p.variants.filter(function(x){return x.available})[0]||p.variants[0],pr=+v.price,old=+v.old_price||0,dc=old>pr?Math.round((1-pr/old)*100):0,img=p.first_image.large_url||p.first_image.medium_url||p.first_image.original_url,multi=p.variants.filter(function(x){return x.available}).length>1,u=p.url||('/product/'+p.permalink);
return '<div class="vd-rc"><a class="vd-rc-img" href="'+u+'"><img src="'+img+'" alt="'+esc(p.title)+'" loading="lazy" decoding="async">'+(dc>=3?'<span class="vd-rc-badge">−'+dc+'%</span>':'')+'</a><a class="vd-rc-t" href="'+u+'">'+esc(p.title)+'</a><div class="vd-rc-p"><b>'+rub(pr)+'</b>'+(dc>=3?'<s>'+rub(old)+'</s>':'')+'</div>'+(multi?'<a class="vd-rc-btn" href="'+u+'">Выбрать</a>':'<button type="button" class="vd-rc-btn" data-v="'+v.id+'" data-u="'+u+'">В корзину</button>')+'</div>';}
function skel(n){var s='';for(var i=0;i<n;i++)s+='<div class="vd-rc is-skel"><div class="vd-rc-img"></div><div class="vd-rc-t">&nbsp;</div><div class="vd-rc-p"></div></div>';return s;}
function section(id,title,sub){var s=d.createElement('section');s.className='vd-section vd-reco';s.id=id;s.innerHTML='<div class="vd-reco-head"><h2 class="vd-h2">'+title+'</h2><span class="vd-reco-sub">'+sub+'</span></div><div class="vd-reco-grid">'+skel(6)+'</div>';return s;}
function fill(sec,items){var g=sec.querySelector('.vd-reco-grid');if(!items.length){sec.parentNode&&sec.parentNode.removeChild(sec);return;}g.innerHTML=items.map(card).join('');}
d.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.vd-rc-btn[data-v]');if(!b)return;e.preventDefault();
if(b.classList.contains('is-added')){location.href='/cart_items';return;}
b.disabled=true;var fd=new FormData();fd.append('variant_id',b.getAttribute('data-v'));fd.append('quantity','1');
fetch('/cart_items.json',{method:'POST',body:fd,credentials:'same-origin',headers:{Accept:'application/json'}}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(c){if(P.indexOf('/cart_items')===0){location.reload();return;}b.disabled=false;b.classList.add('is-added');b.textContent='✓ В корзине — перейти';var n=(c&&c.items)?c.items.length:null;if(n!==null)[].forEach.call(d.querySelectorAll('[data-cart-positions-count]'),function(x){x.textContent=n});try{if(window.Cart&&Cart.getCart)Cart.getCart()}catch(er){}}).catch(function(){location.href=b.getAttribute('data-u')});},true);
function home(){var sl=d.querySelector('.widget-type_system_widget_v4_promo_slider_19');if(!sl||d.getElementById('vd-hits'))return;
var sec=section('vd-hits','Лучшие предложения','Подборка обновляется при каждом визите');sl.parentNode.insertBefore(sec,sl.nextSibling);
var reqs=pages('reklama-direct',8,2).map(function(pg){return load('reklama-direct',8,pg)});reqs.push(load('pledy-i-pokryvala',6));
Promise.all(reqs).then(function(r){var all=[].concat.apply([],r),g={};all.forEach(function(p){var k=kind(p.title);(g[k]=g[k]||[]).push(p)});fill(sec,mix(Object.keys(g).map(function(k){return g[k]}),8,'vd_seen_hits'));});pop(sec);shelf('vd-women','Женская одежда','Смотреть все','zhenskaya-odezhda','vd-pop');}
/* Полки на главной: женская одежда, косметика (по категориям) */
function shelf(id,title,sub,h,afterId){if(d.getElementById(id))return;var ref=d.getElementById(afterId)||d.getElementById('vd-hits');if(!ref)return;var s=section(id,title,'<a href="/collection/'+h+'" style="color:inherit">'+sub+' →</a>');ref.parentNode.insertBefore(s,ref.nextSibling);
var go=function(){if(s.__vdGo)return;s.__vdGo=1;Promise.all([load(h,24),load(h,24)]).then(function(r){fill(s,mix([[].concat.apply([],r)],8,'vd_seen_'+id));});};
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(en){if(en.some(function(x){return x.isIntersecting})){io.disconnect();go();}},{rootMargin:'600px 0px'});io.observe(s);setTimeout(function(){io.disconnect();go()},7000);}else go();}
/* Чаще всего смотрят: скрытая категория populyarnoe (по просмотрам Метрики) */
function pop(after){if(d.getElementById('vd-pop'))return;var s=section('vd-pop','Чаще всего смотрят','Товары, которые покупатели открывают чаще всего');var pc=d.getElementById('vd-popcat'),an=(pc&&pc.previousElementSibling===after)?pc:after;an.parentNode.insertBefore(s,an.nextSibling);
var go=function(){if(s.__vdGo)return;s.__vdGo=1;Promise.all([load('populyarnoe',30,1),load('populyarnoe',30,2)]).then(function(r){var shown={};[].forEach.call(d.querySelectorAll('#vd-hits .vd-rc-t'),function(a){shown[a.getAttribute('href')]=1});var all=[].concat.apply([],r).filter(function(p){return !shown[p.url||('/product/'+p.permalink)]}),g={};all.forEach(function(p){var k=kind(p.title);(g[k]=g[k]||[]).push(p)});fill(s,mix(Object.keys(g).map(function(k){return g[k]}),8,'vd_seen_pop'));});};
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(en){if(en.some(function(x){return x.isIntersecting})){io.disconnect();go();}},{rootMargin:'600px 0px'});io.observe(s);setTimeout(function(){io.disconnect();go()},6000);}else go();}
var POOL=['postelnoe-belie','nabor-polotenets','halaty','pledy-i-pokryvala','podushki-i-odeyala','kovriki-dlya-vannoy','domashnie-halaty'];
function coll(){if(d.getElementById('vd-also'))return;var cat=d.querySelector('.widget-type_system_widget_v4_catalog_1');if(!cat)return;
var cur=(P.split('/')[2]||'').split('?')[0];if(cur==='reklama-direct')return;
var sec=section('vd-also','Вам также понравится','Товары из других категорий');sec.querySelector('.vd-reco-grid').innerHTML=skel(8);var pag=d.querySelector('[class*="widget-type_system_widget_v4_pagination"]'),an=(pag&&pag.parentNode===cat.parentNode)?pag:cat;an.parentNode.insertBefore(sec,an.nextSibling);
var go=function(){if(sec.__vdGo)return;sec.__vdGo=1;var hs=sh(POOL.filter(function(h){return h!==cur})).slice(0,3);Promise.all(hs.map(function(h){return load(h,6)})).then(function(r){fill(sec,mix(r,8,'vd_seen_also'));});};
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(en){if(en.some(function(x){return x.isIntersecting})){io.disconnect();go();}},{rootMargin:'700px 0px'});io.observe(sec);setTimeout(function(){io.disconnect();go()},8000);}else go();}
/* Metrika: переход к оформлению заказа (цель checkout_open) */
d.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('a,button');if(!b||b.__vdCo)return;var t=(b.textContent||'').trim(),h=b.getAttribute('href')||'';if(/^Оформить заказ/.test(t)||/\/gocheckout|\/new_order/.test(h)){b.__vdCo=1;try{if(window.ym)ym(111939871,'reachGoal','checkout_open')}catch(er){}}},true);
window.VDR={load:load,mix:mix,card:card,section:section,fill:fill,kind:kind,sh:sh,skel:skel,ls:ls,rub:rub};
/* Нет в наличии: похожие товары в наличии рядом с ценой */
function oos(){if(d.getElementById('vd-oos'))return;var ba=d.querySelector('.product__buy-btn-area'),pr=d.querySelector('.product__price');if(!pr)return;
var out=false;[].forEach.call(d.querySelectorAll('script[type="application/ld+json"]'),function(s){try{var j=JSON.parse(s.textContent);if(j&&j['@type']==='Product'){var o=[].concat(j.offers||[]);if(o.length&&o.every(function(x){return /OutOfStock/.test(x.availability||'')}))out=true;}}catch(e){}});
if(!out&&!(ba&&getComputedStyle(ba).display==='none'))return;
var bc=[].slice.call(d.querySelectorAll('[class*=breadcrumb] a[href*="/collection/"]')).map(function(a){return (a.getAttribute('href').split('/collection/')[1]||'').split(/[?#]/)[0]}).filter(Boolean),h=bc[bc.length-1]||'populyarnoe';
var s=d.createElement('div');s.id='vd-oos';s.className='vd-oos';s.innerHTML='<div class="vd-oos-t">Этого товара сейчас нет в наличии</div><div class="vd-oos-s">Похожие товары, которые можно заказать сейчас:</div><div class="vd-reco-grid">'+skel(3)+'</div><a class="vd-oos-all" href="/collection/'+h+'">Все товары категории →</a>';
pr.parentNode.insertBefore(s,pr.nextSibling);
var me=P.split('?')[0];Promise.all([load(h,12),load(h,12)]).then(function(r){var a=[].concat.apply([],r).filter(function(p){return (p.url||('/product/'+p.permalink))!==me});if(a.length<3)return load('populyarnoe',30,1).then(function(x){return a.concat(x)});return a;}).then(function(a){fill(s,mix([a],6,'vd_seen_oos'));});}
/* Поиск: подходящие категории + товары категории, если результатов мало */
var SC=[[/плед|покрывал|пике/,'pledy-i-pokryvala','Пледы и покрывала'],[/постел|кпб|бель|простын|пододеял|наволоч|комплект/,'postelnoe-belie','Постельное бельё'],[/подушк|одеял/,'podushki-i-odeyala','Подушки и одеяла'],[/полотен|махр/,'nabor-polotenets','Полотенца'],[/(жен|дам).*халат|халат.*(жен|дам)/,'zhenskie-halaty','Женские халаты'],[/муж.*халат|халат.*муж/,'muzhskie-halaty','Мужские халаты'],[/халат|бамбук|вафел|nusa|нуса/,'halaty','Халаты'],[/коврик|ковр|ковер/,'kovriki-dlya-vannoy','Коврики для ванной'],[/пижам|сороч|домашн.*одеж/,'domashnyaya-odezhda','Домашняя одежда'],[/скатерт/,'skaterti','Скатерти']];
function srch(){if(d.getElementById('vd-srch'))return;var q='';try{q=(new URLSearchParams(location.search).get('q')||'').toLowerCase().replace(/ё/g,'е')}catch(e){}if(!q)return;
var u={},m=SC.filter(function(x){if(u[x[1]]||!x[0].test(q))return false;u[x[1]]=1;return true}).slice(0,3);if(!m.length)return;
var cat=d.querySelector('.widget-type_system_widget_v4_catalog_2');if(!cat)return;var n=cat.querySelectorAll('[data-product-id]').length;
var c=d.createElement('div');c.id='vd-srch';c.className='vd-srch';c.innerHTML='<span>Подходящие категории:</span>'+m.map(function(x){return '<a href="/collection/'+x[1]+'">'+x[2]+' →</a>'}).join('');var lc=cat.querySelector('.layout__content')||cat;lc.insertBefore(c,lc.firstChild);
if(n>=8)return;var sec=section('vd-srch-more',n?'Ещё по вашему запросу':'Возможно, вам подойдёт','Из категории «'+m[0][2]+'»');lc.appendChild(sec);
var have={};[].forEach.call(cat.querySelectorAll('[data-product-id]'),function(e){have[e.getAttribute('data-product-id')]=1});
load(m[0][1],24,1).then(function(a){fill(sec,mix([a.filter(function(p){return !have[p.id]})],8,'vd_seen_srch'));});}
function run(){try{if(isHome)home();else if(P.indexOf('/collection/')===0)coll();else if(P.indexOf('/product/')===0)oos();else if(P.indexOf('/search')===0)srch();}catch(e){}}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',run);else run();
})();
}catch(e){if(window.console)console.warn("vd-bundle vd-reco",e)}

/* vd-conv */
try{
(function(){
var d=document,P=location.pathname;
var isHome=(P==='/'||P===''),isProd=P.indexOf('/product/')===0,isColl=P.indexOf('/collection/')===0,isCart=P.indexOf('/cart_items')===0;
var noPromo=/^\/(cart_items|new_order|gocheckout|orders|client_account|page\/(oferta|privacy|agreement))/.test(P);
var TG='https://t.me/elitmostex',WA='https://wa.me/79691021024',FREE=3000;
var MON=['янв.','февр.','марта','апр.','мая','июня','июля','авг.','сент.','окт.','нояб.','дек.'];
function ls(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||'null');localStorage.setItem(k,JSON.stringify(v));}catch(e){return null}}
function addBiz(x,n){x=new Date(x.getTime());while(n>0){x.setDate(x.getDate()+1);var w=x.getDay();if(w!==0&&w!==6)n--;}return x;}
function range(){var n=new Date(),m=new Date(n.getTime()+(n.getTimezoneOffset()+180)*60000),a=addBiz(m,3),b=addBiz(m,5);return a.getDate()+(a.getMonth()!==b.getMonth()?' '+MON[a.getMonth()]:'')+'–'+b.getDate()+' '+MON[b.getMonth()];}
var I={truck:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>',
ret:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
chat:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>'};
function isBed(t){return /постельн|кпб|пододеял|простын/i.test(t);}
function fabric(){var e=d.createElement('details');e.className='vd-fab';e.innerHTML='<summary>Сатин, поплин, ранфорс или перкаль — в чём разница?</summary><div class="vd-fab-w"><table><tr><th>Ткань</th><th>Какая на ощупь</th><th>Кому подойдёт</th></tr>'+
'<tr><td>Сатин</td><td>Гладкий, с мягким блеском, почти не мнётся</td><td>Любителям шелковистой гладкости, круглый год</td></tr>'+
'<tr><td>Поплин</td><td>Мягкий, матовый, с мелким рубчиком, хорошо дышит</td><td>На каждый день и для тёплого сезона</td></tr>'+
'<tr><td>Ранфорс</td><td>Плотный и гладкий, выдерживает частые стирки</td><td>Тем, кому важна прочность</td></tr>'+
'<tr><td>Перкаль</td><td>Прохладный, матовый, слегка «хрустящий»</td><td>Тем, кому жарко ночью</td></tr>'+
'<tr><td>Варёный хлопок</td><td>Очень мягкий, с эффектом лёгкой мятости, не требует глажки</td><td>Для уютной спальни в стиле casual</td></tr>'+
'</table><a class="vd-fab-more" href="/blogs/blog/satin-ranfors-poplin-kakoe-postelnoe-belye-vybrat-2">Подробнее в нашем гиде →</a></div>';return e;}
function pinfo(){var f=d.querySelector('form.product-form');if(!f||d.querySelector('.vd-pinfo'))return;var anchor=f.querySelector('.vd-w-trust')||f.querySelector('.product__controls');if(!anchor)return;
var b=d.createElement('div');b.className='vd-pinfo';
b.innerHTML='<div class="vd-pi">'+I.truck+'<span><b>Доставка 3–5 рабочих дней</b> · ориентировочно '+range()+'</span></div>'+
'<div class="vd-pi">'+I.ret+'<span>Возврат и обмен в течение 14 дней — <a href="/page/exchange">условия</a></span></div>'+'<div class="vd-pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg><span>Оплата онлайн при заказе: СБП, SberPay или банковская карта</span></div>'+'<div class="vd-pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9l2-5h14l2 5M4 9v11h16V9M9 20v-6h6v6"/></svg><span>Наш магазин: Балашиха, Щёлковское ш., вл. 141, ежедневно 10:00–21:00 — <a href="/page/contacts">как добраться</a></span></div>'+
'<div class="vd-pi vd-pi-rate"><iframe src="https://yandex.ru/sprav/widget/rating-badge/60700143797?type=rating" width="150" height="50" loading="lazy" title="Рейтинг магазина на Яндекс Картах"></iframe><span><a href="https://yandex.ru/maps/org/tovary_dlya_doma/60700143797/reviews/" target="_blank" rel="noopener">Отзывы покупателей о магазине</a></span></div>'+
'<div class="vd-pi">'+I.chat+'<span>Есть вопрос о товаре? <a href="'+TG+'" target="_blank" rel="noopener">Telegram</a> · <a href="'+WA+'" target="_blank" rel="noopener">WhatsApp</a></span></div>';
anchor.parentNode.insertBefore(b,anchor.nextSibling);
var h=d.querySelector('h1'),bc=(d.querySelector('[class*=breadcrumb]')||{}).textContent||'';if(isBed((h?h.textContent:'')+' '+bc)&&!d.querySelector('.vd-fab'))b.parentNode.insertBefore(fabric(),b.nextSibling);}
function relocate(){var b=d.querySelector('.vd-pinfo'),t=d.querySelector('form.product-form .vd-w-trust');if(!b||!t)return;var an=t;if(t.nextElementSibling&&t.nextElementSibling.classList.contains('vd-size'))an=t.nextElementSibling;if(an.nextElementSibling!==b){an.parentNode.insertBefore(b,an.nextSibling);var fb=d.querySelector('.vd-fab');if(fb&&fb.parentNode===b.parentNode)b.parentNode.insertBefore(fb,b.nextSibling);}}
var COMP={bed:['podushki-i-odeyala','pledy-i-pokryvala','nabor-polotenets'],pled:['postelnoe-belie','podushki-i-odeyala'],towel:['halaty','kovriki-dlya-vannoy'],robe:['nabor-polotenets','kovriki-dlya-vannoy','domashnie-halaty'],other:['postelnoe-belie','nabor-polotenets','pledy-i-pokryvala']};
function complement(){var V=window.VDR;if(!V||d.getElementById('vd-comp'))return;var pw=d.querySelector('.widget-type_system_widget_v4_product_2');var h=d.querySelector('h1');if(!pw||!h)return;
var f=d.querySelector('form.product-form'),pid=f&&(f.getAttribute('data-product-id')||(f.querySelector('[data-product-id]')||{getAttribute:function(){return ''}}).getAttribute('data-product-id'));
var k=V.kind(h.textContent);if(k==='other'&&isBed(h.textContent))k='bed';var hs=COMP[k]||COMP.other;
var sec=V.section('vd-comp','Дополните комплект','Подобрали к этому товару');pw.parentNode.insertBefore(sec,pw.nextSibling);
var go=function(){if(sec.__vdGo)return;sec.__vdGo=1;Promise.all(hs.map(function(x){return V.load(x,6)})).then(function(r){r=r.map(function(l){return l.filter(function(p){return String(p.id)!==String(pid)})});V.fill(sec,V.mix(r,8,'vd_seen_comp'));});};
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(en){if(en.some(function(x){return x.isIntersecting})){io.disconnect();go();}},{rootMargin:'600px 0px'});io.observe(sec);setTimeout(function(){io.disconnect();go()},8000);}else go();}
function cart(){var V=window.VDR;if(!V||d.getElementById('vd-cartadd'))return;var cw=d.querySelector('.widget-type_system_widget_v4_cart_2');if(!cw)return;
fetch('/cart_items.json',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(function(r){return r.json()}).then(function(j){var s=parseFloat(j&&j.items_price)||0;if(s<=0||s>=FREE||d.getElementById('vd-cartadd'))return;var left=FREE-s;
var sec=V.section('vd-cartadd','Добавьте до бесплатной доставки','Осталось '+V.rub(left)+' до бесплатной доставки в пункт выдачи');cw.parentNode.insertBefore(sec,cw.nextSibling);
Promise.all(['nabor-polotenets','kovriki-dlya-vannoy','podushki-i-odeyala','pledy-i-pokryvala'].map(function(x){return V.load(x,10)})).then(function(r){var all=[].concat.apply([],r).filter(function(p){var v=p.variants.filter(function(x){return x.available})[0];return v&&+v.price>=left});all.sort(function(a,b){return (+a.variants[0].price)-(+b.variants[0].price)});V.fill(sec,all.slice(0,8));});}).catch(function(){});}
function fabColl(){var h=(P.split('/')[2]||'').split('?')[0];if(['postelnoe-belie','spalnya'].indexOf(h)<0||d.querySelector('.vd-fab'))return;var desc=d.querySelector('[class*="widget-type_system_widget_v4_collection_description"]'),cat=d.querySelector('.widget-type_system_widget_v4_catalog_1');var wrap=d.createElement('div');wrap.className='vd-section';wrap.appendChild(fabric());if(desc)desc.parentNode.insertBefore(wrap,desc);else if(cat)cat.parentNode.insertBefore(wrap,cat.nextSibling);}
function promo(){if(noPromo)return;var t=ls('vd_promo_t');if(t&&Date.now()-t<14*864e5)return;setTimeout(function(){if(d.querySelector('.vd-promo'))return;ls('vd_promo_t',Date.now());var p=d.createElement('div');p.className='vd-promo';p.setAttribute('role','dialog');p.setAttribute('aria-label','Скидка на первый заказ');
p.innerHTML='<button type="button" class="vd-promo-x" aria-label="Закрыть">×</button><div class="vd-promo-t">−7% на первый заказ</div><div class="vd-promo-s">Введите промокод при оформлении заказа</div><button type="button" class="vd-promo-code">VORDIEN7<span>скопировать</span></button><a class="vd-promo-tg" href="'+TG+'" target="_blank" rel="noopener">Задать вопрос в Telegram</a>';
if(d.querySelector('.vd-sticky'))p.classList.add('is-raised');d.body.appendChild(p);requestAnimationFrame(function(){p.classList.add('is-on')});
p.querySelector('.vd-promo-x').onclick=function(){p.classList.remove('is-on');setTimeout(function(){p.remove()},300)};
p.querySelector('.vd-promo-code').onclick=function(){var b=this;try{navigator.clipboard.writeText('VORDIEN7')}catch(e){}b.innerHTML='VORDIEN7<span>скопировано ✓</span>'};},20000);}
function turk(){[].forEach.call(d.querySelectorAll('.vd-w-badges'),function(b){var f=b.querySelector('span');if(!f||!/Турци/.test(f.textContent))return;var on=false;if(isProd){[].forEach.call(d.querySelectorAll('.property'),function(p){var nm=p.querySelector('.property-name');if(nm&&/Страна производства/.test(nm.textContent)&&/Турци/.test(p.textContent.replace(nm.textContent,'')))on=true;});}b.classList.toggle('vd-tr-on',on);});}
function run(){try{turk();if(isProd){pinfo();relocate();complement();}if(isColl)fabColl();if(isCart)cart();}catch(e){}}
function start(){run();promo();[800,2500].forEach(function(t){setTimeout(run,t)});}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start);else start();
})();
}catch(e){if(window.console)console.warn("vd-bundle vd-conv",e)}

/* vd-chat */
try{
(function(){
var d=document,P=location.pathname;if(/^\/(new_order|gocheckout|orders\/)/.test(P))return;
var PH='79691021024',TG='https://t.me/elitmostex';
function build(){if(d.querySelector('.vd-chat'))return;var h1=d.querySelector('h1'),isProd=P.indexOf('/product/')===0;
var msg='Здравствуйте! '+(isProd&&h1?'Вопрос по товару: '+h1.textContent.trim()+' — '+location.href.split('?')[0]:'У меня вопрос по заказу на vordien.ru');
var wa='https://wa.me/'+PH+'?text='+encodeURIComponent(msg);
var c=d.createElement('div');c.className='vd-chat';
c.innerHTML='<div class="vd-chat-panel" role="dialog" aria-label="Онлайн-консультант"><div class="vd-chat-head"><button type="button" class="vd-chat-x" aria-label="Закрыть">×</button><b>Онлайн-консультант</b><span>Поможем с выбором размера, ткани и доставкой</span></div><div class="vd-chat-list">'+
'<a href="'+wa+'" target="_blank" rel="noopener" data-ch="wa"><i style="background:#25d366"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-5.6c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.5.1-.6.8-.8.9-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2 4.7 4.7 0 0 0 1 2.5 10.8 10.8 0 0 0 4.1 3.6c1.5.7 2.1.7 2.9.6a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c0-.1-.2-.2-.4-.3z"/></svg></i><span>WhatsApp<small>Напишите — ответим в чате</small></span></a>'+
'<a href="'+TG+'" target="_blank" rel="noopener" data-ch="tg"><i style="background:#2aa3df"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.5 3.6 2.9 10.8c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.8c.3-1.3-.5-1.9-1.5-1.4zM8.9 13.4l9.6-6c.5-.3.9-.1.5.2l-8.1 7.3-.3 3.4-1.7-4.9z"/></svg></i><span>Telegram<small>Консультант в Telegram</small></span></a>'+
'<a href="tel:+'+PH+'" data-ch="tel"><i style="background:#b8925a"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg></i><span>+7 969 102-10-24<small>Позвонить</small></span></a>'+
'</div></div><span class="vd-chat-tip">Есть вопрос? Напишите нам</span><button type="button" class="vd-chat-btn" aria-label="Онлайн-консультант" aria-expanded="false"><span class="vd-chat-dot"></span><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/></svg></button>';
d.body.appendChild(c);var btn=c.querySelector('.vd-chat-btn');
function tog(o){c.classList.toggle('is-open',o);btn.setAttribute('aria-expanded',o?'true':'false');}
btn.onclick=function(){tog(!c.classList.contains('is-open'))};c.querySelector('.vd-chat-x').onclick=function(){tog(false)};
d.addEventListener('click',function(e){if(!c.contains(e.target))tog(false)});
c.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-ch]');if(a){try{if(window.ym&&window.__vdYm)ym(window.__vdYm,'reachGoal','chat_'+a.getAttribute('data-ch'))}catch(er){}}});
var raise=function(){var s=d.querySelector('.vd-sticky');c.classList.toggle('is-raised',!!(s&&s.offsetHeight))};raise();setTimeout(raise,1500);}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',build);else build();
})();
}catch(e){if(window.console)console.warn("vd-bundle vd-chat",e)}

/* vd-filter */
try{
(function(){
var d=document;
function fix(){
  var ws=d.querySelectorAll('.widget-type_system_widget_v4_filter_sort_3');
  for(var i=0;i<ws.length;i++){var w=ws[i],st=w.getAttribute('style')||'';
    if(st.indexOf('--filter-onchange-submit:true')>-1)w.setAttribute('style',st.replace('--filter-onchange-submit:true','--filter-onchange-submit:false'));
    var fs=w.querySelectorAll('form.filter.live-submit');
    for(var j=0;j<fs.length;j++){fs[j].classList.remove('live-submit');fs[j].classList.add('vd-nolive');}
  }
}
fix();
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',fix);
window.addEventListener('load',fix);
})();
}catch(e){if(window.console)console.warn("vd-bundle vd-filter",e)}

/* vd-cmp */
try{
(function(){
if(location.pathname.indexOf('/compares')!==0)return;
var d=document,busy=0;
function rub(v){return Math.round(+v).toLocaleString('ru-RU')+' ₽'}
function prods(){try{return (window.Compare&&Compare.products)||[]}catch(e){return[]}}
function find(id){var ps=prods();for(var i=0;i<ps.length;i++)if(String(ps[i].id)===String(id))return ps[i];return null}
function addRow(tbl,title,vals,cls){if(tbl.querySelector('.'+cls))return;var r=d.createElement('div');r.className='compare-row '+cls;var t=d.createElement('div');t.className='compare-param param-title';t.textContent=title;r.appendChild(t);vals.forEach(function(v){var c=d.createElement('div');c.className='compare-param param-value';c.setAttribute('data-compared-id',v.id);c.innerHTML=v.html;r.appendChild(c)});
  var same=vals.length>1&&vals.every(function(v){return v.html===vals[0].html});if(same)r.className+=' same-row';
  tbl.appendChild(r)}
function run(){if(busy)return;busy=1;try{
  var w=d.querySelector('.widget-type_system_widget_v4_compare_1');if(!w)return;
  var tbl=w.querySelector('.js-compare-table');var cards=w.querySelectorAll('.compare-product');
  if(!tbl||!cards.length){var inner=w.querySelector('#js-compare-inner')||w.querySelector('.compares');if(inner&&!w.querySelector('.vd-cmp-empty')&&!prods().length){var e=d.createElement('div');e.className='vd-cmp-empty';e.innerHTML='В сравнении пока нет товаров. Нажмите «Добавить в сравнение» на странице товара, чтобы сравнить состав, размеры и цены.<br><a href="/collection/all">Перейти в каталог</a>';inner.appendChild(e)}return}
  tbl.style.setProperty('--vd-n',cards.length);
  var avail=[],sizes=[],multi=0;
  cards.forEach(function(c){var id=c.getAttribute('data-compared-id'),p=find(id);if(!p)return;
    var vs=p.variants||[],av=vs.filter(function(v){return v.available});
    var price=c.querySelector('.product-price');var v0=av[0]||vs[0];
    if(price&&v0&&!price.querySelector('.vd-cmp-old')&&v0.old_price&&+v0.old_price>+v0.price){var o=d.createElement('span');o.className='vd-cmp-old';o.textContent=rub(v0.old_price);price.appendChild(o)}
    if(!c.querySelector('.vd-cmp-buy')){var b;
      if(!av.length){b=d.createElement('button');b.type='button';b.className='vd-cmp-buy is-alt';b.disabled=true;b.textContent='Нет в наличии'}
      else if(vs.length>1){b=d.createElement('a');b.className='vd-cmp-buy is-alt';b.href=p.url;b.textContent='Выбрать размер'}
      else{b=d.createElement('button');b.type='button';b.className='vd-cmp-buy';b.textContent='В корзину';b.onclick=function(ev){ev.preventDefault();var btn=this;btn.disabled=true;var items={};items[av[0].id]=1;
        var done=function(){btn.disabled=false;btn.classList.add('is-done');btn.textContent='✓ В корзине'};
        try{if(window.Cart&&Cart.add){var r=Cart.add({items:items});if(r&&r.then)r.then(done,done);else done();return}}catch(er){}
        fetch('/cart_items.json',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'variant_id='+av[0].id+'&quantity=1',credentials:'same-origin'}).then(done,done)}}
      var form=c.querySelector('form.compare-controls');if(form)form.parentNode.insertBefore(b,form);else c.appendChild(b)}
    avail.push({id:id,html:av.length?'<span class="vd-cmp-ok">В наличии</span>':'<span class="vd-cmp-no">Нет в наличии</span>'});
    if(vs.length>1)multi=1;
    sizes.push({id:id,html:vs.length>1?(av.length?av.map(function(v){return v.title}).join(', '):'—'):'—'});
  });
  if(avail.length===cards.length){addRow(tbl,'Наличие',avail,'vd-row-avail');if(multi)addRow(tbl,'Варианты в наличии',sizes,'vd-row-sizes')}
}finally{busy=0}}
function boot(){run();var w=d.querySelector('#js-compare-wrapper')||d.querySelector('.widget-type_system_widget_v4_compare_1');if(w&&window.MutationObserver){var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(run,60)}).observe(w,{childList:true,subtree:true})}setTimeout(run,1200)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
})();
}catch(e){if(window.console)console.warn("vd-bundle vd-cmp",e)}

/* vd-404 */
try{
(function(){var d=document;function f(){if(d.title&&d.title.trim())return;var els=d.querySelectorAll('p,div,h1,h2,h3');var box=null;for(var i=0;i<els.length;i++){var e=els[i];if(e.children.length<8&&/страниц[уыа]\s*404/i.test(e.textContent||'')&&!e.querySelector('header')){box=e}}if(!box)return;d.title='Страница не найдена — Vordien Home';if(d.querySelector('.vd-404'))return;var w=d.createElement('div');w.className='vd-404';w.innerHTML='<a class="is-main" href="/">На главную</a><a href="/collection/all">Весь каталог</a><a href="/collection/postelnoe-belie">Постельное бельё</a><a href="/collection/nabor-polotenets">Полотенца</a><a href="/collection/halaty">Халаты</a>';var host=box.closest('.static-text,.layout__content')||box.parentNode;host.appendChild(w)}if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',f);else f()})();
}catch(e){if(window.console)console.warn("vd-bundle vd-404",e)}

/* s16 */
try{
/* vd-track: страница отслеживания + ссылка в подвале */
(function(){function q(s){return document.querySelector(s)}
function init(){var b=q('#vd-trk-btn'),i=q('#vd-trk-in'),m=q('#vd-trk-msg');if(b&&i&&!b.__vd){b.__vd=1;var go=function(){var v=(i.value||'').trim().replace(/\s+/g,'');if(!v){m.textContent='Введите трек-номер.';return}
if(/^\d{8,14}$/.test(v)){window.open('https://www.cdek.ru/ru/tracking?order_id='+encodeURIComponent(v),'_blank');m.textContent='Открываем отслеживание СДЭК…';}
else{try{navigator.clipboard&&navigator.clipboard.writeText(v)}catch(e){}window.open('https://dostavka.yandex.ru/ndd/tracking','_blank');m.textContent='Открываем Яндекс Доставку. Номер '+v+' скопирован — вставьте его в поле поиска.';}
try{ym(111939871,'reachGoal','track_lookup')}catch(e){}};b.addEventListener('click',go);i.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go()}})}
var f=q('footer');if(f&&!q('#vd-track-link')){var l=f.querySelector('a[href*="/page/delivery"]');if(l){var n=l.cloneNode(true);n.id='vd-track-link';n.href='/page/track';n.textContent='Отследить заказ';var p=l.closest('li')||l;var w=p===l?n:(function(){var li=p.cloneNode(false);li.appendChild(n);return li})();p.parentNode.insertBefore(w,p.nextSibling);}}}
if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);})();

}catch(e){if(window.console)console.warn("vd-bundle s16",e)}

/* s17 */
try{

(function(){
var d=document,H=d.documentElement,MQ=window.matchMedia?window.matchMedia('(max-width:767px)'):{matches:innerWidth<768};
var P=location.pathname;
var I={home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',cat:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',srch:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',cart:'<path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.9a1.5 1.5 0 0 0 1.5-1.2L21 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6"/>'};
function svg(k){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+I[k]+'</svg>'}
var POP=[['Махровый халат','халат'],['Постельное бельё евро','постельное бельё евро'],['Набор полотенец','набор полотенец'],['Плед','плед'],['Подушка 50×70','подушка'],['Женский халат','женский халат'],['Джемпер','джемпер'],['Коврик для ванной','коврик']];
var CATS=[['Халаты','/collection/halaty'],['Постельное бельё','/collection/postelnoe-belie'],['Полотенца','/collection/nabor-polotenets'],['Пледы и покрывала','/collection/pledy-i-pokryvala'],['Подушки и одеяла','/collection/podushki-i-odeyala'],['Домашняя одежда','/collection/domashnyaya-odezhda'],['Женская одежда','/collection/zhenskaya-odezhda'],['Коврики','/collection/kovriki-dlya-vannoy'],['Кухня','/collection/kuhnya']];
function goal(n){try{ym(111939871,'reachGoal',n)}catch(e){}}
function openMenu(){var b=d.querySelector('.header-mobile-panel__show-menu-btn,.js-show-mobile-menu');if(b){b.click();return true}location.href='/collection/all';return false}
function search(){var o=d.getElementById('vd-sov');if(!o){o=d.createElement('div');o.id='vd-sov';o.setAttribute('role','dialog');
o.innerHTML='<form action="/search" method="get"><input name="q" type="search" placeholder="Поиск по Vordien Home" autocomplete="off" enterkeyhint="search"><button class="vd-sb" type="submit">Найти</button><button class="vd-sx" type="button" aria-label="Закрыть">✕</button></form><h4>Часто ищут</h4><div class="vd-chips">'+POP.map(function(p){return '<a href="/search?q='+encodeURIComponent(p[1])+'">'+p[0]+'</a>'}).join('')+'</div><h4>Категории</h4><div class="vd-chips">'+CATS.map(function(c){return '<a href="'+c[1]+'">'+c[0]+'</a>'}).join('')+'</div>';
d.body.appendChild(o);o.querySelector('.vd-sx').onclick=function(){o.classList.remove('on')};o.querySelector('form').addEventListener('submit',function(){goal('m_search')});}
o.classList.add('on');setTimeout(function(){var i=o.querySelector('input');i&&i.focus()},60);}
function cartCount(){var b=d.querySelector('#vd-tab .vd-cartb');if(!b)return;fetch('/cart_items.json',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(c){var n=0;if(typeof c.items_count==='number')n=c.items_count;else(c.order_lines||[]).forEach(function(l){n+=parseInt(l.quantity,10)||1});b.textContent=n>0?(n>99?'99+':n):''}).catch(function(){})}
function tab(){if(d.getElementById('vd-tab')||!d.body)return;var t=d.createElement('nav');t.id='vd-tab';t.setAttribute('aria-label','Навигация');
var on=function(re){return re.test(P)?' class="on"':''};
t.innerHTML='<a href="/"'+(P==='/'?' class="on"':'')+'>'+svg('home')+'Главная</a><a href="#" data-a="cat"'+on(/^\/collection\//)+'>'+svg('cat')+'Каталог</a><a href="#" data-a="srch"'+on(/^\/search/)+'>'+svg('srch')+'Поиск</a><a href="/cart_items"'+on(/^\/cart_items/)+'>'+svg('cart')+'Корзина<span class="vd-tb vd-cartb"></span></a><a href="/client_account/orders">'+svg('user')+'Профиль</a>';
t.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var k=a.getAttribute('data-a');goal('m_tab_'+(k||a.getAttribute('href').replace(/\W/g,'')||'home'));if(k==='cat'){e.preventDefault();openMenu()}else if(k==='srch'){e.preventDefault();search()}});
d.body.appendChild(t);H.classList.add('vd-tab-on');cartCount();}
function homeTop(){if(P!=='/'||d.getElementById('vd-msrch'))return;var main=d.querySelector('main')||d.querySelector('.layout__content');if(!main)return;var box=d.createElement('div');box.className='vd-mtop';box.style.padding='0 16px';
box.innerHTML='<div id="vd-msrch" role="button" tabindex="0">'+svg('srch')+'<span>Халат, постельное бельё, полотенца…</span></div><div class="vd-chips" id="vd-hchips">'+CATS.map(function(c){return '<a href="'+c[1]+'">'+c[0]+'</a>'}).join('')+'</div>';
main.insertBefore(box,main.firstChild);box.querySelector('#vd-msrch').onclick=search;}
function colChips(){if(!/^\/collection\//.test(P)||d.getElementById('vd-cchips'))return;var h=P.split('?')[0].replace(/\/$/,'');
var links=[].slice.call(d.querySelectorAll('a.header__collections-link'));var cur=links.filter(function(a){return a.getAttribute('href')===h})[0];if(!cur)return;
var li=cur.closest('li'),kids=li?[].slice.call(li.querySelectorAll(':scope > ul > li > div > a.header__collections-link, :scope > ul > li > a.header__collections-link')):[],items=[],parent=null;
if(kids.length){parent=cur;items=kids}else{var pl=li&&li.parentElement&&li.parentElement.closest('li');if(pl){parent=pl.querySelector('a.header__collections-link');items=[].slice.call(pl.querySelectorAll(':scope > ul > li > div > a.header__collections-link, :scope > ul > li > a.header__collections-link'))}}
if(items.length<2)return;var seen={},html='';if(parent)html+='<a href="'+parent.getAttribute('href')+'"'+(parent===cur?' class="on"':'')+'>Все</a>';
items.forEach(function(a){var u=a.getAttribute('href');if(seen[u])return;seen[u]=1;var tx=a.textContent.trim();tx=tx.charAt(0)+tx.slice(1).toLowerCase();html+='<a href="'+u+'"'+(u===h?' class="on"':'')+'>'+tx+'</a>'});
var c=d.createElement('div');c.id='vd-cchips';c.className='vd-chips';c.innerHTML=html;var ref=d.querySelector('.vd-cats-collapsible')||d.querySelector('.widget-type_system_widget_v4_catalog_2');if(!ref)return;ref.parentNode.insertBefore(c,ref);
var on=c.querySelector('a.on');if(on&&on.scrollIntoView)c.scrollLeft=Math.max(0,on.offsetLeft-16);}
function zero(){[].forEach.call(d.querySelectorAll('.product__reviews-count'),function(e){if(/^\(?0\)?$/.test(e.textContent.trim())){e.classList.add('vd-zero');var p=e.parentElement;if(p&&p.textContent.trim().replace(/[()\s]/g,'')==='0')p.classList.add('vd-zero-rating')}})}
function sticky(){var st=d.querySelector('.vd-sticky');if(!st||st.__vdm)return;st.__vdm=1;var btn=d.querySelector('.product__buy-btn-area .add-cart-counter__btn')||d.querySelector('.product__buy-btn-area button');if(!btn)return;
var upd=function(){var r=btn.getBoundingClientRect();var hidden=r.width===0&&r.height===0;H.classList.toggle('vd-sticky-on',!hidden&&r.bottom<60)};addEventListener('scroll',upd,{passive:true});upd();}
function cartBar(){if(!/^\/cart_items/.test(P)||d.getElementById('vd-cbar'))return;var real=[].slice.call(d.querySelectorAll('button,a')).filter(function(e){return /^Оформить заказ$/.test((e.textContent||'').trim())})[0];var tot=d.querySelector('.total-amount')||d.querySelector('.total');if(!real||!tot)return;H.classList.add('vd-cart');var b=d.createElement('div');b.id='vd-cbar';b.innerHTML='<div class="vd-ct">Итого<b></b></div><button type="button">Оформить заказ</button>';var upd=function(){b.querySelector('b').textContent=(tot.textContent||'').trim();var r=real.getBoundingClientRect();b.classList.toggle('off',r.top<innerHeight-70&&r.bottom>0)};b.querySelector('button').onclick=function(){goal('m_cartbar_checkout');real.click()};d.body.appendChild(b);upd();addEventListener('scroll',upd,{passive:true});setInterval(upd,1500);}
function init(){if(!MQ.matches)return;if(/^\/product\//.test(P))H.classList.add('vd-prod');tab();homeTop();colChips();zero();cartBar();setTimeout(function(){zero();cartBar()},1500)}
if(d.readyState!=='loading')init();else d.addEventListener('DOMContentLoaded',init);
d.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.add-cart-counter__btn,.vd-rc-btn,[class*=add-cart],[data-add-cart]');if(b)setTimeout(cartCount,1200)},true);
addEventListener('pageshow',function(){cartCount()});
})();

}catch(e){if(window.console)console.warn("vd-bundle s17",e)}

/* vd-seo-ux-js */
try{
(function(){var d=document;
function zero(){[].forEach.call(d.querySelectorAll('.product__reviews-count'),function(e){if(/^\(?0\)?$/.test(e.textContent.trim())){var p=e.parentElement;(p&&p.textContent.replace(/[()\s]/g,'')==='0'?p:e).style.display='none'}})}
var ARTS=[["Размеры махровых халатов: таблица для женщин и мужчин","/blogs/blog/razmery-mahrovyh-halatov-tablitsa","https://cdn.insales-shop.ru/images/articles/1/3529/16190921/vordien-blog-razmery-halatov.jpg"],["Размеры полотенец: какое полотенце для чего","/blogs/blog/razmery-polotenets-kakoe-dlya-chego","https://cdn.insales-shop.ru/images/articles/1/3545/16190937/vordien-blog-razmery-polotenets-kakoe-dlya-chego.jpg"],["Почему полотенца пахнут после стирки и как это исправить","/blogs/blog/pochemu-polotentsa-pahnut-posle-stirki","https://cdn.insales-shop.ru/images/articles/1/3553/16190945/vordien-blog-pochemu-polotentsa-pahnut-posle-stirki.jpg"],["Как выбрать размер постельного белья: полуторное, двуспальное, евро и семейное","/blogs/blog/kak-vybrat-razmer-postelnogo-belya-polutornoe-dvuspalnoe-evro-i-semeynoe","https://cdn.insales-shop.ru/images/articles/1/3561/16190953/vordien-blog-bedSizes.jpg"]];
try{var L=JSON.parse((d.getElementById('vd-blog-latest')||{}).textContent||'[]');if(L.length>=4&&L.every(function(x){return x[0]&&x[1]&&/^https?:/.test(x[2])}))ARTS=L.slice(0,4)}catch(e){}

function home(){if(location.pathname!=='/'||d.getElementById('vd-hblog'))return;var why=[].slice.call(d.querySelectorAll('h2')).filter(function(h){return /Почему Vordien/.test(h.textContent)})[0];var ref=why?(why.closest('section')||why.parentElement):null;if(!ref)return;
var b=d.createElement('section');b.id='vd-hblog';b.className='vd-section vd-hblog';b.innerHTML='<h2 class="vd-h2">Полезное о текстиле</h2><div class="vd-hblog-grid">'+ARTS.map(function(a){return '<a href="'+a[1]+'"><img src="'+a[2]+'" alt="'+a[0].replace(/"/g,'&quot;')+'" loading="lazy" decoding="async"><span>'+a[0]+'</span></a>'}).join('')+'</div><p style="margin-top:14px"><a href="/blogs/blog" style="color:#8a6d3b">Все статьи блога →</a></p>';
var s=d.createElement('section');s.id='vd-hshop';s.className='vd-section vd-hshop';s.innerHTML='<div class="vd-hshop-box"><div><b>Наш магазин в Балашихе</b><span>Щёлковское шоссе, вл. 141 · ежедневно 10:00–21:00 · можно посмотреть ткани вживую</span></div><a href="/page/contacts">Как добраться</a></div><div class="vd-hrev"><h2 class="vd-h2">Отзывы о нашем магазине</h2><div class="vd-hrev-frame"><iframe src="https://yandex.ru/maps-reviews-widget/60700143797?comments" loading="lazy" title="Отзывы о магазине на Яндекс Картах"></iframe></div><p><a href="https://yandex.ru/maps/org/tovary_dlya_doma/60700143797/reviews/" target="_blank" rel="noopener">Все отзывы на Яндекс Картах →</a></p></div>';
ref.parentNode.insertBefore(b,ref);ref.parentNode.insertBefore(s,ref.nextSibling);}
function run(){zero();home()}if(d.readyState!=='loading')run();else d.addEventListener('DOMContentLoaded',run);setTimeout(run,2500);})();
}catch(e){if(window.console)console.warn("vd-bundle vd-seo-ux-js",e)}

/* vd-brands-js */
try{
(function(){if(!/^\/collection\/brendy\/?$/.test(location.pathname))return;var F='https://cdn.insales-shop.ru/files/1/',T={nusa:'5097/135246825/original/vd-brand-tile-nusa.webp',zalel:'5121/135246849/original/vd-brand-tile-zalel.webp',majoli:'5129/135246857/original/vd-brand-tile-majoli.webp','gelin-home':'5089/135246817/original/vd-brand-tile-gelin-home.webp',cassoli:'5081/135246809/original/vd-brand-tile-cassoli.webp',limasso:'5105/135246833/original/vd-brand-tile-limasso.webp',hazangulu:'5137/135246865/original/vd-brand-tile-hazangulu.webp',karacan:'5169/135246897/original/vd-brand-tile-karacan.webp',pupilla:'5145/135246873/original/vd-brand-tile-pupilla.webp'};
function pl(n){n=+n||0;var a=n%10,b=n%100;return n+' '+(a==1&&b!=11?'товар':(a>=2&&a<=4&&(b<10||b>=20)?'товара':'товаров'));}
function run(){if(document.getElementById('vd-brands'))return;var el=document.getElementById('vd-sub-data');if(!el)return;var L=[];try{L=JSON.parse(el.textContent)}catch(e){return}if(!L.length)return;var cat=document.querySelector('.widget-type_system_widget_v4_catalog_1');var anchor=cat||document.querySelector('.empty-catalog-message');if(!anchor)return;
var h='<section id="vd-brands"><p class="vd-br-intro">Турецкие бренды домашнего текстиля, одежды и техники. Нажмите на бренд — откроются все его товары.</p><div class="vd-br-grid">'+L.map(function(x){var hd=(x[1].split('/').filter(Boolean).pop()||'');var img=T[hd]?'<img src="'+F+T[hd]+'" alt="'+x[0].replace(/"/g,'&quot;')+'" loading="lazy">':'<em>'+x[0]+'</em>';return '<a class="vd-br" href="'+x[1]+'"><span class="vd-br-l">'+img+'</span><b>'+x[0]+'</b>'+(+x[2]?'<i>'+pl(x[2])+'</i>':'')+'</a>';}).join('')+'</div></section>';
anchor.insertAdjacentHTML('beforebegin',h);if(cat)cat.style.display='none';var em=document.querySelector('.empty-catalog-message');if(em)em.style.display='none';[].forEach.call(document.querySelectorAll('.widget-type_system_widget_v4_catalog_filter_1,[class*=catalog_filter],[class*=catalog-sort]'),function(x){x.style.display='none'});}
if(document.readyState!=='loading')run();else document.addEventListener('DOMContentLoaded',run);setTimeout(run,1500);})();
}catch(e){if(window.console)console.warn("vd-bundle vd-brands-js",e)}

/* vd-fc-fix */
try{
(function(){function f(){[].forEach.call(document.querySelectorAll('.vd-fc'),function(x){var h=x.querySelector('h4');if(!h||!/Контакты/i.test(h.textContent))return;[].forEach.call(x.querySelectorAll('a[href="tel:+79999016788"]'),function(a){a.remove()});if(!x.querySelector('a[href="tel:+79691021024"]'))h.insertAdjacentHTML('afterend','<a href="tel:+79691021024">+7 (969) 102-10-24</a>')})}[800,2000,4000,7000].forEach(function(t){setTimeout(f,t)});})();
}catch(e){if(window.console)console.warn("vd-bundle vd-fc-fix",e)}

/* vd-cart */
try{
(function(){
if(location.pathname.indexOf('/cart_items')!==0)return;
var FREE=3000,d=document;
var ico={truck:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
card:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>',
back:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>'};
function rub(n){return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' ₽'}
function item(i,h){return '<div class="vd-cart-i">'+ico[i]+'<div>'+h+'</div></div>'}
function build(sum){
  var old=d.getElementById('vd-cart-box');if(old)old.remove();
  var btn=[].slice.call(d.querySelectorAll('button,a,input[type=submit]')).filter(function(b){return /Оформить заказ/.test(b.textContent||b.value||'')})[0];
  if(!btn)return;
  var box=d.createElement('div');box.className='vd-cart';box.id='vd-cart-box';
  var ship;
  if(sum>0&&sum<FREE){var p=Math.min(100,Math.round(sum/FREE*100));ship='До бесплатной доставки в пункт выдачи осталось <b>'+rub(FREE-sum)+'</b><div class="vd-cart-bar"><i style="width:'+p+'%"></i></div>';}
  else ship='Доставка в пункт выдачи — <b>бесплатно</b>. Курьер, СДЭК, Почта России, Яндекс Доставка — стоимость и срок рассчитаются при оформлении.';
  box.innerHTML=item('truck',ship)+
    item('card','Оплата онлайн: банковская карта, SberPay или СБП — безопасно через ЮKassa.')+
    item('back','Обмен и возврат в течение 14 дней. <a href="/page/exchange">Условия</a>')+
    '<div class="vd-cart-promo"><span>Первый заказ? Скидка 7% по промокоду</span><button type="button" id="vd-cart-code">VORDIEN7</button></div>';
  var host=btn.closest('.cart-controls')||btn.closest('.submit-block')||btn.parentNode;
  host.parentNode.insertBefore(box,host.nextSibling);
  d.getElementById('vd-cart-code').addEventListener('click',function(){
    var inp=[].slice.call(d.querySelectorAll('input')).filter(function(x){return /промокод|coupon|discount/i.test((x.placeholder||'')+(x.name||'')+(x.id||''))})[0];
    if(inp){var s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(inp,'VORDIEN7');inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));inp.focus();
      var act=[].slice.call(d.querySelectorAll('button')).filter(function(b){return /Активировать|Применить/.test(b.textContent)})[0];if(act)setTimeout(function(){act.click()},150);}
    try{navigator.clipboard&&navigator.clipboard.writeText('VORDIEN7')}catch(e){}
  });
}
function load(){fetch('/cart_items.json',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(function(r){return r.json()}).then(function(j){build(parseFloat(j&&j.items_price)||0)}).catch(function(){build(0)})}
var n=0,t=setInterval(function(){n++;if([].slice.call(d.querySelectorAll('button,a')).some(function(b){return /Оформить заказ/.test(b.textContent)})||n>40){clearInterval(t);load();}},250);
var tm;function later(e){if(e&&e.target&&e.target.closest&&e.target.closest('#vd-cart-box'))return;clearTimeout(tm);tm=setTimeout(load,1500)}d.addEventListener('click',later,true);d.addEventListener('change',later,true);
})();
}catch(e){if(window.console)console.warn("vd-bundle vd-cart",e)}
;
