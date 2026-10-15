// Uses local secrets without displaying them; removes its own temporary record.
require('dotenv').config({quiet:true});
const assert=require('node:assert/strict');
const app=require('../app');
const server=app.listen(0,'127.0.0.1',async()=>{
  const base=`http://127.0.0.1:${server.address().port}`;
  let cookie,id;
  async function request(path,method='GET',body){const response=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});if(path==='/login')cookie=response.headers.get('set-cookie')?.split(';')[0];const data=await response.json();if(!response.ok)throw new Error(`HTTP ${response.status}: ${data.error}`);return data;}
  try{
    await request('/login','POST',{password:process.env.APP_PASSWORD});
    const data={date:'2000-01-01',title:'연결 확인용 임시 내역',category:'기타',amount:123};
    id=(await request('/expenses','POST',data)).id;
    let list=await request('/expenses?month=2000-01&date=2000-01-01');assert.ok(list.expenses.some(e=>e.id===id&&e.amount===123));
    await request('/expenses/'+id,'PUT',{...data,amount:456});
    list=await request('/expenses?month=2000-01');assert.ok(list.expenses.some(e=>e.id===id&&e.amount===456));assert.ok(list.categories.find(c=>c.category==='기타').total>=456);
    await request('/expenses/'+id,'DELETE');id=null;
    console.log('Neon CRUD, date filter and monthly/category totals passed. Temporary record deleted.');
  }catch(error){console.error('Neon verification failed:',error.message);process.exitCode=1;}
  finally{if(id)try{await request('/expenses/'+id,'DELETE');}catch{console.error('Temporary verification record could not be removed.');}server.close();}
});
