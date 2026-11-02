const I={
logo:'<path d="M12 6c-2-2-5-2.5-9-2v14c4-.5 7 0 9 2 2-2 5-2.5 9-2V4c-4-.5-7 0-9 2z"/><path d="M12 6v14"/>',
home:'<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
borrowed:'<path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M8 8h6M8 12h6"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
catalog:'<path d="M5 3h10a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3z"/><path d="M5 18a3 3 0 0 1 3-3h10"/>',
trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
check:'<path d="M5 12l5 5 9-10"/>',
plus:'<path d="M12 5v14M5 12h14"/>'};
const ic=n=>`<svg viewBox="0 0 24 24">${I[n]}</svg>`;
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=n=>{const d=new Date();d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const COURSES=['BSIT','BSAIS','BS-PSYCH','BSBA','EDUC'];
const RATE=5; /* display only; the server computes the actual fee */

/* ---------- data (PHP + MySQL through api.php) ---------- */
let S={books:[],people:[],loans:[]};
async function api(action,data){
  let r,j;
  try{r=await fetch('api.php?action='+action,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})}
  catch(e){toast('Cannot reach the server. Start Apache and MySQL.');return null}
  try{j=await r.json()}catch(e){toast('Server error. Open the site through http://localhost/ and check api.php.');return null}
  if(!r.ok){toast(j.error||'Request failed.');return null}
  return j;
}
async function load(){const j=await api('all');if(j)S=j;return !!j}
async function act(action,data,msg){const j=await api(action,data);if(!j)return false;await load();render();if(msg)toast(msg);return true}
const book=id=>S.books.find(x=>x.id===id)||{title:'(removed book)',author:'-',copies:0};
const person=id=>S.people.find(x=>x.id===id)||{name:'(removed borrower)'};
const isActive=l=>!l.returned;
const late=l=>!l.returned&&l.due<iso(0);
const avail=b=>b.copies-S.loans.filter(l=>l.bid===b.id&&isActive(l)).length;
/* penalty is computed by the database (days late, then every started week costs RATE pesos) */
const weeksLate=l=>Math.ceil(l.days/7);
const fee=l=>l.fee;
const peso=n=>'\u20b1'+n.toLocaleString('en-PH');

const ROUTES=[['home','Home','home'],['borrowed','Borrowed Books','borrowed'],['add-borrower','Add Borrower','user'],['catalog','Book Catalog','catalog']];
let route='home',q='',flt='all',bq='';
$('#logo').innerHTML=I.logo;$('#av').innerHTML=ic('user');
{const h=location.hash.slice(1);if(ROUTES.some(r=>r[0]===h))route=h}

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2400)}

/* ---------- views ---------- */
function vHome(){
  const od=S.loans.filter(late).sort((a,b)=>a.due<b.due?-1:1);
  const stats=[['Book titles',S.books.length],['Active loans',S.loans.filter(isActive).length],['Overdue',od.length],['Borrowers',S.people.length]];
  const rows=od.map(l=>{const b=book(l.bid),d=Math.round((new Date(iso(0))-new Date(l.due))/864e5);
    return `<tr><td>${esc(person(l.pid).name)}</td><td>${esc(b.title)}</td><td>${l.due} <span class="badge bad">${d} day${d>1?'s':''} late</span></td><td>${weeksLate(l)} week${weeksLate(l)>1?'s':''}</td><td class="fee">${peso(fee(l))}</td><td class="act"><button class="btn sm" data-a="ret" data-id="${l.id}">${ic('check')}Mark returned</button></td></tr>`}).join('');
  return `<h1>Dashboard</h1><p class="sub">A quick look at what is happening in your library today.</p>
  <div class="stats">${stats.map(([k,v])=>`<div class="card stat"><b>${v}</b><span>${k}</span></div>`).join('')}</div>
  <h2>Overdue loans and penalty fees</h2>
  <p class="note">Penalty is ${peso(RATE)} for every week a book is late, counting each week that has started. It keeps growing until the book is returned.</p>
  <div class="tw"><table><thead><tr><th>Borrower</th><th>Book Title</th><th>Due Date</th><th>Weeks Late</th><th>Penalty</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">No overdue loans. Everything is on schedule.</td></tr>'}</tbody></table></div>`;
}

