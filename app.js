require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookies = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const { createHmac, timingSafeEqual } = require('node:crypto');
const path = require('node:path');
const { neon } = require('@neondatabase/serverless');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookies());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: '서버의 APP_PASSWORD를 설정해 주세요.' });
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) return res.status(403).json({ error: '허용되지 않은 요청입니다.' });
  }
  next();
});
function signature(value) { return createHmac('sha256', process.env.APP_PASSWORD).update(value).digest('hex'); }
function equal(a, b) { const x=Buffer.from(a), y=Buffer.from(b); return x.length === y.length && timingSafeEqual(x,y); }
function authenticated(req) {
  const [expires, mac] = (req.cookies.session || '').split('.');
  return expires && mac && /^\d+$/.test(expires) && Number(expires)>Date.now() && equal(signature(expires),mac);
}
const cookieOptions = { httpOnly:true, secure:process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL), sameSite:'strict', path:'/' };
app.post('/api/login', rateLimit({ windowMs:15*60*1000, limit:10, standardHeaders:'draft-8', legacyHeaders:false, message:{error:'로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.'} }), (req,res) => {
  if (typeof req.body?.password !== 'string' || !equal(signature(req.body.password),signature(process.env.APP_PASSWORD))) return res.status(401).json({error:'비밀번호가 올바르지 않습니다.'});
  const expires=String(Date.now()+12*60*60*1000);
  res.cookie('session',`${expires}.${signature(expires)}`,{...cookieOptions,maxAge:12*60*60*1000}).json({ok:true});
});
app.post('/api/logout',(req,res)=>res.clearCookie('session',cookieOptions).json({ok:true}));
app.use('/api', (req,res,next)=>authenticated(req)?next():res.status(401).json({error:'로그인이 필요합니다.'}));
app.get('/api/session',(req,res)=>res.json({ok:true}));
let initialization;
async function database() {
  if (!process.env.DATABASE_URL) { const error = new Error('Database unavailable'); error.status=503; throw error; }
  const sql=neon(process.env.DATABASE_URL);
  if (!initialization) initialization=sql`CREATE TABLE IF NOT EXISTS personal_expenses (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, date DATE NOT NULL, title VARCHAR(100) NOT NULL, category VARCHAR(30) NOT NULL, amount BIGINT NOT NULL CHECK (amount > 0 AND amount <= 999999999999), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`.catch(error=>{initialization=undefined;throw error;});
  await initialization;
  return sql;
}
const categories=['식비','카페·간식','교통','쇼핑','주거·통신','의료·건강','문화·여가','기타'];
function validDate(value) { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0,4))>=1900 && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value; }
function validate(body) { return body && validDate(body.date) && typeof body.title==='string' && body.title.trim().length>0 && body.title.trim().length<=100 && categories.includes(body.category) && Number.isSafeInteger(body.amount) && body.amount>0 && body.amount<=999999999999; }
app.get('/api/expenses',async(req,res)=>{
  const month=req.query.month, date=req.query.date;
  if (typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!validDate(`${month}-01`)||(date!==undefined&&!validDate(date))) return res.status(400).json({error:'날짜 형식을 확인해 주세요.'});
  const sql=await database();
  const rows=await sql`SELECT id, to_char(date,'YYYY-MM-DD') AS date, title, category, amount::text AS amount FROM personal_expenses WHERE date >= ${month+'-01'}::date AND date < (${month+'-01'}::date + INTERVAL '1 month') ORDER BY date DESC, id DESC`;
  const expenses=rows.map(row=>({...row,amount:Number(row.amount)}));
  const totals=categories.map(category=>({category,total:expenses.filter(e=>e.category===category).reduce((sum,e)=>sum+e.amount,0)}));
  res.json({expenses:date?expenses.filter(e=>e.date===date):expenses,total:expenses.reduce((sum,e)=>sum+e.amount,0),count:expenses.length,categories:totals});
});
app.post('/api/expenses',async(req,res)=>{
  if(!validate(req.body)) return res.status(400).json({error:'날짜, 항목, 카테고리, 금액을 확인해 주세요.'});
  const {date,title,category,amount}=req.body; const sql=await database();
  const [row]=await sql`INSERT INTO personal_expenses(date,title,category,amount) VALUES(${date},${title.trim()},${category},${amount}) RETURNING id`;
  res.status(201).json(row);
});
app.put('/api/expenses/:id',async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)||!validate(req.body)) return res.status(400).json({error:'입력값을 확인해 주세요.'});
  const {date,title,category,amount}=req.body; const sql=await database();
  const rows=await sql`UPDATE personal_expenses SET date=${date},title=${title.trim()},category=${category},amount=${amount} WHERE id=${req.params.id} RETURNING id`;
  res.status(rows.length?200:404).json(rows.length?{ok:true}:{error:'내역을 찾을 수 없습니다.'});
});
app.delete('/api/expenses/:id',async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'잘못된 ID입니다.'});
  const sql=await database(); const rows=await sql`DELETE FROM personal_expenses WHERE id=${req.params.id} RETURNING id`;
  res.status(rows.length?200:404).json(rows.length?{ok:true}:{error:'내역을 찾을 수 없습니다.'});
});
app.use('/api',(req,res)=>res.status(404).json({error:'존재하지 않는 API입니다.'}));
app.use(express.static(path.join(__dirname,'public')));
app.use((error,req,res,next)=>{
  const status=error.status===400?400:error.status===503?503:500;
  res.status(status).json({error:status===400?'요청 형식을 확인해 주세요.':'데이터베이스 연결 또는 서버 설정을 확인해 주세요.'});
});
module.exports=app;
