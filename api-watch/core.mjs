export const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export const VERSION = /^\d{4}-\d{2}-\d{2}$/;
export const STORE = 'api-watch.tasks.v1';
export function plan(text) {
  const rules = [
    [/\/users\b|user profile|用户资料|用户信息/i, '核对 GET /users/{username} 的字段、类型与兼容性。'],
    [/\/repos\b|repositor|仓库/i, '核对用户仓库接口的字段、排序与分页行为。'],
    [/oauth|token|authentication|认证|授权|令牌/i, '核对通知中的认证要求；本项目目前只使用匿名公开请求。'],
    [/rate.?limit|限流|配额/i, '检查匿名请求额度、Retry-After 和限流提示是否仍适用。'],
    [/deprecat|sunset|retir|breaking|弃用|停用|破坏性/i, '核对官方停用时间与迁移说明，在期限前完成验证。']
  ];
  return [
    '打开官方通知来源，确认适用的产品、API 版本和生效日期。',
    ...rules.filter(([pattern]) => pattern.test(text)).map(([, task]) => task),
    '运行 API 检查，并在 Profile Viewer 实际查询一个用户进行回归验证。',
    '记录需要的改动；有改动时通过独立分支和 PR 提交。'
  ].map(label => ({label, done:false}));
}
export function validTasks(value) {
  if (!Array.isArray(value) || value.length > 50) return [];
  return value.filter(t => t && typeof t.id === 'string' && t.id.length < 100 && typeof t.title === 'string' && t.title.length <= 100 && typeof t.due === 'string' && (t.due === '' || /^\d{4}-\d{2}-\d{2}$/.test(t.due)) && typeof t.created === 'string' && t.created.length < 100 && Array.isArray(t.items) && t.items.length <= 12 && t.items.every(x => x && typeof x.label === 'string' && x.label.length < 500 && typeof x.done === 'boolean'));
}
export function inspect(path, data) {
  if (path.includes('/repos?')) {
    if (!Array.isArray(data)) return ['响应应为仓库数组'];
    return data.flatMap((r,i) => ['name','html_url'].filter(k=>typeof r?.[k] !== 'string').map(k=>`第 ${i+1} 个仓库缺少 ${k}`));
  }
  return ['login','avatar_url','html_url','created_at'].filter(k=>typeof data?.[k] !== 'string').map(k=>`缺少字符串字段 ${k}`).concat(['public_repos','followers','following'].filter(k=>typeof data?.[k] !== 'number').map(k=>`缺少数字字段 ${k}`));
}
export function retryAt(headers, now = Date.now()) {
  const retry = headers.get('retry-after');
  const reset = Number(headers.get('x-ratelimit-reset'));
  if (retry) {const value = /^\d+$/.test(retry) ? now + Number(retry)*1000 : Date.parse(retry); if (Number.isFinite(value) && value > now) return value;}
  if (headers.get('x-ratelimit-remaining') === '0' && Number.isFinite(reset) && reset * 1000 > now) return reset*1000;
  return now + 60000;
}
export function report(tasks, results = []) {
  const clean = s=>String(s).replace(/[\r\n]/g,' ');
  return ['# GitHub API 维护清单', '', `导出时间：${new Date().toISOString()}`, '', '## 最近一次接口检查', ...(results.length ? results.map(r=>`- ${clean(r.title)}：${clean(r.summary)}`) : ['尚未运行检查。']), '', '## 维护事项', ...tasks.flatMap(t=>['',`### ${clean(t.title)}`,`期限：${t.due || '未设置'}；创建于：${clean(t.created)}`, ...t.items.map(x=>`- [${x.done?'x':' '}] ${clean(x.label)}`)]), '', '提示：本工具不会验证邮件真伪，不会自动接收邮件或授予任何会员权益。'].join('\n');
}
