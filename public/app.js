const $=id=>document.getElementById(id);
const categories=['식비','카페·간식','교통','쇼핑','주거·통신','의료·건강','문화·여가','기타'];
const won=n=>new Intl.NumberFormat('ko-KR').format(n)+'원';
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
$('month').value=today.slice(0,7); $('date').value=today;
categories.forEach(c=>$('category').add(new Option(c,c)));
let editing=null, expenses=[], generation=0, timer;
function message(text){$('message').textContent=text;$('message').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('message').hidden=true,5000);}
function showLogin(){ $('login').hidden=false;$('workspace').hidden=true;$('rows').replaceChildren();$('chart').replaceChildren();expenses=[]; }
async function api(path,options={}){
  const response=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data=await response.json();
  if(!response.ok){if(response.status===401)showLogin();throw new Error(data.error||'요청에 실패했습니다.');}return data;
}
function cell(text,className){const td=document.createElement('td');td.textContent=text;if(className)td.className=className;return td;}
async function load(){
  const current=++generation;
  try{
    const query=new URLSearchParams({month:$('month').value});if($('filter-date').value)query.set('date',$('filter-date').value);
    const data=await api('/expenses?'+query);if(current!==generation)return;
    expenses=data.expenses;$('total').textContent=won(data.total);$('count').textContent=`${$('month').value.replace('-','년 ')}월 · 총 ${data.count}건의 기록`;
    const top=[...data.categories].sort((a,b)=>b.total-a.total)[0];$('top-category').textContent=top.total?top.category:'아직 지출이 없어요';$('top-info').textContent=top.total?`${won(top.total)} · 전체 지출의 ${(top.total/data.total*100).toFixed(1)}%`:'첫 지출을 기록해 보세요.';
    $('chart').replaceChildren();
    data.categories.forEach(c=>{const row=document.createElement('div');row.className='bar-row';const head=document.createElement('div');head.className='bar-heading';const name=document.createElement('span');name.textContent=c.category;const total=document.createElement('span');total.textContent=won(c.total);head.append(name,total);const track=document.createElement('div');track.className='track';const bar=document.createElement('div');bar.className='bar';bar.style.width=`${top.total?c.total/top.total*100:0}%`;track.append(bar);row.append(head,track);$('chart').append(row);});
    $('rows').replaceChildren();$('empty').hidden=expenses.length>0;
    expenses.forEach(e=>{const tr=document.createElement('tr');const category=cell('');const badge=document.createElement('span');badge.className='badge';badge.textContent=e.category;category.append(badge);const actions=cell('');const group=document.createElement('div');group.className='actions';for(const [label,handler,cls] of [['수정',()=>edit(e),''],['삭제',()=>remove(e),'delete']]){const button=document.createElement('button');button.textContent=label;button.className=cls;button.setAttribute('aria-label',`${e.title} ${label}`);button.onclick=handler;group.append(button);}actions.append(group);tr.append(cell(e.date),cell(e.title),category,cell(won(e.amount),'money'),actions);$('rows').append(tr);});
  }catch(error){message(error.message);}
}
function reset(){editing=null;$('expense-form').reset();$('date').value=today;$('form-title').textContent='지출 기록하기';$('save').textContent='지출 추가하기';$('cancel').hidden=true;}
function edit(e){editing=e.id;for(const key of ['date','title','category','amount'])$(key).value=e[key];$('form-title').textContent='지출 수정하기';$('save').textContent='수정 저장하기';$('cancel').hidden=false;$('expense-form').scrollIntoView({behavior:'smooth',block:'center'});$('title').focus();}
async function remove(e){if(!confirm(`“${e.title}” ${won(e.amount)} 내역을 삭제할까요?`))return;try{await api('/expenses/'+e.id,{method:'DELETE'});if(editing===e.id)reset();await load();message('지출 내역을 삭제했습니다.');}catch(error){message(error.message);}}
$('login-form').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await api('/login',{method:'POST',body:JSON.stringify({password:$('password').value})});$('password').value='';$('login-error').textContent='';$('login').hidden=true;$('workspace').hidden=false;await load();}catch(error){$('login-error').textContent=error.message;}finally{button.disabled=false;}};
$('expense-form').onsubmit=async event=>{event.preventDefault();$('save').disabled=true;try{const body={date:$('date').value,title:$('title').value.trim(),category:$('category').value,amount:Number($('amount').value)};await api('/expenses'+(editing?'/'+editing:''),{method:editing?'PUT':'POST',body:JSON.stringify(body)});$('month').value=body.date.slice(0,7);$('filter-date').value='';reset();await load();message('지출 내역을 저장했습니다.');}catch(error){message(error.message);}finally{$('save').disabled=false;}};
$('cancel').onclick=reset;
$('month').onchange=()=>{if(!$('month').validity.valid)return;$('filter-date').value='';load();};
$('filter-date').onchange=()=>{if($('filter-date').value)$('month').value=$('filter-date').value.slice(0,7);load();};
$('clear-filter').onclick=()=>{$('filter-date').value='';load();};
$('logout').onclick=async()=>{try{await api('/logout',{method:'POST'});generation++;reset();showLogin();}catch(error){message(error.message);}};
(async()=>{try{await api('/session');$('login').hidden=true;$('workspace').hidden=false;await load();}catch(error){if(!error.message.includes('로그인'))$('login-error').textContent=error.message;}})();