function vBorrowed(){
  return `<div class="head"><div><h1>Borrowed Books</h1><p class="sub">List of people who borrowed books.</p></div><button class="btn" data-a="new">${ic('plus')}New Loan</button></div>
  <div class="tools"><input id="q" type="search" placeholder="Search borrower, title or author" value="${esc(q)}" aria-label="Search loans">
  <select id="f" aria-label="Filter loans">${[['all','All loans'],['active','Active'],['late','Overdue'],['done','Returned']].map(([v,t])=>`<option value="${v}"${v===flt?' selected':''}>${t}</option>`).join('')}</select></div>
  <div class="tw"><table><thead><tr><th>Borrower</th><th>Book Title</th><th>Author</th><th>Date Borrowed</th><th>Due Date</th><th>Date Returned</th><th>Penalty</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>`;
}
function loanRows(){
  const t=q.toLowerCase();
  const L=S.loans.filter(l=>{const b=book(l.bid);return (person(l.pid).name+b.title+b.author).toLowerCase().includes(t)&&(flt==='all'||(flt==='active'&&isActive(l))||(flt==='late'&&late(l))||(flt==='done'&&l.returned))}).sort((a,b)=>a.borrowed<b.borrowed?1:-1);
  $('#rows').innerHTML=L.length?L.map(l=>{const b=book(l.bid);
    return `<tr><td>${esc(person(l.pid).name)}</td><td>${esc(b.title)}</td><td class="mut">${esc(b.author)}</td><td>${l.borrowed}</td><td>${l.due}${late(l)?' <span class="badge bad">Overdue</span>':''}</td><td>${l.returned?`<span class="badge ok">${l.returned}</span>`:'-'}</td><td>${fee(l)?`<span class="badge bad">${peso(fee(l))}</span>`:'-'}</td><td class="act">${l.returned?'':`<button class="btn sm" data-a="ret" data-id="${l.id}">${ic('check')}Return</button> `}<button class="btn sm ghost danger" title="Delete record" aria-label="Delete record" data-a="dl" data-id="${l.id}">${ic('trash')}</button></td></tr>`}).join(''):'<tr><td colspan="8" class="empty">No loans match. Try another search or add a new loan.</td></tr>';
}

function vAdd(){
  return `<h1>Add Borrower</h1><p class="sub">Enter the details of the person who will borrow a book.</p>
  <form id="bf" class="card form" autocomplete="off">
    <label for="n">Full Name</label><input id="n" required placeholder="Enter full name">
    <label for="s">Student/ID Number</label><input id="s" required inputmode="numeric" pattern="[0-9]+" title="Numbers only" placeholder="Enter student or ID number (numbers only)">
    <label for="c">Course / Program</label><select id="c" required><option value="" disabled selected>Select course / program</option>${COURSES.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
    <label for="bt">Book Title</label><input id="bt" list="bk" required placeholder="Enter the book being borrowed"><datalist id="bk">${S.books.map(b=>`<option value="${esc(b.title)}">`).join('')}</datalist>
    <label for="ba">Author</label><input id="ba" required placeholder="Enter the author name">
    <button class="btn">Add Borrower</button>
  </form>
  <h2>Registered borrowers</h2>
  <div class="tw"><table><thead><tr><th>Name</th><th>Student/ID</th><th>Course / Program</th><th>Currently borrowing</th><th></th></tr></thead><tbody id="pl"></tbody></table></div>`;
}
const cur=p=>S.loans.filter(l=>l.pid===p.id&&isActive(l)).map(l=>{const b=book(l.bid);return esc(b.title)+' <span class="mut">by '+esc(b.author)+'</span>'}).join('<br>')||'-';
function peopleRows(){
  $('#pl').innerHTML=S.people.length?S.people.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.sid)}</td><td class="mut">${esc(p.course||'-')}</td><td>${cur(p)}</td><td class="act"><button class="btn sm ghost danger" title="Delete borrower" aria-label="Delete borrower" data-a="dp" data-id="${p.id}">${ic('trash')}</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No borrowers yet. Add one with the form above.</td></tr>';
}

function vCat(){
  return `<h1>Book Catalog</h1><p class="sub">All books in the library and how many copies are on the shelf.</p>
  <form id="kf" class="card" autocomplete="off"><div class="kg">
    <div><label for="t">Title</label><input id="t" required placeholder="Enter book title"></div>
    <div><label for="a">Author</label><input id="a" required placeholder="Enter author"></div>
    <div><label for="k">Copies</label><input id="k" type="number" min="1" max="99" value="1" required></div></div>
    <button class="btn">${ic('plus')}Add Book</button></form>
  <h2>Books</h2>
  <div class="tools"><input id="bq" type="search" placeholder="Search title or author" value="${esc(bq)}" aria-label="Search books"></div>
  <div class="tw"><table><thead><tr><th>Title</th><th>Author</th><th>Copies</th><th>Available</th><th></th></tr></thead><tbody id="bl"></tbody></table></div>`;
}
function bookRows(){
  const t=bq.toLowerCase(),B=S.books.filter(b=>(b.title+b.author).toLowerCase().includes(t));
  $('#bl').innerHTML=B.length?B.map(b=>{const a=avail(b);return `<tr><td>${esc(b.title)}</td><td class="mut">${esc(b.author)}</td><td>${b.copies}</td><td><span class="badge ${a>0?'ok':'bad'}">${a>0?a+' available':'All lent out'}</span></td><td class="act"><button class="btn sm ghost danger" title="Delete book" aria-label="Delete book" data-a="db" data-id="${b.id}">${ic('trash')}</button></td></tr>`}).join(''):'<tr><td colspan="5" class="empty">No books found. Add one with the form above.</td></tr>';
}

