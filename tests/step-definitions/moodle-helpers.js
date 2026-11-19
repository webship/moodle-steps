'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the steps use and that a project can require for its own steps:
// the wait on the site's own signals, the paths of the site, the users
// registry and the session cache, the login, the messages of a page (its
// alerts, the errors of its forms and the toasts it showed), the course and
// activity lookups, the rich text editor, and the friendly failures.
//
// Waiting: the site keeps a list of the JavaScript work it still has to do
// (`M.util.pending_js`: a page load, a request to the server, a template
// being rendered, an animation), the one its own test runner waits on. A page
// is ready when the document is loaded, that list is empty, its module loader
// (RequireJS) loads no module, and every React component of the page is
// mounted. No step sleeps.
//
// Every lookup starts with what a person reads (a label, a role, a text) and
// falls back to the stable hooks of the pages (`data-region`, `data-for`,
// `data-activityname`, the ids of the tables).

const { gotoUrl, friendly } = require('webship-js/tests/step-definitions/webship');

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds. Kept below webship-js's 45 second step timeout.
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** White space collapsed and trimmed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/** Letter case and white space ignored. */
function same(a, b) {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** The site root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** Join the site root and a path with exactly one slash. Absolute URLs pass through. */
function siteUrl(world, url) {
  if (!url) return siteRoot(world) + '/';
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/** The path of the page the browser shows, without the query and the fragment. */
function currentPath(world) {
  try {
    return new URL(world.page.url()).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

/** The path of an address, without the query, the fragment and a trailing slash. */
function pathOf(url) {
  try {
    return new URL(url, 'https://x.invalid').pathname.replace(/\/+$/, '') || '/';
  } catch {
    return String(url || '');
  }
}

// ---------------------------------------------------------------------------
// A request the browser cut
// ---------------------------------------------------------------------------

/**
 * A sentence for a failure when the browser shows its own error page
 * (`chrome-error://…`) instead of the site's answer: the request was cut
 * before the site answered, as Chromium does to every request in flight when
 * the network of the machine changes (a container starting or stopping on
 * it). An empty string otherwise.
 */
function cutRequest(world) {
  const url = world && world.page ? world.page.url() : '';
  return /^chrome-error:/.test(url) ? `the browser shows its own error page (${url}): the request was cut before the site answered` : '';
}

/** The hint of a failure `cutRequest` explains. */
const CUT_REQUEST_HINT = 'Nothing is wrong with the scenario: Chromium cuts every request in flight when the network of the machine changes (a container starting or stopping on it). Run the scenario again.';

/** A failure, or the one that says a request was cut when the browser shows its own error page. */
function failure(world, message, hint) {
  const cut = cutRequest(world);
  if (cut) return friendly({ message: `${message} But ${cut}.`, hint: CUT_REQUEST_HINT });
  return friendly({ message, hint });
}

// ---------------------------------------------------------------------------
// Waiting on the site's own signals
// ---------------------------------------------------------------------------

/**
 * What the page still has to do, as the page says it: '' when it is ready.
 * The document loading, the site's pending JavaScript (each key of
 * `M.util.pending_js`), a module the loader is still loading, a React
 * component not mounted yet.
 */
async function pendingWork(world) {
  try {
    return await world.page.evaluate(() => {
      if (document.readyState !== 'complete') return 'the document is still loading';
      const busy = [];
      const M = window.M;
      if (M && M.util && Array.isArray(M.util.pending_js) && M.util.pending_js.length) {
        busy.push(`pending JavaScript: ${M.util.pending_js.map(String).join(', ')}`);
      }
      const req = window.require;
      const ctx = req && req.s && req.s.contexts && req.s.contexts._;
      if (ctx) {
        const loading = Object.values(ctx.registry || {}).filter((m) => m && m.enabled && !m.error).map((m) => (m.map && m.map.id) || '?');
        if (loading.length || (ctx.defQueue && ctx.defQueue.length)) busy.push(`modules loading: ${loading.slice(0, 5).join(', ') || 'queued'}`);
      }
      const unmounted = document.querySelectorAll('[data-react-component]:not([data-react-mounted])').length;
      if (unmounted) busy.push(`${unmounted} interface part(s) not mounted yet`);
      return busy.join('; ');
    });
  } catch (err) {
    // A navigation replaced the document while it was read: not ready yet.
    return /Execution context was destroyed|navigation|Target closed|has been closed/i.test(String(err && err.message)) ? 'a new page is loading' : '';
  }
}

const TRACKED = new WeakMap();

/**
 * The background requests (XHR and fetch) of a page that are still running,
 * kept from the moment the page opens: the requests a page sends on its own
 * (a template, a string, a search) are part of its work too. A navigation of
 * the page drops those of the page it leaves.
 *
 * @returns {{pending: Set}}
 */
function requests(page) {
  let state = TRACKED.get(page);
  if (!state) {
    state = { pending: new Set() };
    TRACKED.set(page, state);
    const background = (request) => ['xhr', 'fetch'].includes(request.resourceType());
    page.on('request', (request) => { if (background(request)) state.pending.add(request); });
    const done = (request) => { state.pending.delete(request); };
    page.on('requestfinished', done);
    page.on('requestfailed', done);
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) state.pending.clear(); });
  }
  return state;
}

/**
 * Wait until the page is ready (see `pendingWork`) and no request of its own
 * has been running for a moment (200 ms). Returns '' when it is, else what it
 * was still doing when the time ran out; `strict` makes that a failure.
 */
async function pageReady(world, { timeout, strict = false } = {}) {
  const deadline = Date.now() + (timeout || budget(world) * 2);
  const state = requests(world.page);
  let busy = '';
  let quietSince = 0;
  for (;;) {
    busy = await pendingWork(world);
    if (!busy && state.pending.size) {
      busy = `requests in flight: ${[...state.pending].slice(0, 3).map((r) => r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80)).join(', ')}`;
    }
    if (!busy) {
      if (!quietSince) quietSince = Date.now();
      if (Date.now() - quietSince >= 200) return '';
    } else {
      quietSince = 0;
    }
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(50);
  }
  if (strict) {
    throw failure(world, `The page did not finish its work within ${timeout || budget(world) * 2} ms (${world.page.url()}): ${busy}.`, 'The site lists the work its pages still have to do; a key that stays is a request that never came back or a dialog that never finished opening. Check the browser console of the page.');
  }
  return busy;
}

/**
 * Open a URL and wait until the page is ready. A navigation that the browser
 * cut (the network of the machine changed) is tried once more.
 */
const CUT = /ERR_NETWORK_CHANGED|ERR_NETWORK_IO_SUSPENDED|ERR_INTERNET_DISCONNECTED|chrome-error:\/\/chromewebdata|interrupted by another navigation/;

async function open(world, url) {
  const address = siteUrl(world, url);
  try {
    await gotoUrl(world.page, address);
  } catch (err) {
    if (!CUT.test(String(err && err.message))) throw err;
    // Cut again: say so, instead of the browser's own words about an interrupted navigation.
    try {
      await gotoUrl(world.page, address);
    } catch (again) {
      if (!CUT.test(String(again && again.message))) throw again;
      throw friendly({ message: `Opening ${address} failed: the browser cut the request every time it was sent, because the network of this machine changed while it loaded (${(String(again.message).match(/net::[A-Z_]+|chrome-error:\/\/chromewebdata/) || ['an interrupted navigation'])[0]}).`, hint: CUT_REQUEST_HINT });
    }
  }
  if (cutRequest(world)) await gotoUrl(world.page, address);
  await world.page.waitForLoadState('load', { timeout: budget(world) }).catch(() => {});
  await pageReady(world);
}

/**
 * Run an action that may load a new page (a form sent, a link followed), and
 * wait until the page the browser ends on is ready. An action that does not
 * navigate only waits for the page's own work.
 */
async function afterAction(world, fn) {
  const before = world.page.url();
  let navigated = false;
  const onNav = (frame) => { if (frame === world.page.mainFrame()) navigated = true; };
  world.page.on('framenavigated', onNav);
  try {
    await fn();
    // A form post starts its navigation a moment after the click: give it the chance to.
    await world.page.waitForTimeout(80);
    if (navigated || world.page.url() !== before) {
      await world.page.waitForLoadState('load', { timeout: budget(world) * 2 }).catch(() => {});
    }
    await pageReady(world);
  } finally {
    world.page.off('framenavigated', onNav);
  }
}

/**
 * Click an element the way a person does: brought to the middle of the
 * window first, so the fixed header and the sticky footer of the theme never
 * cover it.
 */
async function personClick(locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {});
  await locator.click();
}

