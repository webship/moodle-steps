'use strict';

// The forum: a discussion topic posted (subject and message), a reply posted
// in place on the discussion page, the discussions a forum lists, the replies
// of a discussion, and a discussion deleted with its replies.
//
// What a scenario posts, it deletes: a student cannot delete a post once
// anybody replied to it, so the teacher deletes the discussion.

const { When, Then } = require('@cucumber/cucumber');
const {
  budget,
  clean,
  same,
  listed,
  failure,
  open,
  pageReady,
  afterAction,
  personClick,
  eventually,
  openActivity,
  readTable,
  columnIndex,
  typeIntoEditor,
} = require('./moodle-helpers');

/** Open a forum of the scenario's course by its name. */
async function openForum(world, name) {
  const activity = await openActivity(world, name);
  if (activity.type && activity.type !== 'forum') throw failure(world, `"${name}" is not a forum (it is a ${activity.type}).`, 'Name a forum of the course.');
  return activity;
}

/** The discussions a forum page lists, by subject, with their link. */
async function discussions(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('table.discussion-list tbody tr, [data-region="discussion-list-item"]')].map((tr) => {
    const link = tr.querySelector('a[href*="/mod/forum/discuss.php"]');
    return link ? { subject: link.textContent.replace(/\s+/g, ' ').trim(), href: link.href } : null;
  }).filter(Boolean)).catch(() => []);
}

/** Open a discussion of a forum of the scenario's course by its subject. */
async function openDiscussion(world, forum, subject) {
  await openForum(world, forum);
  const list = await discussions(world);
  const found = list.find((d) => same(d.subject, subject));
  if (!found) throw failure(world, `The forum "${forum}" lists no discussion "${subject}". It lists ${listed(list.map((d) => d.subject))}.`, 'Post it first (I post the discussion "..." with the message "..." in the forum "...").');
  await open(world, found.href);
}

/**
 * Post a new discussion topic in a forum of the scenario's course, the way a
 * person does: "Add discussion topic", the subject, the message typed into
 * its editor, then "Post to forum". The step waits for the forum to list it.
 *
 * Example #1: When I post the discussion "A question about flaky tests" with the message "Why does a test pass here and fail in CI?" in the forum "Class discussion"
 * Example #2: When we post the discussion "Read the handbook first" with the message "It answers most questions." in the forum "Class discussion"
 * Example #3: And I post the discussion "Study group" with the message "Who joins on Friday?" in the forum "Class discussion"
 * Example #4: Given I post the discussion "A question about flaky tests" with the message "Why?" in the forum "Class discussion"
 * Example #5: When we post the discussion "Welcome" with the message "Hello, everybody." in the forum "Announcements"
 */
When(/^(I |we )*post the discussion "([^"]*)" with the message "([^"]*)" in the forum "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, subject, message, forum) {
  await openForum(this, forum);
  const add = this.page.getByRole('link', { name: /^(Add discussion topic|Add a new topic|Add a new discussion topic)$/ }).or(this.page.getByRole('button', { name: /^(Add discussion topic|Add a new topic)$/ })).first();
  if (!(await add.count())) throw failure(this, `The forum "${forum}" offers no "Add discussion topic".`, 'An account posts a new topic in a forum where its role may start discussions (a news forum: teachers only).');
  await afterAction(this, () => personClick(add));
  const subjectField = this.page.getByRole('textbox', { name: 'Subject' }).filter({ visible: true }).first();
  await subjectField.waitFor({ state: 'visible', timeout: budget(this) });
  await subjectField.fill(subject);
  await typeIntoEditor(this, 'Message', message);
  await afterAction(this, () => personClick(this.page.getByRole('button', { name: 'Post to forum' }).filter({ visible: true }).first()));
  await eventually(this, () => discussions(this), (list) => list.some((d) => same(d.subject, subject)), (list) => ({
    message: `After "Post to forum", the forum "${forum}" does not list "${subject}". It lists ${listed(list.map((d) => d.subject))}.`,
    hint: 'Look at the screenshot for the error the form showed.',
  }));
});

