'use strict';

// Messages, notifications and the calendar of the account in the browser: a
// message sent to another account through the messaging drawer, a
// conversation read and deleted, the notifications of the bell menu, and an
// event added to and deleted from the calendar, the upcoming events.
//
// What a scenario adds, it deletes: the events it adds, the conversations it
// starts (each account deletes its own copy).

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
  accountKeys,
} = require('./moodle-helpers');

// ---------------------------------------------------------------------------
// The messaging drawer
// ---------------------------------------------------------------------------

/**
 * Open the messaging drawer of the page on its overview (the drawer stays
 * open from page to page once opened, on the view it was left on: a page of
 * its own resets it to the overview).
 */
async function openDrawer(world) {
  await open(world, '/my/');
  if (!(await world.page.locator('#user-menu-toggle').count())) throw failure(world, 'Nobody is logged in: the page has no messaging button.', 'Messaging is for a signed-in account.');
  const drawer = world.page.locator('[data-region="message-drawer"]').first();
  if (!(await drawer.isVisible().catch(() => false))) {
    const toggle = world.page.getByRole('button', { name: /Toggle messaging drawer/ }).first();
    if (!(await toggle.count())) throw failure(world, 'The page has no messaging button.', 'Messaging is for a signed-in account, on a site with messaging on.');
    await personClick(toggle);
  }
  await drawer.waitFor({ state: 'visible', timeout: budget(world) });
  await pageReady(world);
  // Back to the overview when the drawer was left on a conversation or a search.
  for (let i = 0; i < 3; i += 1) {
    const back = drawer.locator('[data-route-back]').filter({ visible: true }).first();
    if (!(await back.count())) break;
    await back.click();
    await pageReady(world);
  }
  return drawer;
}

/** The name an account goes by in the drawer: the full name of the registry, else the text itself. */
function personName(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  return (users[who] && (users[who].name || users[who].username)) || who;
}

/** Open the conversation with a person from the drawer: the search of the drawer, then the person. */
async function openConversation(world, who) {
  const drawer = await openDrawer(world);
  const name = personName(world, who);
  const search = drawer.getByRole('textbox', { name: 'Search' }).filter({ visible: true }).first();
  await search.click();
  await pageReady(world);
  const field = drawer.getByRole('textbox', { name: 'Search' }).filter({ visible: true }).first();
  await field.fill(name);
  await drawer.getByRole('button', { name: 'Perform search' }).click();
  await pageReady(world);
  const result = drawer.locator('a[data-route="view-conversation"]').filter({ visible: true }).filter({ hasText: name }).first();
  try {
    await result.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    const found = await drawer.locator('a[data-route="view-conversation"]').filter({ visible: true }).allInnerTexts().catch(() => []);
    throw failure(world, `The messaging search finds nobody called "${name}". It finds ${listed(found)}.`, 'An account can message the people of its courses (and its contacts); name the person by the full name the site shows.');
  }
  await result.click();
  await pageReady(world);
  return drawer;
}

/**
 * The link of the conversation with a person in the overview of the drawer.
 * The overview keeps its parts ("Starred", "Group", "Private") folded or open
 * as the account left them: a folded part with conversations is opened, the
 * way a person looks for one.
 */
async function findConversation(world, drawer, name) {
  const link = () => drawer.locator('a[data-conversation-id]').filter({ visible: true }).filter({ hasText: name }).first();
  if (await link().count()) return link();
  const folded = drawer.locator('[data-bs-toggle="collapse"][aria-expanded="false"], [data-toggle="collapse"][aria-expanded="false"]').filter({ visible: true });
  const n = await folded.count();
  for (let i = n - 1; i >= 0; i -= 1) {
    const toggle = folded.nth(i);
    const text = clean(await toggle.innerText().catch(() => ''));
    if (/\(0\)/.test(text)) continue;
    await toggle.click();
    await pageReady(world);
    if (await link().count()) return link();
  }
  return null;
}

/** The names of the conversations the overview of the drawer lists. */
async function conversationNames(drawer) {
  return drawer.locator('a[data-conversation-id]').filter({ visible: true }).allInnerTexts().then((t) => t.map((x) => clean(x.split('\n')[0]))).catch(() => []);
}

/**
 * Send a message to an account of the users registry (or a person named by
 * full name), the way a person does: the messaging drawer, its search, the
 * person, the message typed in "Write a message...", then "Send message". The
 * step waits until the conversation shows the message as sent.
 *
 * Example #1: When I send the message "Hello, when is the next quiz?" to "teacher"
 * Example #2: When we send the message "The quiz opens on Monday." to "student"
 * Example #3: And I send the message "Thank you." to "teacher"
 * Example #4: Given I send the message "Hello, when is the next quiz?" to "teacher"
 * Example #5: When we send the message "See you in class." to "student"
 */
