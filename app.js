'use strict';
const $ = id => document.getElementById(id);
const usernamePattern = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const number = value => new Intl.NumberFormat('zh-CN').format(value ?? 0);
let activeRequest;

function safeURL(value, hosts) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (!hosts || hosts.includes(url.hostname)) ? url.href : null;
  } catch { return null; }
}

function setStatus(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}

async function api(path, signal) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10'},
    credentials: 'omit', signal
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error('没有找到这个用户，请检查 GitHub 用户名后重试。');
    if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
      const reset = Number(response.headers.get('x-ratelimit-reset'));
      const time = reset > 0 ? `，预计 ${new Date(reset * 1000).toLocaleTimeString('zh-CN')} 后可重试` : '，请稍后重试';
      throw new Error(`GitHub API 请求额度已用完${time}。同一网络可能共享额度。`);
    }
    if (response.status === 403) throw new Error('GitHub 暂时拒绝访问此资料，请稍后重试或在 GitHub 查看该账户。');
    throw new Error(`GitHub 服务暂时不可用（${response.status}），请稍后重试。`);
  }
  return response.json();
}

function metadata(text, href) {
  const item = document.createElement(href ? 'a' : 'span');
  item.textContent = text;
  if (href) { item.href = href; item.target = '_blank'; item.rel = 'noopener noreferrer'; }
  $('metadata').append(item);
}

function renderProfile(user) {
  $('display-name').textContent = user.name || user.login;
  $('profile-link').textContent = `@${user.login} ↗`;
  $('profile-link').href = `https://github.com/${encodeURIComponent(user.login)}`;
  $('account-type').textContent = user.type === 'Organization' ? 'ORGANIZATION' : 'GITHUB PROFILE';
  const avatar = safeURL(user.avatar_url, ['avatars.githubusercontent.com']);
  $('avatar').hidden = !avatar;
  if (avatar) { $('avatar').src = avatar; $('avatar').alt = `${user.login} 的头像`; }
  $('bio').textContent = user.bio || '这位开发者还没有填写简介。';
  $('repo-count').textContent = number(user.public_repos);
  $('followers').textContent = number(user.followers);
  $('following').textContent = number(user.following);
  $('metadata').replaceChildren();
  if (user.location) metadata(`⌖ ${user.location}`);
  if (user.company) metadata(user.company);
  const blog = user.blog && safeURL(/^https?:\/\//i.test(user.blog) ? user.blog : `https://${user.blog}`);
  if (blog) metadata('个人网站 ↗', blog);
  const joined = new Date(user.created_at);
  if (!Number.isNaN(joined.getTime())) metadata(`加入于 ${joined.toLocaleDateString('zh-CN')}`);
}

function renderRepos(repos) {
  $('repos').replaceChildren();
  $('repo-status').textContent = repos.length ? '' : '这个账户还没有可展示的公开仓库。';
  for (const repo of repos) {
    const card = document.createElement('article');
    card.className = 'repo panel';
    const title = document.createElement('h3');
    const link = document.createElement('a');
    link.textContent = `${repo.name} ↗`;
    link.href = safeURL(repo.html_url, ['github.com']) || 'https://github.com';
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    title.append(link);
    const description = document.createElement('p');
    description.textContent = repo.description || '这个仓库还没有填写描述。';
    const details = document.createElement('div');
    details.className = 'repo-details';
    for (const text of [repo.language || '未标注语言', `★ ${number(repo.stargazers_count)}`, `Fork ${number(repo.forks_count)}`, ...(repo.fork ? ['Fork 仓库'] : [])]) {
      const item = document.createElement('span'); item.textContent = text; details.append(item);
    }
    card.append(title, description, details); $('repos').append(card);
  }
}

async function search(raw) {
  activeRequest?.abort();
  $('result').hidden = true;
  $('result').setAttribute('aria-busy', 'false');
  const username = raw.trim().replace(/^@/, '');
  $('username').value = username;
  if (!usernamePattern.test(username)) {
    $('username').setAttribute('aria-invalid', 'true');
    setStatus('请输入有效的 GitHub 用户名：1–39 位字母、数字或单个连字符，不能以连字符开头或结尾。', true);
    $('username').focus(); return;
  }
  $('username').removeAttribute('aria-invalid');
  const controller = new AbortController();
  activeRequest = controller;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
  $('result').setAttribute('aria-busy', 'true');
  setStatus(`正在从 GitHub 获取 @${username} 的公开资料…`);
  try {
    const user = await api(`/users/${encodeURIComponent(username)}`, controller.signal);
    if (activeRequest !== controller) return;
    renderProfile(user);
    $('repos').replaceChildren();
    $('repo-status').textContent = '正在加载仓库…';
    $('fetched-at').textContent = '';
    $('result').hidden = false;
    setStatus(`已获取 @${user.login} 的公开资料。`);
    const shareURL = new URL(location.href);
    shareURL.searchParams.set('user', user.login);
    history.replaceState(null, '', shareURL);
    try {
      const repos = await api(`/users/${encodeURIComponent(user.login)}/repos?sort=updated&direction=desc&per_page=6&type=owner`, controller.signal);
      if (activeRequest !== controller) return;
      renderRepos(repos);
    } catch (error) {
      if (activeRequest !== controller) return;
      $('repo-status').textContent = timedOut ? '仓库加载超时，可以重新查询。' : controller.signal.aborted ? '仓库查询已取消。' : `资料已加载，但仓库加载失败：${error instanceof TypeError ? '请检查网络连接后重新查询。' : error.message}`;
    }
    if (activeRequest === controller) $('fetched-at').textContent = `实时查询于 ${new Date().toLocaleString('zh-CN')} · 数据来源：GitHub · 未登录请求通常每 IP 每小时限 60 次`;
  } catch (error) {
    if (activeRequest !== controller) return;
    if (timedOut) setStatus('请求超时，请检查网络连接后重新查询。', true);
    else if (!controller.signal.aborted) setStatus(error instanceof TypeError ? '无法连接 GitHub API，请检查网络连接后重试。' : error.message, true);
  } finally {
    clearTimeout(timeout);
    if (activeRequest === controller) $('result').setAttribute('aria-busy', 'false');
  }
}

$('search-form').addEventListener('submit', event => { event.preventDefault(); search($('username').value); });
document.querySelectorAll('[data-user]').forEach(button => button.addEventListener('click', () => search(button.dataset.user)));
const initialUser = new URLSearchParams(location.search).get('user');
if (initialUser) search(initialUser);
