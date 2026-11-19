'use strict';

// The site administration: its search (a setting found by its words, and the
// value it holds), and course management (the courses of a category, a
// course made and deleted again).
//
// What a scenario makes, it deletes: a course it creates.

const { When, Then } = require('@cucumber/cucumber');
const {
  budget,
  clean,
  same,
  listed,
  failure,
  open,
  afterAction,
  personClick,
  eventually,
} = require('./moodle-helpers');

/**
 * Search the site administration, the way an administrator does: the search
 * box of the site administration, the words, then Enter. The browser ends on
 * the search results.
 *
 * Example #1: When I search the site administration for "guest login button"
 * Example #2: When we search the site administration for "password policy"
 * Example #3: And I search the site administration for "enable completion"
 * Example #4: Given I search the site administration for "guest login button"
 * Example #5: When we search the site administration for "messaging"
 */
When(/^(I |we )*search the site administration for "([^"]*)"$/, async function (pronounCase, words) {
  await open(this, '/admin/search.php');
  const box = this.page.locator('form[action$="/admin/search.php"] input[name="query"]').filter({ visible: true }).first();
  if (!(await box.count())) {
    const reason = clean(await this.page.locator('.errorbox').first().innerText({ timeout: 500 }).catch(() => ''));
    throw failure(this, `The site administration offers no search${reason ? `: "${reason.replace(/\s*More information about this error.*$/i, '')}"` : ''} (${this.page.url()}).`, 'The site administration is for an administrator (and partly for a manager).');
  }
  await box.fill(words);
  await afterAction(this, () => box.press('Enter'));
});

/** The settings the page shows: label, short name and current value. */
async function settings(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('#region-main .form-item[id^="admin-"]')].map((item) => {
    const label = item.querySelector('.form-label label, label');
    const short = item.querySelector('.form-shortname');
    const select = item.querySelector('.form-setting select');
    const box = item.querySelector('.form-setting input[type="checkbox"]');
    const input = item.querySelector('.form-setting input:not([type="hidden"]):not([type="checkbox"]), .form-setting textarea');
    let value = '';
    if (select) value = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : '';
    else if (box) value = box.checked ? 'Yes' : 'No';
    else if (input) value = input.value;
    return {
      label: label ? label.textContent.replace(/\s+/g, ' ').trim() : '',
      name: short ? short.textContent.trim() : '',
      value: String(value).replace(/\s+/g, ' ').trim(),
    };
  })).catch(() => []);
}

/**
 * Assert that the search results of the site administration show, or do not
 * show, a setting by its label (or its short name).
 *
 * Example #1: Then the site administration search should find the setting "Guest login button"
 * Example #2: Then the site administration search should not find the setting "Guest login button"
 * Example #3: And the site administration search should find the setting "guestloginbutton"
 * Example #4: Then the site administration search should find the setting "Password policy"
 * Example #5: But the site administration search should not find the setting "Password policy"
 */
Then(/^the site administration search should( not)* find the setting "([^"]*)"$/, async function (notCase, name) {
  const all = await settings(this);
  const has = all.some((s) => same(s.label, name) || same(s.name, name));
  if (notCase && has) throw failure(this, `Expected the search not to find the setting "${name}", but it does.`, 'The search finds settings by the words of their label, their short name and their description.');
  if (!notCase && !has) throw failure(this, `Expected the search to find the setting "${name}", but it finds ${listed(all.map((s) => s.label))} (${this.page.url()}).`, 'Search first (I search the site administration for "..."); name the setting by its label or short name.');
});

/**
 * Assert the value a setting of the page holds (the search results or a
 * settings page): the chosen option of a list, "Yes" or "No" for a tick box,
 * the text of a field.
 *
 * Example #1: Then the setting "Guest login button" should be "Show"
 * Example #2: Then the setting "guestloginbutton" should be "Show"
 * Example #3: And the setting "Enable completion tracking" should be "Yes"
 * Example #4: Then the setting "Guest login button" should be "Hide"
 * Example #5: And the setting "Password policy" should be "Yes"
 */