When(/^(I |we )*send the message "([^"]*)" to "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, text, who) {
  const drawer = await openConversation(this, who);
  const box = drawer.getByRole('textbox', { name: 'Write a message...' }).or(drawer.getByPlaceholder('Write a message...')).filter({ visible: true }).first();
  await box.fill(text);
  await drawer.getByRole('button', { name: 'Send message' }).click();
  await pageReady(this);
  await eventually(this, () => drawer.locator('[data-region="message"].send [data-region="text-container"]').allInnerTexts().catch(() => []), (texts) => texts.some((t) => same(t, text)), (texts) => ({
    message: `The conversation with ${personName(this, who)} shows no sent message "${text}". Its sent messages: ${listed(texts)}.`,
    hint: 'A person can refuse messages from non-contacts in their preferences; look at the drawer on the screenshot.',
  }));
});

/**
 * Assert that the account in the browser has, or does not have, a message
 * holding a text from an account of the users registry (or a person named by
 * full name): the conversation with that person in the messaging drawer.
 *
 * Example #1: Then I should have the message "Hello, when is the next quiz?" from "student"
 * Example #2: Then I should not have the message "Hello, when is the next quiz?" from "student"
 * Example #3: And we should have the message "The quiz opens on Monday." from "teacher"
 * Example #4: Then I should have the message "Thank you." from "student"
 * Example #5: But we should not have the message "See you in class." from "teacher"
 */
Then(/^(I |we )*should( not)* have the message "([^"]*)" from "([^"]*)"$/, async function (pronounCase, notCase, text, who) {
  const drawer = await openDrawer(this);
  const name = personName(this, who);
  const conversation = await findConversation(this, drawer, name);
  if (!conversation) {
    if (notCase) return;
    throw failure(this, `Expected a conversation with ${name}, but the messaging drawer lists ${listed(await conversationNames(drawer))}.`, 'A conversation is in the "Private" part of the drawer (a group one in "Group"); a deleted conversation is gone for the account that deleted it.');
  }
  await conversation.click();
  await pageReady(this);
  const received = await drawer.locator('[data-region="message"]:not(.send) [data-region="text-container"]').allInnerTexts().catch(() => []);
  const has = received.some((t) => same(t, text));
  if (notCase && has) throw failure(this, `Expected no message "${text}" from ${name}, but the conversation shows it.`, 'Delete the conversation first (I delete my conversation with "...").');
  if (!notCase && !has) throw failure(this, `Expected the message "${text}" from ${name}, but the conversation shows ${listed(received)}.`, 'The conversation shows the messages of the other person on the left.');
});

/**
 * Delete the conversation of the account in the browser with an account of
 * the users registry (or a person named by full name): the conversation in the
 * messaging drawer, its menu, "Delete conversation", then "Delete". The other
 * person keeps their copy.
 *
 * Example #1: When I delete my conversation with "teacher"
 * Example #2: And I delete my conversation with "student"
 * Example #3: Then I delete my conversation with "teacher"
 * Example #4: Given I delete my conversation with "student"
 * Example #5: But I delete my conversation with "teacher"
 */
When(/^I delete my conversation with "([^"]*)"$/, { timeout: 120000 }, async function (who) {
  const drawer = await openDrawer(this);
  const name = personName(this, who);
  const conversation = await findConversation(this, drawer, name);
  if (!conversation) throw failure(this, `The messaging drawer lists no conversation with ${name}. It lists ${listed(await conversationNames(drawer))}.`, 'There is nothing to delete; a deleted conversation is gone for the account that deleted it.');
  await conversation.click();
  await pageReady(this);
  const menu = drawer.locator('[data-region="header-container"] [data-bs-toggle="dropdown"], [data-region="header-container"] .dropdown-toggle').filter({ visible: true }).first();
  await personClick(menu);
  await drawer.locator('[data-action="request-delete-conversation"]').filter({ visible: true }).first().click();
  const confirm = drawer.getByRole('alert').filter({ hasText: /delete this entire conversation/i });
  await confirm.waitFor({ state: 'visible', timeout: budget(this) });
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await pageReady(this);
  const again = await openDrawer(this);
  await eventually(this, async () => ((await findConversation(this, again, name)) ? 1 : 0), (n) => n === 0, () => ({
    message: `The messaging drawer still lists the conversation with ${name} after "Delete".`,
    hint: 'Look at the drawer on the screenshot.',
  }));
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** The notifications of the bell menu: their text and whether they are unread. */
async function notifications(world) {
  if (!(await world.page.locator('#nav-notification-popover-container').count())) await open(world, '/my/');
  const region = world.page.locator('#nav-notification-popover-container');
  if (!(await region.count())) throw failure(world, 'The page has no notifications menu.', 'The bell menu is for a signed-in account.');
  const container = region.locator('[data-region="popover-region-container"]');
  if ((await container.getAttribute('aria-hidden')) !== 'false') await personClick(region.locator('[data-region="popover-region-toggle"]'));
  await pageReady(world);
  await region.locator('[data-region="all-notifications"]').waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
  return region.evaluate((r) => [...r.querySelectorAll('[data-region="notification-content-item-container"]')].map((item) => ({
    text: ((item.querySelector('.notification-message') || item).textContent || '').replace(/\s+/g, ' ').trim(),
    unread: item.classList.contains('unread'),
  })));
}