/** The posts of the discussion page: subject, author, text, and their depth. */
async function posts(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('[data-region="post"]')].map((p) => {
    const article = p.closest('article') || p;
    const own = (sel) => [...p.querySelectorAll(sel)].find((el) => el.closest('[data-region="post"]') === p);
    const content = own('[data-region-content="forum-post-core-content"], .post-content-container');
    const subject = own('h3, h4, .subject, [data-region-content="forum-post-core-subject"]');
    const author = own('a[href*="/user/view.php"]');
    return {
      subject: subject ? subject.textContent.replace(/\s+/g, ' ').trim() : '',
      author: author ? author.textContent.replace(/\s+/g, ' ').trim() : '',
      text: content ? content.textContent.replace(/\s+/g, ' ').trim() : '',
      reply: !!p.parentElement.closest('[data-region="post"]'),
      id: article.id || p.getAttribute('data-post-id') || '',
    };
  })).catch(() => []);
}

/**
 * Reply to a discussion of a forum of the scenario's course, the way a person
 * does: the discussion page, "Reply" on its first post, the reply typed in
 * place, then "Post to forum". The step waits for the discussion to show it.
 *
 * Example #1: When I reply "Wait on the page, not on the clock." to the discussion "A question about flaky tests" in the forum "Class discussion"
 * Example #2: When we reply "Thank you." to the discussion "Read the handbook first" in the forum "Class discussion"
 * Example #3: And I reply "I join." to the discussion "Study group" in the forum "Class discussion"
 * Example #4: Given I reply "Same here." to the discussion "A question about flaky tests" in the forum "Class discussion"
 * Example #5: When we reply "Good point." to the discussion "Study group" in the forum "Class discussion"
 */
When(/^(I |we )*reply "([^"]*)" to the discussion "([^"]*)" in the forum "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, text, subject, forum) {
  await openDiscussion(this, forum, subject);
  const actions = this.page.locator('[data-region="post-actions-container"]').first();
  const reply = actions.getByRole('menuitem', { name: 'Reply' });
  if (!(await reply.count())) throw failure(this, `The discussion "${subject}" offers no "Reply".`, 'An account replies in a forum where its role may reply to posts (a news forum: teachers only).');
  await afterAction(this, () => personClick(reply));
  const box = this.page.getByRole('textbox', { name: 'Message' }).filter({ visible: true }).first();
  await box.waitFor({ state: 'visible', timeout: budget(this) });
  await box.fill(text);
  await afterAction(this, () => personClick(this.page.getByRole('button', { name: 'Post to forum' }).filter({ visible: true }).first()));
  await eventually(this, () => posts(this), (all) => all.some((p) => p.reply && clean(p.text).includes(clean(text))), (all) => ({
    message: `After "Post to forum", the discussion "${subject}" shows no reply "${text}". Its posts: ${listed(all.map((p) => p.text))}.`,
    hint: 'Look at the screenshot for the error the reply showed.',
  }));
});

/**
 * Assert that a forum of the scenario's course lists, or does not list, a
 * discussion by its subject.
 *
 * Example #1: Then the forum "Class discussion" should list the discussion "A question about flaky tests"
 * Example #2: Then the forum "Class discussion" should not list the discussion "A question about flaky tests"
 * Example #3: And the forum "Class discussion" should list the discussion "Study group"
 * Example #4: Then the forum "Announcements" should not list the discussion "Study group"
 * Example #5: But the forum "Class discussion" should not list the discussion "Study group"
 */
