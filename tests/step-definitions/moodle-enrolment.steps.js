'use strict';

// Enrolment and roles: the participants of the scenario's course, an account
// enrolled and unenrolled by the teacher (the "Enrol users" dialog of the
// participants page), the roles of a participant (given and taken back in the
// participants table), and self enrolment with an enrolment key (and leaving
// the course again).
//
// Accounts are never created here: the steps enrol the accounts of the users
// registry, which the build of the site created.

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
  openCourse,
  currentCourse,
  openCurrentCourse,
  readTable,
  columnIndex,
  rowFor,
} = require('./moodle-helpers');

/** Open the participants page of the scenario's course. */
async function openParticipants(world) {
  const course = currentCourse(world);
  await open(world, `/user/index.php?id=${course.id}&perpage=5000`);
  if (!(await world.page.locator('table#participants').count())) {
    throw failure(world, `The participants page of "${course.name}" shows no participants table (${world.page.url()}).`, 'The participants page is for an account that may view the participants of the course (a teacher, a manager).');
  }
  return course;
}

/** The participants table: its headings and rows. */
async function participants(world) {
  return (await readTable(world, 'table#participants')) || { head: [], rows: [] };
}

/** The row of the participants table that names an account, or null. */
async function participantRow(world, who) {
  const { keys } = accountKeys(world, who);
  const table = await participants(world);
  return { table, row: rowFor(table.rows, keys), keys };
}

/** A locator for the row of the participants table that names an account. */
function participantLocator(world, keys) {
  const rows = world.page.locator('table#participants tbody tr');
  return rows.filter({ has: world.page.locator('th, td').filter({ hasText: new RegExp(`^\\s*(?:\\S{1,3})?(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*$`, 'i') }) }).first();
}

/**
 * Enrol an account of the users registry in the scenario's course with a
 * role, the way a teacher does: the "Enrol users" button of the participants
 * page, the account searched for in "Select users" (by its address), the role
 * chosen in "Assign role", and "Enrol users". The step waits until the
 * participants table lists the account.
 *
 * Example #1: When I enrol "student2" in the course as "Student"
 * Example #2: When we enrol "student2" in the course as "Non-editing teacher"
 * Example #3: And I enrol "student2" in the course as "Student"
 * Example #4: Given I enrol "student2" in the course as "Student"
 * Example #5: When we enrol "student2" in the course as "Student"
 */
When(/^(I |we )*enrol "([^"]*)" in the course as "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, who, role) {
  await openParticipants(this);
  const { keys, user } = accountKeys(this, who);
  const search = (user && (user.email || user.username)) || who;
  const button = this.page.locator('input[type="submit"][value="Enrol users"], button:text-is("Enrol users")').filter({ visible: true }).first();
  if (!(await button.count())) throw failure(this, 'The participants page has no "Enrol users" button.', 'Only an account that may enrol users in the course (a teacher, a manager) has it.');
  await afterAction(this, () => personClick(button));
  const dialog = this.page.getByRole('dialog', { name: 'Enrol users' });
  await dialog.waitFor({ state: 'visible', timeout: budget(this) });
  const input = dialog.getByRole('combobox', { name: 'Select users' });
  await input.fill(search);
  await pageReady(this);
  const suggestion = dialog.locator('ul.form-autocomplete-suggestions li').filter({ visible: true }).filter({ hasText: search }).first();
  try {
    await suggestion.waitFor({ state: 'visible', timeout: budget(this) });
  } catch {
    const offered = await dialog.locator('ul.form-autocomplete-suggestions li').allInnerTexts().catch(() => []);
    throw failure(this, `"Select users" offers no account for "${search}". It offers ${listed(offered)}.`, 'The search finds accounts that are not enrolled yet, by name or address. An account already enrolled is not offered.');
  }
  await suggestion.click();
  await pageReady(this);
  const select = dialog.getByLabel('Assign role');
  const roles = await select.locator('option').allInnerTexts();
  const option = roles.find((r) => same(r, role));
  if (!option) throw failure(this, `"Assign role" has no role "${role}". It offers ${listed(roles)}.`, 'The roles offered are the ones the account may assign in the course.');
  await select.selectOption({ label: option });
  await afterAction(this, () => dialog.getByRole('button', { name: 'Enrol users' }).click());
  await eventually(this, () => participants(this), (t) => !!rowFor(t.rows, keys), (t) => ({
    message: `After "Enrol users", the participants table does not list "${who}". It lists ${listed(t.rows.map((r) => r[1]))}.`,
    hint: 'Look for an error toast on the screenshot.',
  }));
});