/**
 * Assert that the notifications menu (the bell) of the account in the
 * browser holds, or does not hold, a notification starting with a text;
 * "new" asks for an unread one.
 *
 * Example #1: Then I should have the notification "Welcome to Software Testing 101"
 * Example #2: Then I should have the new notification "Assignment submission confirmation - Testing diary"
 * Example #3: And I should not have the notification "Teacher User has given feedback for assignment Testing diary"
 * Example #4: Then we should have the notification "Welcome to Software Testing 101"
 * Example #5: But we should not have the new notification "Welcome to Software Testing 101"
 */
Then(/^(I |we )*should( not)* have the( new)* notification "([^"]*)"$/, async function (pronounCase, notCase, newCase, text) {
  const matches = (n) => clean(n.text).toLowerCase().startsWith(clean(text).toLowerCase()) && (!newCase || n.unread);
  if (notCase) {
    const all = await notifications(this);
    if (all.some(matches)) throw failure(this, `Expected no ${newCase ? 'new ' : ''}notification "${text}", but the notifications menu holds it.`, 'Opening a notification marks it as read; "Mark all as read" marks them all.');
    return;
  }
  await eventually(this, () => notifications(this), (all) => all.some(matches), (all) => ({
    message: `Expected the ${newCase ? 'new ' : ''}notification "${text}", but the notifications menu holds ${listed(all.map((n) => `${n.text}${n.unread ? ' (new)' : ''}`))}.`,
    hint: 'Most notifications arrive at once; some are sent by cron (the scheduled tasks), a minute later.',
  }), budget(this) * 3);
});

/**
 * Mark every notification of the account in the browser as read, the way a
 * person does: the notifications menu (the bell), then its "Mark all as read"
 * button. A scenario that checks for a new notification marks them read
 * afterwards, so the next run checks a new one again.
 *
 * Example #1: When I mark all my notifications as read
 * Example #2: And I mark all my notifications as read
 * Example #3: Then I mark all my notifications as read
 * Example #4: Given I mark all my notifications as read
 * Example #5: But I mark all my notifications as read
 */
When(/^I mark all my notifications as read$/, async function () {
  await notifications(this);
  const region = this.page.locator('#nav-notification-popover-container');
  const button = region.locator('[data-action="mark-all-read"]').first();
  if (!(await button.count())) throw failure(this, 'The notifications menu has no "Mark all as read" button.', 'The button is in the header of the notifications menu.');
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await pageReady(this);
  }
  await eventually(this, () => notifications(this), (all) => !all.some((n) => n.unread), (all) => ({
    message: `After "Mark all as read", the notifications menu still holds new ones: ${listed(all.filter((n) => n.unread).map((n) => n.text))}.`,
    hint: 'Look at the notifications menu on the screenshot.',
  }));
});

// ---------------------------------------------------------------------------
// The calendar
// ---------------------------------------------------------------------------

/** The events of the month view of the calendar on screen. */
async function monthEvents(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('[data-region="calendar"] [data-action="view-event"], .calendarmonth [data-action="view-event"]')]
    .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
}

/**
 * Add an event to the calendar of the account in the browser, the way a
 * person does: the month view of the calendar, "New event", the title (the
 * date stays today), then "Save". The step waits for the month to show it.
 *
 * Example #1: When I add the event "Study group" to my calendar
 * Example #2: And I add the event "Revision session" to my calendar
 * Example #3: Given I add the event "Study group" to my calendar
 * Example #4: Then I add the event "Office hours" to my calendar
 * Example #5: But I add the event "Study group" to my calendar
 */