Then(/^the forum "([^"]*)" should( not)* list the discussion "([^"]*)"$/, async function (forum, notCase, subject) {
  await openForum(this, forum);
  const list = await discussions(this);
  const has = list.some((d) => same(d.subject, subject));
  if (notCase && has) throw failure(this, `Expected the forum "${forum}" not to list "${subject}", but it does.`, 'Delete the discussion first (I delete the discussion "..." from the forum "...").');
  if (!notCase && !has) throw failure(this, `Expected the forum "${forum}" to list "${subject}", but it lists ${listed(list.map((d) => d.subject))}.`, 'The forum lists its discussions by subject; an account sees those of its groups.');
});

/**
 * Assert that a discussion of a forum of the scenario's course has, or does
 * not have, a reply holding a text, from the account the step names (a
 * handle of the users registry, or a full name) when it names one.
 *
 * Example #1: Then the discussion "A question about flaky tests" in the forum "Class discussion" should have the reply "Wait on the page, not on the clock."
 * Example #2: Then the discussion "A question about flaky tests" in the forum "Class discussion" should not have the reply "Wait on the clock."
 * Example #3: And the discussion "Study group" in the forum "Class discussion" should have the reply "I join." from "student"
 * Example #4: Then the discussion "A question about flaky tests" in the forum "Class discussion" should have the reply "Wait on the page, not on the clock." from "teacher"
 * Example #5: But the discussion "Study group" in the forum "Class discussion" should not have the reply "I join." from "teacher"
 */
Then(/^the discussion "([^"]*)" in the forum "([^"]*)" should( not)* have the reply "([^"]*)"(?: from "([^"]*)")?$/, async function (subject, forum, notCase, text, who) {
  await openDiscussion(this, forum, subject);
  const users = (this.parameters && this.parameters.users) || {};
  const author = who ? ((users[who] && users[who].name) || who) : null;
  const all = await posts(this);
  const matches = all.filter((p) => p.reply && clean(p.text).includes(clean(text)) && (!author || same(p.author, author)));
  if (notCase && matches.length) throw failure(this, `Expected the discussion "${subject}" not to have the reply "${text}"${author ? ` from ${author}` : ''}, but it has.`, 'A reply stays until it or its discussion is deleted.');
  if (!notCase && !matches.length) {
    throw failure(this, `Expected the discussion "${subject}" to have the reply "${text}"${author ? ` from ${author}` : ''}, but its replies are ${listed(all.filter((p) => p.reply).map((p) => `${p.author}: ${p.text}`))}.`, author && !users[who] ? 'Name the author by a handle of the users registry with its name, or by the full name the post shows.' : 'A reply is matched by a part of its text and, when the step names one, its author.');
  }
});

/**
 * Delete a discussion of a forum of the scenario's course with its replies,
 * the way a teacher does: the discussion page, "Delete" on its first post,
 * then "Continue". The step fails with the site's own words when it refuses
 * (a student cannot delete a post once anybody replied to it).
 *
 * Example #1: When I delete the discussion "A question about flaky tests" from the forum "Class discussion"
 * Example #2: When we delete the discussion "Study group" from the forum "Class discussion"
 * Example #3: And I delete the discussion "Read the handbook first" from the forum "Class discussion"
 * Example #4: Then I delete the discussion "A question about flaky tests" from the forum "Class discussion"
 * Example #5: Given we delete the discussion "Welcome" from the forum "Announcements"
 */
When(/^(I |we )*delete the discussion "([^"]*)" from the forum "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, subject, forum) {
  await openDiscussion(this, forum, subject);
  const actions = this.page.locator('[data-region="post-actions-container"]').first();
  const del = actions.getByRole('menuitem', { name: 'Delete' });
  if (!(await del.count())) throw failure(this, `The discussion "${subject}" offers no "Delete" to this account.`, 'A teacher deletes any post; a student deletes its own post within the editing time and before anybody replied.');
  await afterAction(this, () => personClick(del));
  const refusal = await this.page.locator('.alert-danger, .errorbox').filter({ visible: true }).allInnerTexts().catch(() => []);
  const cont = this.page.locator('#region-main').getByRole('button', { name: 'Continue' });
  if (!(await cont.count())) {
    throw failure(this, `The site did not ask to confirm the deletion of "${subject}": ${listed(refusal.map(clean).map((t) => t.replace(/\s*Dismiss this notification.*$/i, '')))}.`, 'A student cannot delete a post once anybody replied to it; a teacher can.');
  }
  await afterAction(this, () => personClick(cont));
  await eventually(this, () => discussions(this), (list) => !list.some((d) => same(d.subject, subject)), () => ({
    message: `After "Continue", the forum "${forum}" still lists "${subject}".`,
    hint: 'Look at the screenshot for what the site said.',
  }));
});