/**
 * Poll a reading until it satisfies a check, or fail with the last reading.
 *
 * @param {object} world
 * @param {Function} read - async () => value
 * @param {Function} check - (value) => boolean
 * @param {Function} explain - (value) => {message, hint}
 */
async function eventually(world, read, check, explain, timeout) {
  const deadline = Date.now() + (timeout || budget(world));
  let value;
  for (;;) {
    value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) {
      const { message, hint } = explain(value);
      throw failure(world, message, hint);
    }
    await world.page.waitForTimeout(150);
  }
}

// ---------------------------------------------------------------------------
// Toasts: the short messages that close by themselves
// ---------------------------------------------------------------------------

/**
 * Installed on every page of the run (see the step files): a record of each
 * toast the page shows, with its kind (`toast-success`, `toast-danger`, …)
 * and its text, kept after the toast closes by itself.
 */
function toastRecorder() {
  const seen = [];
  Object.defineProperty(window, '__webshipToasts', { value: seen, configurable: true });
  const record = (el) => {
    if (!el || !el.classList || !el.classList.contains('toast') || el.__webshipSeen) return;
    el.__webshipSeen = true;
    const read = () => {
      const kind = (String(el.className).match(/toast-(success|danger|warning|info)/) || [])[1] || 'info';
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) seen.push({ kind: kind === 'danger' ? 'error' : kind, text, at: Date.now() });
      else setTimeout(read, 50);
    };
    read();
  };
  const watch = () => {
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          record(node);
          if (node.querySelectorAll) node.querySelectorAll('.toast').forEach(record);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) watch();
  else document.addEventListener('DOMContentLoaded', watch);
}