/**
 * Unenrol a participant from the scenario's course, the way a teacher does:
 * the "Unenrol" icon of the participant's row, then "Unenrol" in the dialog
 * that asks to confirm. The step waits until the table no longer lists the
 * account.
 *
 * Example #1: When I unenrol "student2" from the course
 * Example #2: When we unenrol "student2" from the course
 * Example #3: And I unenrol "student2" from the course
 * Example #4: Then I unenrol "student2" from the course
 * Example #5: Given we unenrol "student2" from the course
 */
When(/^(I |we )*unenrol "([^"]*)" from the course$/, { timeout: 120000 }, async function (pronounCase, who) {
  await openParticipants(this);
  const { keys } = accountKeys(this, who);
  const row = participantLocator(this, keys);
  if (!(await row.count())) {
    const t = await participants(this);
    throw failure(this, `The participants table does not list "${who}". It lists ${listed(t.rows.map((r) => r[1]))}.`, 'Only an enrolled account can be unenrolled.');
  }
  const icon = row.locator('a[data-action="unenrol"]').first();
  if (!(await icon.count())) throw failure(this, `The row of "${who}" has no "Unenrol" icon.`, 'The icon shows for an account that may unenrol users from the course, on each enrolment it may remove.');
  await afterAction(this, () => personClick(icon));
  const dialog = this.page.getByRole('dialog', { name: 'Unenrol' });
  await dialog.waitFor({ state: 'visible', timeout: budget(this) });
  await afterAction(this, () => dialog.getByRole('button', { name: 'Unenrol' }).click());
  await eventually(this, () => participants(this), (t) => !rowFor(t.rows, keys), () => ({
    message: `After "Unenrol", the participants table still lists "${who}".`,
    hint: 'Look for an error toast on the screenshot.',
  }));
});

/**
 * Assert that an account of the users registry is, or is not, a participant
 * of the scenario's course: the participants page lists it (by its full name
 * or its address).
 *
 * Example #1: Then "student" should be enrolled in the course
 * Example #2: Then "student2" should not be enrolled in the course
 * Example #3: And "teacher" should be enrolled in the course
 * Example #4: Then "student2" should be enrolled in the course
 * Example #5: But "manager" should not be enrolled in the course
 */
Then(/^"([^"]*)" should( not)* be enrolled in the course$/, async function (who, notCase) {
  await openParticipants(this);
  const { row, table } = await participantRow(this, who);
  if (notCase && row) throw failure(this, `Expected "${who}" not to be enrolled in "${currentCourse(this).name}", but the participants table lists it.`, 'Unenrol it first, or check that no other enrolment method (self enrolment) holds it.');
  if (!notCase && !row) {
    throw failure(this, `Expected "${who}" to be enrolled in "${currentCourse(this).name}", but the participants table lists ${listed(table.rows.map((r) => r[1]))}.`, 'The participants table lists every enrolled account, whatever its enrolment method.');
  }
});

/** The roles of a participant, as the "Roles" column of its row lists them. */
async function rolesOf(world, who) {
  const { row, table } = await participantRow(world, who);
  if (!row) {
    throw failure(world, `The participants table does not list "${who}". It lists ${listed(table.rows.map((r) => r[1]))}.`, 'Enrol the account first.');
  }
  const i = columnIndex(table.head, 'Roles');
  return clean(row[i] || '').split(/\s*,\s*/).filter((r) => r && !/^no roles$/i.test(r));
}

