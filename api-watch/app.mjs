import {USERNAME, VERSION, STORE, plan, validTasks, inspect, retryAt, report} from './core.mjs';
const $ = id => document.getElementById(id);
let tasks = [], results = [], blockedUntil = 0;
try { tasks = validTasks(JSON.parse(localStorage.getItem(STORE) || '[]')); }
catch { $('notice-status').textContent = '无法读取本地清单，本次可继续使用，导出后再关闭页面。'; }
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(tasks)); }
  catch { $('notice-status').textContent = '浏览器无法保存清单，请先导出 Markdown 备份。'; }
}
function renderTasks() {
  $('task-count').textContent = tasks.length;
  $('task-list').replaceChildren();
  if (!tasks.length) {const p=document.createElement('p');p.className='empty';p.textContent='还没有维护事项。收到通知后，在上方生成第一张卡片。';$('task-list').append(p);return;}
  for (const task of tasks) {
    const card=document.createElement('article');card.className='task-card';
    const top=document.createElement('div');top.className='task-top';
    const detail=document.createElement('div');const heading=document.createElement('h3');heading.textContent=task.title;
    const meta=document.createElement('p');const completed=task.items.filter(x=>x.done).length;
    const overdue=task.due && task.due < new Date().toLocaleDateString('en-CA') && completed < task.items.length;
    meta.textContent=`${completed}/${task.items.length} 已完成 · ${task.due ? `期限 ${task.due}${overdue?' · 已过期':''}` : '未设置期限'}`;
    detail.append(heading,meta);
    const remove=document.createElement('button');remove.className='delete';remove.type='button';remove.textContent='移除';remove.setAttribute('aria-label',`移除 ${task.title}`);
    remove.addEventListener('click',()=>{tasks=tasks.filter(t=>t!==task);save();renderTasks();$('notice-status').textContent='已移除该维护卡。';});
    top.append(detail,remove);card.append(top);
    for (const item of task.items) {
      const label=document.createElement('label');label.className=`task-row${item.done?' done':''}`;
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.done;
      const text=document.createElement('span');text.textContent=item.label;
      checkbox.addEventListener('change',()=>{item.done=checkbox.checked;save();label.classList.toggle('done',item.done);const done=task.items.filter(x=>x.done).length;meta.textContent=`${done}/${task.items.length} 已完成 · ${task.due?`期限 ${task.due}`:'未设置期限'}`;});
      label.append(checkbox,text);card.append(label);
    }
    $('task-list').append(card);
  }
}
function addResult(title, summary, level, path='', detail='') {
  results.push({title,summary,level,path,detail});
  const el=document.createElement('article');el.className=`check ${level}`;
  const symbol=document.createElement('span');symbol.className='symbol';symbol.textContent=level==='pass'?'✓':level==='warn'?'!':'×';symbol.setAttribute('aria-hidden','true');
  const body=document.createElement('div');const h=document.createElement('h3');h.textContent=title;
  const p=document.createElement('p');p.textContent=summary;body.append(h,p);
  if(path){const code=document.createElement('code');code.textContent=`GET ${path}`;body.append(code);}
  if(detail){const hint=document.createElement('p');hint.textContent=detail;body.append(hint);}
  el.append(symbol,body);$('checks').append(el);
}
function showRate(headers) {
  const remaining=headers.get('x-ratelimit-remaining');const limit=headers.get('x-ratelimit-limit');const reset=Number(headers.get('x-ratelimit-reset'));
  if(remaining===null || limit===null)return;
  $('rate').hidden=false;$('rate').textContent=`当前浏览器出口 IP 的 API 额度：剩余 ${remaining} / ${limit}${reset>0?` · 重置时间 ${new Date(reset*1000).toLocaleTimeString('zh-CN')}`:''}。额度可能与同一网络的其他人共享。`;
}
async function request(path, version, signal) {
  const started=performance.now();const headers={Accept:'application/vnd.github+json'};
  if(version)headers['X-GitHub-Api-Version']=version;
  const response=await fetch(`https://api.github.com${path}`,{headers,signal,credentials:'omit',cache:'no-store'});
  showRate(response.headers);
  if(response.status===403 || response.status===429) {
    blockedUntil=retryAt(response.headers);
    throw new Error(`GitHub 返回 ${response.status}，可能限流或拒绝访问。请在 ${new Date(blockedUntil).toLocaleTimeString('zh-CN')} 后再检查。`);
  }
  if(!response.ok)throw new Error(response.status===404?'未找到公开用户或资源（404），请检查用户名。':`GitHub 返回 HTTP ${response.status}，请核对版本与官方说明。`);
  const data=await response.json();return {data,headers:response.headers,ms:Math.round(performance.now()-started)};
}
$('check-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const version=$('api-version').value.trim();const user=$('test-user').value.trim().replace(/^@/,'');
  if(!VERSION.test(version)||!USERNAME.test(user)){$('check-status').textContent='请输入 YYYY-MM-DD 格式的 API 版本和有效 GitHub 用户名。';return;}
  if(Date.now()<blockedUntil){$('check-status').textContent=`请等到 ${new Date(blockedUntil).toLocaleTimeString('zh-CN')} 后再检查。`;return;}
  const controller=new AbortController();let timeout=false;
  const timer=setTimeout(()=>{timeout=true;controller.abort();},20000);
  results=[];$('checks').replaceChildren();$('rate').hidden=true;$('check-button').disabled=true;$('health').setAttribute('aria-busy','true');$('health-badge').textContent='检查中';$('check-status').textContent='正在依次检查 GitHub API，请稍候…';
  try {
    const versions=await request('/versions',null,controller.signal);
    if(!Array.isArray(versions.data)||!versions.data.every(v=>typeof v==='string'))throw new Error('GitHub 版本列表格式异常，无法确认支持状态。');
    if(!versions.data.includes(version)){addResult('API 版本未列入支持列表',`${version} 不在当前支持列表：${versions.data.join('、')}。请先核对版本。`,'fail','/versions');return;}
    addResult('API 版本仍受支持',`${version} 在 GitHub 实时支持列表中。`,'pass','/versions',`支持版本：${versions.data.join('、')}`);
    const username=encodeURIComponent(user);
    const endpoints=[['用户资料接口',`/users/${username}`],['最近更新仓库接口',`/users/${username}/repos?sort=updated&direction=desc&per_page=6&type=owner`]];
    for(const [title,path] of endpoints) {
      const result=await request(path,version,controller.signal);const missing=inspect(path,result.data);
      const deprecation=result.headers.get('deprecation');const sunset=result.headers.get('sunset');
      const selected=result.headers.get('x-github-api-version-selected');const deprecated=deprecation && deprecation!=='false';
      let summary=missing.length?`关键字段检查未通过：${missing.join('；')}`:'HTTP 200，关键字段检查通过。';
      if(deprecated||sunset)summary+=` 弃用提示：${deprecation||'未读到'}；停用时间：${sunset||'未读到'}。请核对官方说明。`;
      addResult(title,summary,missing.length?'fail':deprecated||sunset?'warn':'pass',path,`${result.ms} ms · 响应版本：${selected||'响应头未暴露'} · ${!deprecated&&!sunset?'未读到弃用或停用响应头。':''}`);
    }
  } catch(error) {
    addResult('检查未能完成',timeout?'20 秒内未完成，请检查网络后再试。':error instanceof TypeError?'无法连接 GitHub API，请检查网络后重试。':error.message,'fail');
  } finally {
    clearTimeout(timer);$('check-button').disabled=false;$('health').setAttribute('aria-busy','false');
    const failed=results.some(r=>r.level==='fail');const warn=results.some(r=>r.level==='warn');
    $('health-badge').textContent=failed?'需要处理':warn?'有弃用提示':'本次检查通过';
    $('check-status').textContent=`检查于 ${new Date().toLocaleString('zh-CN')} · ${failed?'存在未通过或未完成的检查。':'结果只代表当前抽样请求，不保证全部行为兼容。'}`;
  }
});
$('notice-form').addEventListener('submit',event=>{
  event.preventDefault();const title=$('notice-title').value.trim();const text=$('notice-text').value.trim();
  if(!title||!text){$('notice-status').textContent='请填写标题和通知内容。';return;}
  if(tasks.length>=50){$('notice-status').textContent='最多保留 50 张维护卡，请先导出并移除已完成事项。';return;}
  tasks.unshift({id:crypto.randomUUID(),title,due:$('due-date').value,created:new Date().toISOString(),items:plan(text)});
  $('notice-status').textContent='已生成维护清单。通知原文已从输入框清除，未保存。';
  $('notice-text').value='';$('notice-title').value='';$('due-date').value='';save();renderTasks();
});
$('sample').addEventListener('click',()=>{$('notice-title').value='[虚构示例] 核对用户资料字段变更';$('notice-text').value='这是功能演示，不是 GitHub 的真实通知：假设 GET /users/{username} 的某个字段将被 deprecated，请核对迁移说明，并验证 repositories 接口是否受影响。';$('due-date').value='';$('notice-status').textContent='已载入虚构示例，没有真实变更或截止日期。';});
$('export').addEventListener('click',()=>{const blob=new Blob([report(tasks,results)],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='github-api-maintenance.md';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
renderTasks();