/** The toasts the page showed since it loaded, newest last. */
async function recordedToasts(world) {
  return world.page.evaluate(() => (window.__webshipToasts || []).slice()).catch(() => []);
}

// ---------------------------------------------------------------------------
// Messages: alerts, form errors, toasts
// ---------------------------------------------------------------------------

/**
 * The messages the page shows, by kind (error, success, warning, info): its
 * alert boxes (the notifications at the top of a page, the error box of an
 * error page, the alerts of a dialog), the errors under the fields of its
 * forms, and the toasts it showed (still on screen or not). Each box is split
 * into its lines; the "Dismiss this notification" and "More information about
 * this error" links are not message text.
 *
 * @returns {Promise<Array<{kind: string, text: string, source: string}>>}
 */
async function pageMessages(world) {
  const shown = await world.page.evaluate(() => {
    const out = [];
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && (rect.width || rect.height);
    };
    const kindOf = (cls, role) => {
      if (/\b(alert-danger|errorbox|alert-error|text-danger)\b/.test(cls)) return 'error';
      if (/\balert-success\b/.test(cls)) return 'success';
      if (/\balert-warning\b/.test(cls)) return 'warning';
      if (/\b(alert-info|alert-primary|alert-secondary)\b/.test(cls)) return 'info';
      return role === 'alert' ? 'error' : 'info';
    };
    const skip = /^(dismiss this notification|more information about this error|×|continue)$/i;
    const boxes = [...document.querySelectorAll('.alert, .errorbox, .invalid-feedback, .form-control-feedback')]
      .filter((box) => !box.closest('[data-region="message-drawer"], .toast-wrapper') && visible(box));
    for (const box of boxes) {
      if (boxes.some((other) => other !== box && other.contains(box))) continue;
      const field = box.matches('.invalid-feedback, .form-control-feedback');
      const kind = field ? 'error' : kindOf(String(box.className), box.getAttribute('role'));
      for (const line of (box.innerText || '').split('\n')) {
        const text = line.replace(/\s+/g, ' ').trim();
        if (text && !skip.test(text)) out.push({ kind, text, source: field ? 'field' : 'alert' });
      }
    }
    return out;
  }).catch(() => []);
  const toasts = (await recordedToasts(world)).map((t) => ({ kind: t.kind, text: t.text, source: 'toast' }));
  return shown.concat(toasts);
}

