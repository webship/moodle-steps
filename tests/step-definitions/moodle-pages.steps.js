'use strict';

// The pages every account meets: the messages a page shows (its alerts, the
// errors of its forms, its toasts), the Dashboard and My courses with their
// blocks, the wait on the page's own work, and who may open a page.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  same,
  listed,
  siteUrl,
  pathOf,
  failure,
  open,
  pageReady,
  eventually,
  pageMessages,
  loginPath,
  loginForm,
  logInAs,
} = require('./moodle-helpers');

const KINDS = { error: 'error', success: 'success', warning: 'warning', information: 'info' };

/**
 * Assert that the page shows, or does not show, a message of a kind: an alert
 * box of the page (the notifications at its top, the error box of an error
 * page, an alert of a dialog), an error under a field of a form, or a toast
 * the page showed (a toast closes by itself; the step reads it after it did).
 * A box that lists several lines is read line by line; a line matches when it
 * starts with the text.
 *
 * Example #1: Then I should see the error message "Your login info may be incorrect. Please try again."
 * Example #2: Then I should see the success message "Post added."
 * Example #3: And I should see the information message "There are no discussion topics yet in this forum."
 * Example #4: Then we should not see the error message "Access denied"
 * Example #5: Then I should see the warning message "Guests cannot access this course. Please log in."
 */
Then(/^(I |we )*should( not)* see the (error|success|warning|information) message "([^"]*)"$/, async function (pronounCase, notCase, kindWord, text) {
  const kind = KINDS[kindWord];
  const matches = (m) => m.kind === kind && clean(m.text).toLowerCase().startsWith(clean(text).toLowerCase());
  if (notCase) {
    const all = await pageMessages(this);
    if (all.some(matches)) {
      throw failure(this, `Expected no ${kindWord} message "${text}", but the page shows it.`, 'The page shows the message in an alert box, under a field or in a toast.');
    }
    return;
  }
  await eventually(this, () => pageMessages(this), (all) => all.some(matches), (all) => ({
    message: `Expected the ${kindWord} message "${text}", but the page shows ${all.length ? all.map((m) => `${m.kind}: "${m.text}"`).join(', ') : 'no message'} (${this.page.url()}).`,
    hint: 'A message is matched by its kind (the colour of its box) and the start of one of its lines. Use "I should see the message" for a message of any kind.',
  }));
});

/**
 * Assert that the page shows, or does not show, a message of any kind (see
 * the step above): an alert box, an error under a field, or a toast.
 *
 * Example #1: Then I should see the message "1 enrolled users"
 * Example #2: Then I should not see the message "Discussion deleted"
 * Example #3: And I should see the message "The changes to the grade and feedback were saved"
 * Example #4: Then we should see the message "Class discussion marked as done."
 * Example #5: But we should not see the message "Access denied"
 */
Then(/^(I |we )*should( not)* see the message "([^"]*)"$/, async function (pronounCase, notCase, text) {
  const matches = (m) => clean(m.text).toLowerCase().startsWith(clean(text).toLowerCase());
  if (notCase) {
    if ((await pageMessages(this)).some(matches)) {
      throw failure(this, `Expected no message "${text}", but the page shows it.`, 'The page shows the message in an alert box, under a field or in a toast.');
    }
    return;
  }
  await eventually(this, () => pageMessages(this), (all) => all.some(matches), (all) => ({
    message: `Expected the message "${text}", but the page shows ${all.length ? all.map((m) => `"${m.text}"`).join(', ') : 'no message'} (${this.page.url()}).`,
    hint: 'A message is matched by the start of one of its lines: an alert box at the top of the page or in a dialog, an error under a field, or a toast.',
  }));
});

/**
 * Assert that the page shows no error message at all: no red alert box, no
 * error under a field, no error toast.
 *
 * Example #1: Then I should not see any error message
 * Example #2: Then we should not see any error message
 * Example #3: And I should not see any error message
 * Example #4: But I should not see any error message
 * Example #5: Then I should not see any error message
 */
Then(/^(I |we )*should not see any error message$/, async function (pronounCase) {
  await pageReady(this);
  const errors = (await pageMessages(this)).filter((m) => m.kind === 'error');
  if (errors.length) {
    throw failure(this, `Expected no error message, but the page shows ${listed(errors.map((m) => m.text))} (${this.page.url()}).`, 'Read the message: the site says what it refused and why.');
  }
});

/**
 * Wait until the page has finished its own work: the document is loaded, the
 * site's list of pending JavaScript is empty, its module loader loads no
 * module and every part of the page built with React is mounted. The steps of
 * this pack wait like this after every action; the step is for a project's own
 * steps that act on a page without waiting.
 *
 * Example #1: When I wait for the page to be ready
 * Example #2: And we wait for the page to be ready
 * Example #3: Then I wait for the page to be ready
 * Example #4: Given I wait for the page to be ready
 * Example #5: When we wait for the page to be ready
 */