/**
 * Assert that a participant of the scenario's course has, or does not have, a
 * role there, as the "Roles" column of the participants page lists it.
 *
 * Example #1: Then "student" should have the role "Student" in the course
 * Example #2: Then "student" should not have the role "Non-editing teacher" in the course
 * Example #3: And "teacher" should have the role "Teacher" in the course
 * Example #4: Then "student" should have the role "Non-editing teacher" in the course
 * Example #5: But "teacher" should not have the role "Student" in the course
 */
Then(/^"([^"]*)" should( not)* have the role "([^"]*)" in the course$/, async function (who, notCase, role) {
  await openParticipants(this);
  const roles = await rolesOf(this, who);
  const has = roles.some((r) => same(r, role));
  if (notCase && has) throw failure(this, `Expected "${who}" not to have the role "${role}", but its roles are ${listed(roles)}.`, 'Take the role away first (I remove the role "..." from "..." in the course).');
  if (!notCase && !has) throw failure(this, `Expected "${who}" to have the role "${role}", but its roles are ${listed(roles)}.`, 'A role is given in the participants table (I assign the role "..." to "..." in the course).');
});

/** Open the role editor of a participant's row: its "role assignments" link. */
async function editRoles(world, who) {
  await openParticipants(world);
  const { keys } = accountKeys(world, who);
  const row = participantLocator(world, keys);
  if (!(await row.count())) {
    const t = await participants(world);
    throw failure(world, `The participants table does not list "${who}". It lists ${listed(t.rows.map((r) => r[1]))}.`, 'Enrol the account first.');
  }
  const cell = row.locator('[data-itemtype="user_roles"]').first();
  const link = cell.locator('a[data-inplaceeditablelink]').first();
  if (!(await link.count())) throw failure(world, `The roles of "${who}" cannot be changed here: the "Roles" column has no edit link.`, 'Only an account that may assign roles in the course (a teacher, a manager) can change them.');
  await afterAction(world, () => personClick(link));
  return cell;
}

/**
 * Give a participant of the scenario's course a role there, the way a teacher
 * does: the pencil of the "Roles" column of its row, the role chosen in the
 * list, then "Save changes".
 *
 * Example #1: When I assign the role "Non-editing teacher" to "student" in the course
 * Example #2: When we assign the role "Non-editing teacher" to "student" in the course
 * Example #3: And I assign the role "Student" to "student2" in the course
 * Example #4: Given I assign the role "Non-editing teacher" to "student" in the course
 * Example #5: When we assign the role "Student" to "student" in the course
 */
When(/^(I |we )*assign the role "([^"]*)" to "([^"]*)" in the course$/, { timeout: 120000 }, async function (pronounCase, role, who) {
  const cell = await editRoles(this, who);
  const selected = await cell.locator('.form-autocomplete-selection [role="option"]').allInnerTexts();
  if (!selected.some((s) => same(s.replace(/^×\s*/, ''), role))) {
    const input = cell.getByRole('combobox');
    await input.click();
    await input.press('ArrowDown');
    const option = this.page.locator('ul.form-autocomplete-suggestions li').filter({ visible: true }).filter({ hasText: new RegExp(`^\\s*${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') }).first();
    try {
      await option.waitFor({ state: 'visible', timeout: budget(this) });
    } catch {
      const offered = await this.page.locator('ul.form-autocomplete-suggestions li').filter({ visible: true }).allInnerTexts().catch(() => []);
      await cell.locator('a:has(i[title="Cancel"])').first().click().catch(() => {});
      throw failure(this, `The roles of "${who}" offer no "${role}". They offer ${listed(offered)}.`, 'The list offers the roles the account may assign in the course.');
    }
    await option.click();
    await pageReady(this);
  }
  await afterAction(this, () => cell.locator('a:has(i[title="Save changes"])').first().click());
  await eventually(this, () => rolesOf(this, who), (roles) => roles.some((r) => same(r, role)), (roles) => ({
    message: `After saving, the roles of "${who}" are ${listed(roles)}, without "${role}".`,
    hint: 'Look for an error toast on the screenshot.',
  }));
});

/**
 * Take a role of a participant of the scenario's course away, the way a
 * teacher does: the pencil of the "Roles" column, the role's badge pressed to
 * remove it, then "Save changes".
 *
 * Example #1: When I remove the role "Non-editing teacher" from "student" in the course
 * Example #2: When we remove the role "Non-editing teacher" from "student" in the course
 * Example #3: And I remove the role "Non-editing teacher" from "student" in the course
 * Example #4: Then I remove the role "Non-editing teacher" from "student" in the course
 * Example #5: Given we remove the role "Non-editing teacher" from "student" in the course
 */
When(/^(I |we )*remove the role "([^"]*)" from "([^"]*)" in the course$/, { timeout: 120000 }, async function (pronounCase, role, who) {
  const cell = await editRoles(this, who);
  const badge = cell.locator('.form-autocomplete-selection [role="option"]').filter({ hasText: new RegExp(`^\\s*×?\\s*${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') }).first();
  if (!(await badge.count())) {
    const selected = await cell.locator('.form-autocomplete-selection [role="option"]').allInnerTexts();
    await cell.locator('a:has(i[title="Cancel"])').first().click().catch(() => {});
    throw failure(this, `"${who}" has no role "${role}" to remove. Its roles are ${listed(selected.map((s) => s.replace(/^×\s*/, '')))}.`, 'Give the role first, or name it as the "Roles" column writes it.');
  }
  await badge.click();
  await pageReady(this);
  await afterAction(this, () => cell.locator('a:has(i[title="Save changes"])').first().click());
  await eventually(this, () => rolesOf(this, who), (roles) => !roles.some((r) => same(r, role)), (roles) => ({
    message: `After saving, the roles of "${who}" still list "${role}": ${listed(roles)}.`,
    hint: 'Look for an error toast on the screenshot.',
  }));
});

/**
 * Ask to enrol the account in the browser in a course by its self enrolment
 * with a key: the enrolment options of the course, "Enrol me", the key typed
 * in "Enrolment key" of the dialog, then "Enrol me" again. Returns what the
 * site did: the course page, or the error the dialog shows.
 */
async function selfEnrol(world, name, key) {
  await openCourse(world, name);
  if (!/\/enrol\/index\.php/.test(world.page.url())) {
    return { enrolled: false, error: `the browser went to ${world.page.url()} instead of the enrolment options: the account may already be enrolled` };
  }
  const start = world.page.getByRole('button', { name: 'Enrol me' }).filter({ visible: true }).first();
  if (!(await start.count())) {
    const text = clean(await world.page.locator('#region-main').innerText().catch(() => ''));
    return { enrolled: false, error: `the enrolment options offer no "Enrol me" (${text.slice(0, 200)})` };
  }
  await afterAction(world, () => personClick(start));
  const dialog = world.page.getByRole('dialog').filter({ has: world.page.getByLabel('Enrolment key') });
  if (await dialog.count()) {
    await dialog.getByLabel('Enrolment key').fill(key);
    await afterAction(world, () => dialog.getByRole('button', { name: 'Enrol me' }).click());
  }
  if (/\/course\/view\.php/.test(world.page.url())) return { enrolled: true, error: '' };
  const errors = await world.page.locator('.modal.show .invalid-feedback, .modal.show .form-control-feedback, .modal.show .alert-danger').filter({ visible: true }).allInnerTexts().catch(() => []);
  return { enrolled: false, error: errors.map(clean).join(' ') || `the browser is on ${world.page.url()}` };
}

/**
 * Enrol the account in the browser in a course, the way a student does: the
 * course's enrolment options, "Enrol me" and the enrolment key. The step fails
 * when the site refuses the key. The browser ends on the course page.
 *
 * Example #1: When I enrol myself in the course "Software Testing 101" with the key "TEST101-key"
 * Example #2: Then I enrol myself in the course "Software Testing 101" with the key "TEST101-key"
 * Example #3: And I enrol myself in the course "TEST101" with the key "TEST101-key"
 * Example #4: Given I enrol myself in the course "Software Testing 101" with the key "TEST101-key"
 * Example #5: When I enrol myself in the course "TEST101" with the key "TEST101-key"
 */
When(/^I enrol myself in the course "([^"]*)" with the key "([^"]*)"$/, { timeout: 120000 }, async function (name, key) {
  const outcome = await selfEnrol(this, name, key);
  if (!outcome.enrolled) {
    throw failure(this, `Self enrolment in "${name}" did not go through: ${outcome.error}.`, 'The course needs self enrolment turned on, with that key; an account that is already enrolled goes straight to the course.');
  }
});

/**
 * Assert that the site refuses to enrol the account in the browser in a
 * course with a key: the dialog of the enrolment key stays, with the error it
 * shows.
 *
 * Example #1: Then enrolling myself in the course "Software Testing 101" with the key "wrong-key" should be refused with "Incorrect enrolment key, please try again"
 * Example #2: Then enrolling myself in the course "TEST101" with the key "nope" should be refused with "Incorrect enrolment key, please try again"
 * Example #3: And enrolling myself in the course "Software Testing 101" with the key "" should be refused with "Incorrect enrolment key, please try again"
 * Example #4: Then enrolling myself in the course "Software Testing 101" with the key "test101-key" should be refused with "Incorrect enrolment key, please try again"
 * Example #5: But enrolling myself in the course "TEST101" with the key "wrong-key" should be refused with "Incorrect enrolment key"
 */
Then(/^enrolling myself in the course "([^"]*)" with the key "([^"]*)" should be refused with "([^"]*)"$/, { timeout: 120000 }, async function (name, key, message) {
  const outcome = await selfEnrol(this, name, key);
  if (outcome.enrolled) {
    throw failure(this, `Expected the key "${key}" to be refused, but the account was enrolled in "${name}".`, 'Unenrol the account again (I unenrol myself from the course "...").');
  }
  if (!clean(outcome.error).toLowerCase().includes(clean(message).toLowerCase())) {
    throw failure(this, `Expected the refusal "${message}", but ${outcome.error}.`, 'The enrolment key dialog shows its error under the field.');
  }
});

/**
 * Leave a course the account in the browser enrolled itself in, the way a
 * student does: the "More" menu of the course, "Unenrol me from this course",
 * then "Continue".
 *
 * Example #1: When I unenrol myself from the course "Software Testing 101"
 * Example #2: But I unenrol myself from the course "Software Testing 101"
 * Example #3: And I unenrol myself from the course "TEST101"
 * Example #4: Then I unenrol myself from the course "Software Testing 101"
 * Example #5: Given I unenrol myself from the course "TEST101"
 */
When(/^I unenrol myself from the course "([^"]*)"$/, { timeout: 120000 }, async function (name) {
  const course = await openCourse(this, name);
  const link = await this.page.evaluate(() => {
    const a = [...document.querySelectorAll('.secondary-navigation a, nav[aria-label="Course menu"] a')].find((x) => /^\s*Unenrol me from/i.test(x.textContent || ''));
    return a ? a.getAttribute('href') : null;
  });
  if (!link) throw failure(this, `The course menu of "${course.name}" has no "Unenrol me from this course".`, 'The menu offers it to an account that enrolled itself (self enrolment); a teacher unenrols the others.');
  await open(this, link);
  const button = this.page.locator('#region-main').getByRole('button', { name: 'Continue' });
  if (!(await button.count())) throw failure(this, `The page that unenrols from "${course.name}" asks nothing to confirm (${this.page.url()}).`, 'The site asks "Do you really want to unenrol yourself from course …?" with Cancel and Continue.');
  await afterAction(this, () => personClick(button));
});