// ---------------------------------------------------------------------------
// Accounts and the session
// ---------------------------------------------------------------------------

/**
 * An account of the users registry in cucumber.js (`worldParameters.users`),
 * by the handle a scenario names it with: its user name, password, and, when
 * the registry has them, its address and its full name.
 *
 * @returns {{handle: string, username: string, password: string, email: (string|undefined), name: (string|undefined)}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.${String(handle).toUpperCase()}_PASSWORD, email: '${handle}@example.com', name: 'Full Name' } }. The account itself is created once by the build of the site, never by a feature.`,
    });
  }
  if (!entry.username || !entry.password) {
    throw friendly({
      message: `The user "${handle}" has no ${entry.username ? 'password' : 'user name'} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.username and .password in cucumber.js.`,
    });
  }
  return { handle, username: entry.username, password: entry.password, email: entry.email, name: entry.name };
}

/** The name a page shows for an account: the full name of the registry, else its user name. */
function shownName(user) {
  return user.name || user.username;
}

/**
 * The ways a person finds an account in a list: its full name and its
 * address (a handle of the registry), or the text itself.
 */
function accountKeys(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  if (users[who]) {
    const user = resolveUser(world, who);
    return { label: `"${who}"`, keys: [user.name, user.email, user.username].filter(Boolean), user };
  }
  return { label: `"${who}"`, keys: [who], user: null };
}

// The sessions of the accounts that logged in during this run, by site and
// user name: the cookies of the browser after a login through the form, and
// the name the user menu showed. A scenario that logs in as an account that
// already has a session takes it over instead of filling in the login form
// again. `worldParameters.reuseSessions: false` in cucumber.js turns it off.
const SESSIONS = new Map();