When(/^I add the event "([^"]*)" to my calendar$/, { timeout: 120000 }, async function (title) {
  await open(this, '/calendar/view.php?view=month');
  const button = this.page.getByRole('button', { name: 'New event' }).filter({ visible: true }).first();
  if (!(await button.count())) throw failure(this, 'The calendar has no "New event" button.', 'An account adds events to its own calendar when it may (any signed-in account, by default).');
  await afterAction(this, () => personClick(button));
  const dialog = this.page.getByRole('dialog', { name: 'New event' });
  await dialog.waitFor({ state: 'visible', timeout: budget(this) });
  await dialog.getByRole('textbox', { name: 'Event title' }).fill(title);
  await afterAction(this, () => dialog.getByRole('button', { name: 'Save' }).click());
  await eventually(this, () => monthEvents(this), (events) => events.some((e) => same(e, title)), (events) => ({
    message: `After "Save", the calendar does not show "${title}". It shows ${listed(events)}.`,
    hint: 'Look at the dialog on the screenshot: it shows what it refused under the field.',
  }));
});

/**
 * Assert that the month view of the calendar of the account in the browser
 * shows, or does not show, an event by its title ("Testing diary is due" for
 * the due date of an assignment).
 *
 * Example #1: Then my calendar should show the event "Study group"
 * Example #2: Then my calendar should not show the event "Study group"
 * Example #3: And my calendar should show the event "Office hours"
 * Example #4: But my calendar should not show the event "Revision session"
 * Example #5: Then my calendar should show the event "Study group"
 */
Then(/^my calendar should( not)* show the event "([^"]*)"$/, async function (notCase, title) {
  await open(this, '/calendar/view.php?view=month');
  const events = await monthEvents(this);
  const has = events.some((e) => same(e, title));
  if (notCase && has) throw failure(this, `Expected the calendar not to show "${title}", but this month shows it.`, 'Delete the event first (I delete the event "..." from my calendar).');
  if (!notCase && !has) throw failure(this, `Expected the calendar to show "${title}", but this month shows ${listed(events)}.`, 'The month view shows the events of this month; an event of another month is in its own month.');
});

/**
 * Delete an event of the calendar of the account in the browser, the way a
 * person does: the event in the month view, "Delete" in its summary, then
 * "Delete event" to confirm.
 *
 * Example #1: When I delete the event "Study group" from my calendar
 * Example #2: And I delete the event "Revision session" from my calendar
 * Example #3: Then I delete the event "Study group" from my calendar
 * Example #4: Given I delete the event "Office hours" from my calendar
 * Example #5: But I delete the event "Study group" from my calendar
 */
When(/^I delete the event "([^"]*)" from my calendar$/, { timeout: 120000 }, async function (title) {
  await open(this, '/calendar/view.php?view=month');
  const event = this.page.locator('[data-action="view-event"]').filter({ hasText: title }).first();
  if (!(await event.count())) throw failure(this, `The calendar shows no event "${title}" this month. It shows ${listed(await monthEvents(this))}.`, 'The step deletes an event of this month.');
  await afterAction(this, () => personClick(event));
  const summary = this.page.getByRole('dialog', { name: title });
  await summary.waitFor({ state: 'visible', timeout: budget(this) });
  const del = summary.getByRole('button', { name: 'Delete' });
  if (!(await del.count())) throw failure(this, `The event "${title}" offers no "Delete" to this account.`, 'An account deletes its own events; a course event needs the right to manage the course\'s events.');
  await afterAction(this, () => del.click());
  const confirm = this.page.getByRole('dialog', { name: 'Delete event' });
  await confirm.waitFor({ state: 'visible', timeout: budget(this) });
  await afterAction(this, () => confirm.getByRole('button', { name: /^Delete( event)?$/ }).click());
  await eventually(this, () => monthEvents(this), (events) => !events.some((e) => same(e, title)), () => ({
    message: `After "Delete event", the calendar still shows "${title}".`,
    hint: 'Look at the screenshot for what the site said.',
  }));
});

/**
 * Assert that the upcoming events of the calendar of the account in the
 * browser list, or do not list, an event by its title (whatever month it
 * falls in).
 *
 * Example #1: Then the upcoming events should list "Testing diary is due"
 * Example #2: Then the upcoming events should not list "Study group"
 * Example #3: And the upcoming events should list "Testing diary is due"
 * Example #4: But the upcoming events should not list "Testing diary is due"
 * Example #5: Then the upcoming events should list "Office hours"
 */
Then(/^the upcoming events should( not)* list "([^"]*)"$/, async function (notCase, title) {
  await open(this, '/calendar/view.php?view=upcoming');
  const events = await this.page.evaluate(() => [...document.querySelectorAll('#region-main [data-type="event"] h3, #region-main .event .name, #region-main [data-type="event"] .name')]
    .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
  const has = events.some((e) => same(e, title));
  if (notCase && has) throw failure(this, `Expected the upcoming events not to list "${title}", but they do.`, 'An event leaves the upcoming events once it is deleted or past.');
  if (!notCase && !has) throw failure(this, `Expected the upcoming events to list "${title}", but they list ${listed(events)}.`, 'The upcoming events are those of the coming days (the site\'s "Upcoming events look-ahead", 3 weeks by default).');
});
