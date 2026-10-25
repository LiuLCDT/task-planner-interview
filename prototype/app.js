'use strict';
const $ = id => document.getElementById(id);
const initialTasks = () => ['整理产品需求文档','准备项目评审','阅读一篇行业报告'];
const state = {credits:3,tasks:initialTasks(),busy:false,failNext:false,result:null,calls:0,successes:0,failures:0,blocks:0,events:[],requests:[],externalLocked:false,run:0};
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function log(event){state.events.unshift(`${new Date().toLocaleTimeString('zh-CN',{hour12:false})}  ${event}`);state.events=state.events.slice(0,30);renderMetrics();}
function renderMetrics(){for(const key of ['calls','successes','failures','blocks'])$(key).textContent=state[key];$('events').innerHTML=state.events.length?state.events.map(e=>`<li>${escapeHTML(e)}</li>`).join(''):'<li>等待操作</li>';}
function notify(title,text,kind='info',retry=false){$('feedback').hidden=false;$('feedback').className=`feedback ${kind}`;$('feedbackTitle').textContent=title;$('feedbackText').textContent=text;$('retry').hidden=!retry;if(kind==='error')$('empty').hidden=true;}
function renderTasks(){ $('taskCount').textContent=`${state.tasks.length} 项`;$('taskList').innerHTML=state.tasks.length?state.tasks.map((t,i)=>`<li class="task-item"><input class="task-check-placeholder" type="checkbox" disabled aria-label="标记${escapeHTML(t)}完成"><span class="task-name">${escapeHTML(t)}</span><span class="task-duration-placeholder"><input type="number" value="1" min="0.5" step="0.5" readonly aria-label="${escapeHTML(t)}预计时长"><span>小时</span></span><button class="delete" data-delete="${i}" aria-label="删除${escapeHTML(t)}" ${state.busy?'disabled':''}>×</button></li>`).join(''):'<li class="no-tasks">先添加一项待办</li>'; }
let toastTimer;
function showToast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function render(){
 $('credits').textContent=state.credits;document.querySelector('.quota').classList.toggle('exhausted',state.credits===0);
 $('generate').disabled=state.busy||state.credits===0||state.tasks.length===0;
 $('generateTipAnchor').tabIndex=state.credits===0?0:-1;
 if(state.credits===0){$('generateTipAnchor').setAttribute('aria-describedby','generateTip');$('generateTipAnchor').setAttribute('aria-label','额度已用完，查看说明');}else{$('generateTipAnchor').removeAttribute('aria-describedby');$('generateTipAnchor').removeAttribute('aria-label');hideGenerateTip();}
 $('generate').classList.toggle('busy',state.busy);
 $('generateLabel').textContent=state.busy?'正在生成…':state.credits===0?'额度已用完':'生成日程';
 $('generateArrow').hidden=state.busy||state.credits===0;
 for(const id of ['newTask','addTask','hours','retry','resetDemo'])$(id).disabled=state.busy;
 document.querySelectorAll('[data-scenario]').forEach(el=>el.disabled=state.busy);
 $('empty').hidden=state.busy||!!state.result||!$('feedback').hidden;$('loading').hidden=!state.busy;
 $('result').hidden=!state.result;$('resultTag').hidden=state.busy||!state.result;
 document.querySelector('.result-pane').classList.toggle('is-loading',state.busy);
 document.querySelector('.result-pane').setAttribute('aria-busy',String(state.busy));
 renderTasks();renderMetrics();
}
function renderResult(){if(!state.result)return;const r=state.result;const minutes=Math.round(r.hours*60);const totalSteps=r.tasks.length*3;const base=Math.floor(minutes/totalSteps);const remainder=minutes%totalSteps;let stepIndex=0;
 $('result').innerHTML=`<p class="result-summary">${r.tasks.length} 项待办 · 共 ${r.hours} 小时</p>`+r.tasks.map((task,i)=>`<article class="plan-card"><div class="plan-title">${escapeHTML(task)}<span>中优先级</span></div><ul class="steps">${['准备','执行','复盘'].map((step,j)=>{const duration=base+(stepIndex++<remainder?1:0);return `<li><input type="checkbox" id="step-${i}-${j}"><label for="step-${i}-${j}">${step}：${escapeHTML(task)}</label><span>${duration} 分钟</span></li>`;}).join('')}</ul></article>`).join('');
}
async function generate(source='当前页'){
 if(state.externalLocked){state.blocks++;log(`${source} · blocked_in_progress · 未调用 / 未扣费`);showToast('此账号正在另一页面生成日程，请稍后再试。本次未扣费。');return 'blocked_in_progress';}
 if(state.busy){state.blocks++;log(`${source} · blocked_in_progress · 未调用 / 未扣费`);showToast('日程正在生成，请稍等。本次未重复扣费。');return 'blocked_in_progress';}
 if(state.credits<1){state.requests.push({source,status:'no_credit'});state.blocks++;log(`${source} · blocked_no_credit · 未调用 / 未扣费`);render();showGenerateTip();return 'blocked_no_credit';}
 const hours=Number($('hours').value);
 if(!state.tasks.length||!Number.isFinite(hours)||hours<1||hours>24||hours*2%1!==0){notify('请检查输入','添加待办，并填写 1–24 小时的可用时间（每次 0.5 小时）。','error');return 'invalid_input';}
 const request={source,status:'running'};state.requests.push(request);state.busy=true;const run=++state.run;const snapshot=[...state.tasks];const fail=state.failNext||snapshot.some(t=>t.includes('[fail]'));state.failNext=false;state.calls++;const callId=state.calls;
 $('feedback').hidden=true;$('toast').hidden=true;clearTimeout(toastTimer);log(`${source} · mock.started #${callId} · 额度 ${state.credits}`);render();
 await new Promise(r=>setTimeout(r,1800));if(run!==state.run)return;
 if(fail){$('resultTag').textContent='上次成功结果';state.failures++;log(`mock.failed #${callId} · 未扣费 · 额度 ${state.credits}`);notify('生成失败，本次未扣除额度',snapshot.some(t=>t.includes('[fail]'))?'请移除含 [fail] 的演示任务后重试。':'待办已保留，可以重新生成。','error',true);}
 else{state.credits--;state.successes++;log(`mock.succeeded #${callId} · 扣除 1 次 · 额度 ${state.credits}`);{$('resultTag').textContent='本次生成';state.result={tasks:snapshot,hours};renderResult();showToast('日程已生成');}}
 request.status=fail?'failed':'succeeded';$('feedback').style.minHeight='';state.busy=false;render();return fail?'failed':'succeeded';
}
function reset(credits=3){state.run++;Object.assign(state,{credits,tasks:initialTasks(),busy:false,failNext:false,result:null,calls:0,successes:0,failures:0,blocks:0,events:[],requests:[],externalLocked:false});clearTimeout(toastTimer);$('toast').hidden=true;$('hours').value=8;$('newTask').value='';$('feedback').hidden=true;$('feedback').style.minHeight='';$('inputError').hidden=true;$('result').innerHTML='';document.querySelectorAll('[data-scenario]').forEach(e=>e.classList.remove('active'));render();}
$('taskForm').addEventListener('submit',e=>{e.preventDefault();if(state.busy)return;const value=$('newTask').value.trim();if(!value){$('inputError').textContent='请输入待办事项';$('inputError').hidden=false;return;}if(state.tasks.length>=12){$('inputError').textContent='原型最多演示 12 项待办';$('inputError').hidden=false;return;}state.tasks.push(value);$('newTask').value='';$('inputError').hidden=true;render();$('newTask').focus();});
$('taskList').addEventListener('click',e=>{const target=e.target.closest('[data-delete]');if(!target||state.busy)return;state.tasks.splice(Number(target.dataset.delete),1);render();});
$('generate').addEventListener('click',()=>generate());$('retry').addEventListener('click',()=>generate());$('resetDemo').addEventListener('click',()=>reset());
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>{if(state.busy)return;const scenario=button.dataset.scenario;reset(scenario==='zero'?0:scenario==='last'?1:3);button.classList.add('active');
 
 if(scenario==='fail'){state.failNext=true;log('演示设置 · 下一次模拟调用明确失败');}
 if(scenario==='concurrent'){state.externalLocked=true;log('演示设置 · 同账号另一页面持续生成中；本页点击生成体验拦截');}
 else if(scenario!=='zero')generate();
 document.querySelector('.generate-row').scrollIntoView({block:'center',behavior:'instant'});
}));
let tipOpen=false,tipTimer;
function showTip(){clearTimeout(tipTimer);tipOpen=true;$('quotaTip').hidden=false;}
function hideTip(){clearTimeout(tipTimer);tipOpen=false;$('quotaTip').hidden=true;}
$('tipAnchor').addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')showTip();});
$('tipAnchor').addEventListener('pointerleave',()=>{tipTimer=setTimeout(()=>{if(document.activeElement!==$('quotaInfo'))hideTip();},120);});
$('quotaInfo').addEventListener('focus',showTip);$('quotaInfo').addEventListener('blur',hideTip);
let touchWasOpen=false;$('quotaInfo').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')touchWasOpen=tipOpen;});
$('quotaInfo').addEventListener('click',e=>{if(e.pointerType==='touch'||e.pointerType==='pen'){touchWasOpen?hideTip():showTip();}else showTip();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();});document.addEventListener('pointerdown',e=>{if(!$('tipAnchor').contains(e.target))hideTip();});
let generateTipTimer;
function showGenerateTip(){if(state.credits!==0)return;clearTimeout(generateTipTimer);$('generateTip').hidden=false;}
function hideGenerateTip(){clearTimeout(generateTipTimer);$('generateTip').hidden=true;}
$('generateTipAnchor').addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')showGenerateTip();});
$('generateTipAnchor').addEventListener('pointerleave',()=>{generateTipTimer=setTimeout(()=>{if(document.activeElement!==$('generateTipAnchor'))hideGenerateTip();},120);});
$('generateTipAnchor').addEventListener('focus',showGenerateTip);
$('generateTipAnchor').addEventListener('blur',hideGenerateTip);
let generateTipWasOpen=false;
$('generateTipAnchor').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')generateTipWasOpen=!$('generateTip').hidden;});
$('generateTipAnchor').addEventListener('click',e=>{if(e.pointerType==='touch'||e.pointerType==='pen'){generateTipWasOpen?hideGenerateTip():showGenerateTip();}else showGenerateTip();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideGenerateTip();});
document.addEventListener('pointerdown',e=>{if(!$('generateTipAnchor').contains(e.target))hideGenerateTip();});
render();