When(/^(I |we )*wait for the page to be ready$/, async function (pronounCase) {
  await pageReady(this, { strict: true });
});

/**
 * Open the Dashboard of the account that is logged in.
 *
 * Example #1: When I go to my dashboard
 * Example #2: Given I go to my dashboard
 * Example #3: And I go to my dashboard
 * Example #4: Then I go to my dashboard
 * Example #5: But I go to my dashboard
 */
When(/^I go to my dashboard$/, async function () {
  await open(this, '/my/');
  if (pathOf(this.page.url()) !== '/my') {
    throw failure(this, `The Dashboard sent the browser to ${this.page.url()}.`, 'Log in first: the Dashboard is a page of a signed-in account (or of a guest, when the site allows it).');
  }
});

/**
 * Open the page that lists the courses of the account: My courses, or, on a
 * site where My courses is turned off (a new site of the 5.x line), the
 * Dashboard it sends the browser to, where the "Course overview" block lists
 * them.
 *
 * Example #1: When I go to my courses
 * Example #2: Given I go to my courses
 * Example #3: And I go to my courses
 * Example #4: Then I go to my courses
 * Example #5: But I go to my courses
 */
When(/^I go to my courses$/, async function () {
  await open(this, '/my/courses.php');
  await courseOverview(this);
});

/** The "Course overview" block of the page, once it has listed the courses. */
async function courseOverview(world) {
  const block = world.page.locator('section.block_myoverview, [data-block="myoverview"], section[aria-labelledby]:has(h3:text-is("Course overview"))').first();
  try {
    await block.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw failure(world, `The page has no "Course overview" block (${world.page.url()}).`, 'My courses (or the Dashboard of a site without My courses) lists the courses of the account in the "Course overview" block.');
  }
  await pageReady(world);
  return block;
}

/** The courses the "Course overview" block lists, with their progress. */
async function overviewCourses(world) {
  const block = await courseOverview(world);
  return block.evaluate((b) => [...b.querySelectorAll('[data-region="course-content"]')].map((card) => {
    const named = card.querySelector('.coursename .multiline[title]');
    let name = named ? named.getAttribute('title') : '';
    if (!name) {
      const link = card.querySelector('.coursename');
      const copy = link ? link.cloneNode(true) : null;
      if (copy) copy.querySelectorAll('.visually-hidden, .sr-only, [data-region="favourite-icon"]').forEach((x) => x.remove());
      name = copy ? copy.textContent : '';
    }
    const progress = card.querySelector('.progress-text');
    const pct = progress ? (progress.textContent.match(/(\d+)\s*%/) || [])[1] : undefined;
    return { name: name.replace(/\s+/g, ' ').trim(), progress: pct !== undefined ? `${pct}%` : '' };
  }).filter((c) => c.name));
}

/**
 * Assert that the "Course overview" block (My courses, or the Dashboard of a
 * site without My courses) lists, or does not list, a course. The step opens
 * My courses when the page has no such block.
 *
 * Example #1: Then my courses should list "Software Testing 101"
 * Example #2: Then my courses should not list "Software Testing 101"
 * Example #3: And my courses should list "Software Testing 101"
 * Example #4: But my courses should not list "Software Testing 101"
 * Example #5: Then my courses should list "Software Testing 101"
 */
Then(/^my courses should( not)* list "([^"]*)"$/, async function (notCase, name) {
  if (!(await this.page.locator('section.block_myoverview, [data-block="myoverview"]').count())) await open(this, '/my/courses.php');
  const read = () => overviewCourses(this);
  if (notCase) {
    const courses = await read();
    if (courses.some((c) => same(c.name, name))) {
      throw failure(this, `Expected the course overview not to list "${name}", but it does.`, 'The block lists the courses the account is enrolled in.');
    }
    return;
  }
  await eventually(this, read, (courses) => courses.some((c) => same(c.name, name)), (courses) => ({
    message: `Expected the course overview to list "${name}", but it lists ${listed(courses.map((c) => c.name))}.`,
    hint: 'The block lists the courses the account is enrolled in, by their full name; its "All" grouping shows all of them.',
  }));
});

/**
 * Assert the progress the "Course overview" block shows for a course (the
 * share of the activities with completion the account has completed).
 *
 * Example #1: Then the course progress of "Software Testing 101" should be "0%"
 * Example #2: Then the course progress of "Software Testing 101" should be "25%"
 * Example #3: And the course progress of "Software Testing 101" should be "0%"
 * Example #4: Then the course progress of "Software Testing 101" should be "100%"
 * Example #5: But the course progress of "Software Testing 101" should be "0%"
 */