function sessionKey(world, username) {
  return `${siteRoot(world)}|${String(username).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

/** The login page (`worldParameters.loginPath`, /login/index.php). */
function loginPath(world) {
  return '/' + String((world.parameters && world.parameters.loginPath) || '/login/index.php').replace(/^\/+/, '');
}

/** The login form: the visible form with a password field and a user name field. */
function loginForm(world) {
  return world.page.locator('form:has(input[type="password"]):has(input[name="username"])').filter({ visible: true }).first();
}

/**
 * Who the page says is signed in: `{state: 'user', name}` for an account (the
 * name of the user menu), `{state: 'guest'}` for guest access, `{state:
 * 'visitor'}` when nobody is signed in.
 */
async function signedInState(world) {
  return world.page.evaluate(() => {
    const menu = document.querySelector('.usermenu, #usernavigation');
    const text = menu ? (menu.innerText || '').replace(/\s+/g, ' ') : '';
    if (/currently using guest access/i.test(text)) return { state: 'guest' };
    const toggle = document.querySelector('#user-menu-toggle');
    if (toggle) {
      const img = toggle.querySelector('img[alt], .userinitials[title], [aria-label]');
      const name = (img && (img.getAttribute('alt') || img.getAttribute('title') || img.getAttribute('aria-label'))) || '';
      return { state: 'user', name: name.replace(/\s+/g, ' ').trim() };
    }
    return { state: 'visitor' };
  }).catch(() => ({ state: 'unknown' }));
}

/** Open the Dashboard and say who is signed in (see `signedInState`). */
async function whoIsSignedIn(world) {
  await open(world, '/my/');
  return signedInState(world);
}

const LOGIN_HINT = 'The login form is at /login/index.php (worldParameters.loginPath): the fields "Username or email" and "Password" and the "Log in" button. Check launchUrl in cucumber.js.';

/**
 * Open the login page as a new visitor: the page the browser showed is left
 * first (a page that is still sending requests could start a session of its
 * own after the cookies are gone, and the token of the login form would then
 * belong to another session), then the cookies of the browser are cleared.
 */
async function openLoginForm(world) {
  await world.page.goto('about:blank').catch(() => {});
  await world.page.context().clearCookies();
  world.__sessionKey = null;
  await open(world, loginPath(world));
  try {
    await loginForm(world).waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw failure(world, `The login form did not appear at ${siteUrl(world, loginPath(world))} (${world.page.url()}).`, LOGIN_HINT);
  }
}

/**
 * Fill in and send the login form, and read its outcome: the page the site
 * sends a signed-in account to, or the error message of the login page.
 *
 * @returns {Promise<{error: string}>}
 */
async function submitLogin(world, username, password) {
  await openLoginForm(world);
  const form = loginForm(world);
  // The page renders parts of its form again after it loads (the show/hide toggle of the password
  // field replaces the field, empty, once its template arrives): fill in, wait for the page's own
  // work, and fill in again what the page emptied, as a person who sees an empty field does.
  for (let i = 0; i < 3; i += 1) {
    await form.locator('input[name="username"]').fill(username);
    await form.locator('input[type="password"]').first().fill(password);
    await pageReady(world);
    const held = await form.evaluate((f) => ({
      username: (f.querySelector('input[name="username"]') || {}).value,
      password: (f.querySelector('input[type="password"]') || {}).value,
    })).catch(() => ({}));
    if (held.username === username && held.password === password) break;
  }
  const submit = form.locator('button[type="submit"], input[type="submit"]').first();
  await afterAction(world, () => personClick(submit));
  if (cutRequest(world)) return { error: cutRequest(world), cut: true };
  if (currentPath(world) !== pathOf(loginPath(world))) return { error: '' };
  const errors = (await pageMessages(world)).filter((m) => m.kind === 'error').map((m) => m.text);
  return { error: errors.join(' ') || `the login page came back with no message (${world.page.url()})` };
}

/**
 * Log in through the form as an account of the registry. A refusal is tried
 * once more: the account is known to be right, and a login form whose token
 * went to another session is refused the same way as a wrong password.
 */
async function loginThroughTheForm(world, user) {
  let outcome = await submitLogin(world, user.username, user.password);
  if (outcome.error) {
    const first = outcome.error;
    outcome = await submitLogin(world, user.username, user.password);
    if (!outcome.error) process.stderr.write(`\n[moodle-steps] the login of "${user.handle}" was refused once (${first}); the second try went through.\n`);
  }
  if (!outcome.error) {
    const state = await signedInState(world);
    if (state.state === 'user') user.shown = state.name;
  }
  return outcome;
}

/** Take over the session an account opened earlier in this run. */
async function restoreSession(world, user) {
  const key = sessionKey(world, user.username);
  const saved = SESSIONS.get(key);
  if (!saved || !reuseSessions(world)) return false;
  const context = world.page.context();
  await world.page.goto('about:blank').catch(() => {});
  await context.clearCookies();
  await context.addCookies(saved.cookies);
  const state = await whoIsSignedIn(world);
  if (state.state === 'user' && (!saved.name || same(state.name, saved.name))) {
    world.__sessionKey = key;
    world.__signedInAs = user.handle;
    return true;
  }
  // The session ended since (a logout, a timeout): log in again.
  SESSIONS.delete(key);
  await world.page.goto('about:blank').catch(() => {});
  await context.clearCookies();
  return false;
}

/**
 * Log in as an account of the users registry, by its handle: take over its
 * session when it has one from earlier in the run, else log in through the
 * form and keep the session for the next scenario.
 */
async function logInAs(world, handle) {
  const user = resolveUser(world, handle);
  if (await restoreSession(world, user)) return user;
  const outcome = await loginThroughTheForm(world, user);
  if (outcome.error) {
    throw friendly({
      message: `Could not log in as "${handle}" (${user.username}): ${outcome.error}`,
      hint: outcome.cut ? CUT_REQUEST_HINT : 'Check the user name and the password of the account in worldParameters.users, and that the build of the site created the account (and did not suspend it).',
    });
  }
  if (reuseSessions(world)) {
    const key = sessionKey(world, user.username);
    SESSIONS.set(key, { cookies: await world.page.context().cookies(), name: user.shown || '' });
    world.__sessionKey = key;
  }
  world.__signedInAs = handle;
  return user;
}

/** Forget the session of the browser in the session cache: it ended (a logout). */
function forgetSession(world) {
  if (world.__sessionKey) SESSIONS.delete(world.__sessionKey);
  world.__sessionKey = null;
  world.__signedInAs = null;
}

// ---------------------------------------------------------------------------
// Courses and activities
// ---------------------------------------------------------------------------

/**
 * Open a course by its full name or short name, the way a person finds it:
 * the course search of the site (`/course/search.php`), then the course page.
 * An account that is not enrolled lands on the course's enrolment options
 * page, as the site sends it. The course is the scenario's course from then
 * on (steps that say "the course" use it).
 */
async function openCourse(world, name) {
  await open(world, `/course/search.php?search=${encodeURIComponent(name)}`);
  const links = world.page.locator('#region-main a[href*="/course/view.php?id="]');
  const found = await links.evaluateAll((els) => els.map((a) => ({ text: (a.innerText || '').replace(/\s+/g, ' ').trim(), href: a.href }))).catch(() => []);
  const match = found.find((l) => same(l.text, name)) || null;
  let href = match && match.href;
  if (!href) {
    // A short name is not a link text: the result whose page names it.
    const byShort = found.find((l) => l.text && found.length === 1);
    href = byShort && byShort.href;
  }
  if (!href) {
    throw failure(world, `No course "${name}" is found by the course search of the site. It lists: ${listed(found.map((l) => l.text))}.`, 'Name the course by its full name as the site writes it ("Software Testing 101"), or by its short name ("TEST101"). An account sees a hidden course only with the right to.');
  }
  world.__course = { name: match ? match.text : name, id: Number(new URL(href).searchParams.get('id')), url: href };
  await open(world, href);
  return world.__course;
}

/** The scenario's course: the one a step opened last, or fail plainly. */
function currentCourse(world) {
  if (!world.__course) {
    throw friendly({ message: 'No course is open in this scenario.', hint: 'Open the course first: When I open the course "Software Testing 101".' });
  }
  return world.__course;
}

/** Open the page of the scenario's course. */
async function openCurrentCourse(world) {
  const course = currentCourse(world);
  await open(world, `/course/view.php?id=${course.id}`);
  return course;
}

/**
 * The activities of the course page on screen, by name: each with its module
 * type, its section, its link and its completion as the page shows it.
 */
async function courseActivities(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('#region-main li.activity[data-for="cmitem"], #region-main li.activity')].map((li) => {
    const named = li.querySelector('[data-activityname]');
    const instance = li.querySelector('.instancename');
    let name = named ? named.getAttribute('data-activityname') : '';
    if (!name && instance) {
      const copy = instance.cloneNode(true);
      copy.querySelectorAll('.accesshide').forEach((x) => x.remove());
      name = copy.textContent;
    }
    const section = li.closest('li.section, [data-for="section"]');
    const link = li.querySelector('a.aalink, a[href*="/mod/"]');
    const manual = li.querySelector('button[data-action="toggle-manual-completion"]');
    const auto = li.querySelector('[data-region="completionrequirements"] .dropdown-toggle, [data-region="completionrequirements"] button');
    const conditions = [...li.querySelectorAll('[data-region="completionrequirements"] [role="listitem"]')].map((item) => {
      const hidden = item.querySelector('.visually-hidden, .sr-only');
      const state = hidden ? hidden.textContent.replace(/[:\s]+$/, '').trim() : '';
      const copy = item.cloneNode(true);
      copy.querySelectorAll('.visually-hidden, .sr-only').forEach((x) => x.remove());
      return { state, text: copy.textContent.replace(/\s+/g, ' ').trim() };
    });
    let completion = null;
    if (manual) completion = { kind: 'manual', done: manual.getAttribute('data-toggletype') === 'manual:undo', label: manual.innerText.trim() };
    else if (auto) completion = { kind: 'automatic', done: /^done$/i.test(auto.innerText.trim()), label: auto.innerText.trim() };
    return {
      id: li.getAttribute('data-id') || (li.id || '').replace(/^module-/, ''),
      name: (name || '').replace(/\s+/g, ' ').trim(),
      type: ((li.className.match(/modtype_(\w+)/) || [])[1]) || '',
      section: section ? (section.getAttribute('data-sectionname') || (section.querySelector('.sectionname, h3') || {}).textContent || '').replace(/\s+/g, ' ').trim() : '',
      href: link ? link.href : '',
      completion,
      conditions,
    };
  })).catch(() => []);
}

/**
 * An activity of the scenario's course, by its name, read from the course
 * page (which the step opens when the browser is elsewhere).
 */
async function findActivity(world, name) {
  const course = currentCourse(world);
  if (!new RegExp(`/course/view\\.php\\?id=${course.id}(&|$)`).test(world.page.url())) await openCurrentCourse(world);
  const all = await courseActivities(world);
  const activity = all.find((a) => same(a.name, name));
  if (!activity) {
    throw failure(world, `The course "${course.name}" has no activity "${name}" on its page. Its activities: ${listed(all.map((a) => a.name))}.`, 'Name the activity as the course page writes it. An account sees a hidden activity only with the right to.');
  }
  return activity;
}

/** Open an activity of the scenario's course by its name, through its link on the course page. */
async function openActivity(world, name) {
  const activity = await findActivity(world, name);
  if (!activity.href) throw failure(world, `The activity "${name}" has no link on the course page.`, 'A label or an activity without a page of its own cannot be opened.');
  await open(world, activity.href);
  return activity;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * A table of the page as text: its column headings and its rows (each a list
 * of cell texts, the "Cell actions" and "Actions" buttons left out), the empty
 * rows that pad a dynamic table skipped.
 */
async function readTable(world, selector) {
  return world.page.evaluate((sel) => {
    const table = document.querySelector(sel);
    if (!table) return null;
    const text = (cell) => {
      const copy = cell.cloneNode(true);
      copy.querySelectorAll('.visually-hidden, .sr-only, .accesshide, .action-menu, [data-action="cell-actions"], .dropdown-menu, .userinitials').forEach((x) => x.remove());
      return copy.textContent.replace(/\s+/g, ' ').trim();
    };
    const headRow = table.querySelector('thead tr:last-child') || table.querySelector('tr.heading') || table.querySelector('tr');
    const head = headRow ? [...headRow.querySelectorAll('th, td')].map(text) : [];
    const rows = [...table.querySelectorAll('tbody tr')].filter((tr) => !tr.classList.contains('emptyrow') && tr !== headRow)
      .map((tr) => [...tr.querySelectorAll('th, td')].map(text)).filter((cells) => cells.some(Boolean));
    return { head, rows };
  }, selector).catch(() => null);
}

/** The index of a column by its heading (letter case ignored, "Cell actions" left out). */
function columnIndex(head, name) {
  const wanted = clean(name).toLowerCase();
  let i = head.findIndex((h) => clean(h).toLowerCase() === wanted);
  if (i < 0) i = head.findIndex((h) => clean(h).toLowerCase().startsWith(wanted));
  return i;
}

/** The row of a table that holds one of the keys as a cell (an account's name or address). */
function rowFor(rows, keys) {
  const wanted = keys.map((k) => clean(k).toLowerCase());
  return rows.find((cells) => cells.some((cell) => wanted.includes(clean(cell).toLowerCase())))
    || rows.find((cells) => cells.some((cell) => wanted.some((k) => clean(cell).toLowerCase().endsWith(k))))
    || null;
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

/**
 * Type into a rich text editor the way a person does: the editor of the field
 * whose label is `label` (the text area behind it), cleared first. A field
 * the site shows as a plain text area is filled.
 */
async function typeIntoEditor(world, label, text, scope) {
  const root = scope || world.page;
  const id = await root.locator('label').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`, 'i') }).first().getAttribute('for', { timeout: budget(world) }).catch(() => null);
  const target = id ? id : null;
  const editorId = target ? await world.page.evaluate((fieldId) => {
    const el = document.getElementById(fieldId);
    if (!el) return null;
    if (el.tagName === 'TEXTAREA') return el.id;
    const area = el.closest('.fitem, .form-group') && el.closest('.fitem, .form-group').querySelector('textarea');
    return area ? area.id : null;
  }, target) : null;
  if (!editorId) {
    throw failure(world, `No text editor "${label}" is on the page (${world.page.url()}).`, 'Name the editor by its label as the form writes it ("Online text", "Message", "Feedback comments").');
  }
  // The editor builds itself after the page loads: wait for it, or for the plain text area.
  await eventually(world, () => world.page.evaluate((tid) => {
    const editor = window.tinymce && window.tinymce.get(tid);
    if (editor) return editor.initialized ? 'editor' : '';
    const area = document.getElementById(tid);
    return area && area.offsetWidth ? 'plain' : '';
  }, editorId).catch(() => ''), Boolean, () => ({ message: `The text editor "${label}" did not finish loading.`, hint: 'The rich text editor loads after the page; check the browser console of the page.' }));
  const kind = await world.page.evaluate((tid) => (window.tinymce && window.tinymce.get(tid) ? 'editor' : 'plain'), editorId);
  if (kind === 'plain') {
    await world.page.locator(`[id="${editorId}"]`).fill(text);
    return;
  }
  const body = world.page.frameLocator(`[id="${editorId}_ifr"]`).locator('body');
  await body.click();
  await world.page.keyboard.press('ControlOrMeta+A');
  await world.page.keyboard.press('Delete');
  await world.page.keyboard.type(text);
  const content = await world.page.evaluate((tid) => window.tinymce.get(tid).getContent({ format: 'text' }), editorId);
  if (!clean(content).includes(clean(text))) {
    throw failure(world, `The text editor "${label}" holds "${clean(content)}" after typing "${text}".`, 'Something in the editor took the keys (a dialog of the editor, a plugin). Look at the screenshot of the failed step.');
  }
}

module.exports = {
  budget,
  escapeRegExp,
  clean,
  same,
  listed,
  siteRoot,
  siteUrl,
  currentPath,
  pathOf,
  cutRequest,
  CUT_REQUEST_HINT,
  failure,
  pendingWork,
  requests,
  pageReady,
  open,
  afterAction,
  personClick,
  eventually,
  toastRecorder,
  recordedToasts,
  pageMessages,
  resolveUser,
  shownName,
  accountKeys,
  SESSIONS,
  sessionKey,
  reuseSessions,
  loginPath,
  loginForm,
  signedInState,
  whoIsSignedIn,
  LOGIN_HINT,
  openLoginForm,
  submitLogin,
  loginThroughTheForm,
  restoreSession,
  logInAs,
  forgetSession,
  openCourse,
  currentCourse,
  openCurrentCourse,
  courseActivities,
  findActivity,
  openActivity,
  readTable,
  columnIndex,
  rowFor,
  typeIntoEditor,
};