/* ---------- router ---------- */
function render(){
  $('#nav').innerHTML=ROUTES.map(([r,t,i])=>`<a data-r="${r}" class="${r===route?'on':''}" tabindex="0" role="link">${ic(i)}${t}</a>`).join('');
  $('#view').innerHTML={home:vHome,borrowed:vBorrowed,'add-borrower':vAdd,catalog:vCat}[route]();
  if(route==='borrowed')loanRows();
  if(route==='add-borrower')peopleRows();
  if(route==='catalog')bookRows();
}
function go(r){route=r;try{history.replaceState(null,'','#'+r)}catch(e){}render();scrollTo(0,0)}

/* ---------- loan dialog ---------- */
function openLoan(){
  const bs=S.books.filter(b=>avail(b)>0);
  if(!S.people.length){toast('Add a borrower first.');go('add-borrower');return}
  if(!bs.length){toast('No copies are available. Add books in the catalog.');return}
  $('#dlg').innerHTML=`<form id="lf"><h2>New Loan</h2>
  <label for="lp">Borrower</label><select id="lp">${S.people.map(p=>`<option value="${p.id}">${esc(p.name)} (${esc(p.sid)})</option>`).join('')}</select>
  <label for="lb">Book</label><select id="lb">${bs.map(b=>`<option value="${b.id}">${esc(b.title)} - ${avail(b)} left</option>`).join('')}</select>
  <div class="grid2"><div><label for="ld">Date Borrowed</label><input id="ld" type="date" value="${iso(0)}" required></div><div><label for="lu">Due Date</label><input id="lu" type="date" value="${iso(14)}" required></div></div>
  <div class="row"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn">Save loan</button></div></form>`;
  $('#dlg').showModal();
}

/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-r],[data-a]');if(!el)return;
  if(el.dataset.r)return go(el.dataset.r);
  const a=el.dataset.a,id=el.dataset.id;
  if(a==='new')return openLoan();
  if(a==='close')return $('#dlg').close();
  if(a==='ret')return act('return_loan',{id},'Book returned');
  if(a==='dl'){if(!confirm('Delete this loan record? This cannot be undone.'))return;return act('delete_loan',{id},'Loan deleted')}
  if(a==='dp'){if(S.loans.some(l=>l.pid===id&&isActive(l)))return toast('This borrower still has books out.');if(!confirm('Delete this borrower? Their loan history will remain.'))return;return act('delete_borrower',{id},'Borrower deleted')}
  if(a==='db'){if(S.loans.some(l=>l.bid===id&&isActive(l)))return toast('Copies of this book are still lent out.');if(!confirm('Delete this book from the catalog? Loan history will remain.'))return;return act('delete_book',{id},'Book deleted')}
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('nav a')){e.preventDefault();go(e.target.dataset.r)}});
document.addEventListener('input',e=>{
  const i=e.target.id;
  if(i==='q'){q=e.target.value;loanRows()}
  if(i==='f'){flt=e.target.value;loanRows()}
  if(i==='s')e.target.value=e.target.value.replace(/\D/g,'');
  if(i==='bq'){bq=e.target.value;bookRows()}
  if(i==='bt'){const b=S.books.find(b=>b.title.toLowerCase()===e.target.value.trim().toLowerCase());if(b)$('#ba').value=b.author}
});
document.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,id=f.id,v=x=>$('#'+x).value.trim();
  if(id==='bf'){
    const d={name:v('n'),sid:v('s'),course:v('c'),title:v('bt'),author:v('ba')};
    if(!d.name||!d.sid||!d.title||!d.author)return toast('Fill in the name, ID number, book title and author.');
    if(!/^\d+$/.test(d.sid))return toast('The ID number can only contain numbers.');
    if(!COURSES.includes(d.course))return toast('Choose a course or program from the list.');
    if(await act('add_borrower',d,d.name+' is now borrowing '+d.title))$('#n').focus();
  }
  if(id==='kf'){
    const title=v('t'),author=v('a'),copies=Math.min(99,Math.max(1,parseInt(v('k'))||1));
    if(!title||!author)return toast('Enter a title and an author.');
    if(await act('add_book',{title,author,copies},'Book added to the catalog'))$('#t').focus();
  }
  if(id==='lf'){
    const borrowed=$('#ld').value,due=$('#lu').value;
    if(due<borrowed)return toast('The due date cannot be before the borrow date.');
    if(await act('add_loan',{pid:$('#lp').value,bid:$('#lb').value,borrowed,due},'Loan saved'))$('#dlg').close();
  }
});
load().then(render);