Then(/^the setting "([^"]*)" should be "([^"]*)"$/, async function (name, expected) {
  const all = await settings(this);
  const setting = all.find((s) => same(s.label, name) || same(s.name, name));
  if (!setting) throw failure(this, `The page shows no setting "${name}". It shows ${listed(all.map((s) => s.label))} (${this.page.url()}).`, 'Search for it first (I search the site administration for "...").');
  if (!same(setting.value, expected)) throw failure(this, `Expected the setting "${setting.label}" to be "${expected}", but it is "${setting.value}".`, 'The value is the one saved on the site; the page says the default under the field.');
});

/** Open course management on a category, the way an administrator does: the category's name in the list. */
async function openCategory(world, category) {
  await open(world, '/course/management.php');
  if (!(await world.page.locator('#category-listing').count())) {
    throw failure(world, `Course management did not open (${world.page.url()}).`, 'Course management is for an administrator or a manager (an account with the right to manage courses).');
  }
  const link = world.page.locator('#category-listing a.categoryname').filter({ hasText: new RegExp(`^\\s*${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') }).first();
  if (!(await link.count())) {
    const names = await world.page.locator('#category-listing a.categoryname').allInnerTexts();
    throw failure(world, `Course management lists no category "${category}". It lists ${listed(names)}.`, 'Name the category as course management writes it.');
  }
  await afterAction(world, () => personClick(link));
}

/** The courses the course listing of course management shows. */
async function listedCourses(world) {
  return world.page.locator('#course-listing a.coursename').allInnerTexts().then((t) => t.map(clean)).catch(() => []);
}

/**
 * Assert that a category of course management lists, or does not list, a
 * course by its full name.
 *
 * Example #1: Then the category "Test courses" should list the course "Software Testing 101"
 * Example #2: Then the category "Test courses" should not list the course "Throwaway course"
 * Example #3: And the category "Test courses" should list the course "Throwaway course"
 * Example #4: Then the category "Category 1" should not list the course "Software Testing 101"
 * Example #5: But the category "Test courses" should not list the course "Throwaway course"
 */
Then(/^the category "([^"]*)" should( not)* list the course "([^"]*)"$/, async function (category, notCase, course) {
  await openCategory(this, category);
  const courses = await listedCourses(this);
  const has = courses.some((c) => same(c, course));
  if (notCase && has) throw failure(this, `Expected the category "${category}" not to list "${course}", but it does.`, 'Delete the course first (I delete the course "..." from the category "...").');
  if (!notCase && !has) throw failure(this, `Expected the category "${category}" to list "${course}", but it lists ${listed(courses)}.`, 'Course management lists the courses of the category chosen on its left.');
});

/**
 * Create a course in a category, the way an administrator does: course
 * management, the category, "Create new course", the full name and the short
 * name, then "Save and return". The step waits for the category to list it.
 *
 * Example #1: When I create the course "Throwaway course" with the short name "THROW1" in the category "Test courses"
 * Example #2: When we create the course "Second throwaway course" with the short name "THROW2" in the category "Test courses"
 * Example #3: And I create the course "Throwaway course" with the short name "THROW1" in the category "Test courses"
 * Example #4: Given I create the course "Throwaway course" with the short name "THROW1" in the category "Category 1"
 * Example #5: When we create the course "Throwaway course" with the short name "THROW1" in the category "Test courses"
 */
When(/^(I |we )*create the course "([^"]*)" with the short name "([^"]*)" in the category "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, name, short, category) {
  await openCategory(this, category);
  const create = this.page.getByRole('link', { name: 'Create new course' }).filter({ visible: true }).first();
  if (!(await create.count())) throw failure(this, `Course management offers no "Create new course" in "${category}".`, 'An account creates courses where it has the right to.');
  await afterAction(this, () => personClick(create));
  await this.page.getByRole('textbox', { name: 'Course full name' }).fill(name);
  await this.page.getByRole('textbox', { name: 'Course short name' }).fill(short);
  await afterAction(this, () => personClick(this.page.getByRole('button', { name: 'Save and return' })));
  const errors = await this.page.locator('#region-main .invalid-feedback, #region-main .alert-danger').filter({ visible: true }).allInnerTexts().catch(() => []);
  if (errors.length) throw failure(this, `The course "${name}" was not created: ${listed(errors)}.`, 'A short name is unique on the site: a course left by an earlier run holds it.');
  await eventually(this, () => listedCourses(this), (courses) => courses.some((c) => same(c, name)), (courses) => ({
    message: `After "Save and return", the category "${category}" does not list "${name}". It lists ${listed(courses)}.`,
    hint: 'Look at the screenshot for what the form said.',
  }));
});

/**
 * Delete a course of a category, the way an administrator does: course
 * management, the category, the course's "Delete" icon, "Delete" to confirm,
 * then "Continue" once the site says the course has been completely deleted.
 *
 * Example #1: When I delete the course "Throwaway course" from the category "Test courses"
 * Example #2: When we delete the course "Second throwaway course" from the category "Test courses"
 * Example #3: And I delete the course "Throwaway course" from the category "Test courses"
 * Example #4: Then I delete the course "Throwaway course" from the category "Category 1"
 * Example #5: Given we delete the course "Throwaway course" from the category "Test courses"
 */
When(/^(I |we )*delete the course "([^"]*)" from the category "([^"]*)"$/, { timeout: 180000 }, async function (pronounCase, name, category) {
  await openCategory(this, category);
  const item = this.page.locator('#course-listing li.listitem-course').filter({ has: this.page.locator('a.coursename').filter({ hasText: new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') }) }).first();
  if (!(await item.count())) throw failure(this, `The category "${category}" lists no course "${name}". It lists ${listed(await listedCourses(this))}.`, 'Name the course by its full name, in its category.');
  const del = item.locator('a[title="Delete"], a.action-delete').first();
  if (!(await del.count())) throw failure(this, `The course "${name}" has no "Delete" icon for this account.`, 'An account deletes courses where it has the right to (an administrator; a manager).');
  await afterAction(this, () => personClick(del));
  const confirm = this.page.locator('#region-main').getByRole('button', { name: 'Delete' });
  if (!(await confirm.count())) throw failure(this, `The site did not ask to confirm the deletion of "${name}" (${this.page.url()}).`, 'It asks "Are you absolutely sure you want to completely delete this course and all the data it contains?".');
  await afterAction(this, () => personClick(confirm));
  const done = this.page.locator('#region-main').getByText(/has been completely deleted/i);
  try {
    await done.first().waitFor({ state: 'visible', timeout: budget(this) * 3 });
  } catch {
    throw failure(this, `The site did not say that "${name}" has been completely deleted (${this.page.url()}).`, 'Look at the screenshot: it lists each part of the course it deleted.');
  }
  const cont = this.page.locator('#region-main').getByRole('button', { name: 'Continue' }).or(this.page.locator('#region-main').getByRole('link', { name: 'Continue' })).first();
  if (await cont.count()) await afterAction(this, () => personClick(cont));
});