Then(/^the course progress of "([^"]*)" should be "([^"]*)"$/, async function (name, expected) {
  if (!(await this.page.locator('section.block_myoverview, [data-block="myoverview"]').count())) await open(this, '/my/courses.php');
  const want = clean(expected).replace(/\s+/g, '');
  await eventually(this, () => overviewCourses(this), (courses) => courses.some((c) => same(c.name, name) && c.progress === want), (courses) => {
    const course = courses.find((c) => same(c.name, name));
    return {
      message: course ? `Expected the progress of "${name}" to be ${want}, but the course overview shows ${course.progress || 'no progress'}.` : `The course overview does not list "${name}"; it lists ${listed(courses.map((c) => c.name))}.`,
      hint: 'The progress shows for a course with completion tracking on; it counts the activities with completion conditions.',
    };
  });
});

/**
 * Assert that the page shows, or does not show, a block, by its title
 * ("Course overview", "Timeline", "Calendar").
 *
 * Example #1: Then I should see the block "Timeline"
 * Example #2: Then I should not see the block "Calendar"
 * Example #3: And I should see the block "Course overview"
 * Example #4: Then we should see the block "Timeline"
 * Example #5: But we should not see the block "Online users"
 */
Then(/^(I |we )*should( not)* see the block "([^"]*)"$/, async function (pronounCase, notCase, title) {
  const read = () => this.page.evaluate(() => [...document.querySelectorAll('section.block, aside .block, [data-block]')]
    .filter((b) => b.offsetWidth || b.offsetHeight)
    .map((b) => {
      const h = b.querySelector('h2, h3, h5, .card-title');
      return (b.getAttribute('aria-label') || (h ? h.textContent : '')).replace(/\s+/g, ' ').trim();
    })).catch(() => []);
  const has = (titles) => titles.some((t) => same(t, title));
  if (notCase) {
    if (has(await read())) throw failure(this, `Expected no block "${title}", but the page shows it.`, 'Blocks are added and removed in edit mode, per page.');
    return;
  }
  await eventually(this, read, has, (titles) => ({
    message: `Expected the block "${title}", but the page shows the blocks ${listed(titles)} (${this.page.url()}).`,
    hint: 'A block is named by its title. Some blocks sit in the block drawer at the side of the page.',
  }));
});

/**
 * Assert that the "Timeline" block of the Dashboard lists, or does not list,
 * an activity with something to do (an assignment due, a quiz to take).
 *
 * Example #1: Then the timeline should list "Testing diary"
 * Example #2: Then the timeline should not list "Testing diary"
 * Example #3: And the timeline should list "Testing diary"
 * Example #4: But the timeline should not list "Basics quiz"
 * Example #5: Then the timeline should list "Testing diary"
 */
Then(/^the timeline should( not)* list "([^"]*)"$/, async function (notCase, name) {
  if (!(await this.page.locator('section.block_timeline, [data-block="timeline"]').count())) await open(this, '/my/');
  const block = this.page.locator('section.block_timeline, [data-block="timeline"]').first();
  if (!(await block.count())) throw failure(this, 'The Dashboard has no "Timeline" block.', 'The Timeline block is on a new Dashboard; it may have been removed in edit mode.');
  await pageReady(this);
  // The name of each item, not its action button ("Add submission", "Attempt quiz now").
  const read = () => block.evaluate((b) => [...b.querySelectorAll('[data-region="event-list-item"]')]
    .map((item) => item.querySelector('.event-name a') || item.querySelector('.event-name'))
    .filter(Boolean)
    .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
  if (notCase) {
    if ((await read()).some((t) => same(t, name))) throw failure(this, `Expected the timeline not to list "${name}", but it does.`, 'The timeline lists the activities with a date ahead (due, closing) and something left to do.');
    return;
  }
  await eventually(this, read, (items) => items.some((t) => same(t, name)), (items) => ({
    message: `Expected the timeline to list "${name}", but it lists ${listed(items)}.`,
    hint: 'The timeline lists the activities with a date in its range ("Next 30 days") and something left to do; a submitted assignment leaves it.',
  }));
});

/**
 * Open a page and say what the site did with it: "allowed" (the page itself),
 * "login" (a visitor sent to the login form), "denied" (an error page, or a
 * redirect to another page), or "error" (an error page for another reason:
 * a page that does not exist).
 */
async function access(world, path) {
  const response = await world.page.goto(siteUrl(world, path), { waitUntil: 'load' }).catch(() => null);
  await pageReady(world);
  const asked = pathOf(siteUrl(world, path));
  const where = pathOf(world.page.url());
  const status = response ? response.status() : null;
  const errorbox = await world.page.locator('.errorbox').filter({ visible: true }).first().innerText({ timeout: 500 }).catch(() => '');
  const reason = clean(errorbox).replace(/\s*More information about this error.*$/i, '');
  let result;
  if (where === pathOf(loginPath(world)) || (await loginForm(world).isVisible().catch(() => false))) result = 'login';
  else if (reason && !/can't find data record|not found|invalid course module/i.test(reason)) result = 'denied';
  else if (reason) result = 'error';
  else if (where !== asked) result = 'denied';
  else if (status && status >= 400) result = 'error';
  else result = 'allowed';
  return { access: result, path: asked, status, where, reason };
}

/** What an outcome reads like in a failure message. */
function told(o) {
  switch (o.access) {
    case 'allowed': return `it opened the page (HTTP ${o.status})`;
    case 'login': return 'it sent the browser to the login form';
    case 'denied': return o.reason ? `it refused it with "${o.reason}" (HTTP ${o.status})` : `it turned the browser away to ${o.where}`;
    default: return o.reason ? `it answered with the error "${o.reason}" (HTTP ${o.status})` : `the page answered HTTP ${o.status}`;
  }
}

/**
 * Open a page and assert that the account in the browser may, or may not,
 * open it. Allowed: the browser stays on the page and it shows no error box.
 * Not allowed: the site shows its error box (for example "Access denied"),
 * sends the browser to another page, or sends a visitor to the login form.
 *
 * Example #1: Then I should have access to "/course/management.php"
 * Example #2: Then I should not have access to "/admin/search.php"
 * Example #3: And we should have access to "/user/index.php?id=2"
 * Example #4: Then I should not have access to "/course/management.php"
 * Example #5: But we should not have access to "/admin/search.php"
 */
Then(/^(I |we )*should( not)* have access to "([^"]*)"$/, async function (pronounCase, notCase, path) {
  const outcome = await access(this, path);
  if (notCase && outcome.access === 'allowed') {
    throw failure(this, `Expected no access to ${outcome.path}, but ${told(outcome)}.`, 'The site decides by the capabilities of the roles of the account: check its roles in the course and on the site.');
  }
  if (notCase && outcome.access === 'error') {
    throw failure(this, `Expected the site to refuse ${outcome.path}, but ${told(outcome)}: that is an error, not a refusal.`, 'Check the address: a refusal is the "Access denied" error box, a redirect away or the login form.');
  }
  if (!notCase && outcome.access !== 'allowed') {
    throw failure(this, `Expected access to ${outcome.path}, but ${told(outcome)}.`, 'Log in as an account whose roles let it open the page (I am a logged in user with the "..." user).');
  }
});

const ACCESS = { allowed: 'allowed', denied: 'denied', login: 'login', 'login form': 'login' };

/**
 * Assert who may open a page, row by row: an account of the users registry
 * (by its handle), or "visitor" for a browser that is signed in as nobody,
 * and what the site does with it: "allowed" (the page opens), "denied" (the
 * site refuses it, or turns the account away) or "login" (a visitor is sent
 * to the login form). Every row is checked, and the failure lists every row
 * that differs.
 *
 * Example #1: Then the access to "/course/management.php" should be:
 * Example #2: Then the access to "/admin/search.php" should be:
 * Example #3: And the access to "/my/" should be:
 * Example #4: Then the access to "/user/index.php?id=2" should be:
 * Example #5: And the access to "/course/management.php" should be:
 */
Then(/^the access to "([^"]*)" should be:$/, { timeout: 300000 }, async function (path, table) {
  const rows = table.hashes();
  if (!rows.length || !('account' in rows[0]) || !('access' in rows[0])) {
    throw friendly({ message: 'The table needs the columns "account" and "access", and a row per account.', hint: '| account | access |  then rows such as  | administrator | allowed |, | student | denied |, | visitor | login |.' });
  }
  const wrong = [];
  for (const row of rows) {
    const account = clean(row.account);
    const wanted = ACCESS[clean(row.access).toLowerCase()];
    if (!wanted) {
      throw friendly({ message: `"${row.access}" is not an access the table knows (row "${account}").`, hint: 'Use "allowed", "denied" or "login".' });
    }
    if (account === 'visitor') {
      await this.page.goto('about:blank').catch(() => {});
      await this.page.context().clearCookies();
    } else {
      await logInAs(this, account);
    }
    const outcome = await access(this, path);
    if (outcome.access !== wanted) wrong.push(`"${account}": expected ${wanted}, but ${told(outcome)}`);
  }
  await this.page.goto('about:blank').catch(() => {});
  await this.page.context().clearCookies();
  if (wrong.length) {
    throw failure(this, `The access to ${pathOf(siteUrl(this, path))} differs for ${wrong.length} of ${rows.length} rows: ${wrong.join('; ')}.`, 'The site decides by the capabilities of the roles of each account, on the site and in the course.');
  }
});
