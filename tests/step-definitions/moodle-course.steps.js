'use strict';

// The course page: opening a course the way a person finds it, its sections
// and activities, the completion of each activity (automatic or marked by
// hand), the pages of its course menu, and opening an activity.

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
  openCourse,
  currentCourse,
  openCurrentCourse,
  courseActivities,
  findActivity,
  openActivity,
} = require('./moodle-helpers');

/**
 * Open a course by its full name (or its short name), the way a person finds
 * it: the course search of the site, then the course page. An account that is
 * not enrolled lands where the site sends it (the enrolment options of the
 * course). The course is the scenario's course from then on: the steps that
 * say "the course" act on it.
 *
 * Example #1: When I open the course "Software Testing 101"
 * Example #2: When we open the course "Software Testing 101"
 * Example #3: Given I open the course "TEST101"
 * Example #4: And I open the course "Software Testing 101"
 * Example #5: When we open the course "TEST101"
 */
When(/^(I |we )*open the course "([^"]*)"$/, async function (pronounCase, name) {
  await openCourse(this, name);
});

/**
 * Assert that the browser shows the page of the scenario's course, or does
 * not (an account without access is sent elsewhere).
 *
 * Example #1: Then I should be on the course page
 * Example #2: Then I should not be on the course page
 * Example #3: And we should be on the course page
 * Example #4: Then we should not be on the course page
 * Example #5: But I should be on the course page
 */
Then(/^(I |we )*should( not)* be on the course page$/, async function (pronounCase, notCase) {
  const course = currentCourse(this);
  const on = () => new RegExp(`/course/view\\.php\\?id=${course.id}(&|#|$)`).test(this.page.url());
  if (notCase) {
    if (on()) throw failure(this, `Expected not to be on the page of "${course.name}", but the browser shows it.`, 'An account without access to a course is sent to its enrolment options or to the login form.');
    return;
  }
  if (!on()) {
    throw failure(this, `Expected the page of "${course.name}", but the browser is on ${this.page.url()} ("${clean(await this.page.title())}").`, 'The site sends an account that is not enrolled to the enrolment options of the course.');
  }
});

/**
 * Assert that the browser shows, or does not show, the enrolment options of
 * the scenario's course: where the site sends an account (or a guest) that
 * has no access to the course yet.
 *
 * Example #1: Then I should see the enrolment options of the course
 * Example #2: Then I should not see the enrolment options of the course
 * Example #3: And we should see the enrolment options of the course
 * Example #4: Then we should not see the enrolment options of the course
 * Example #5: But I should see the enrolment options of the course
 */
Then(/^(I |we )*should( not)* see the enrolment options of the course$/, async function (pronounCase, notCase) {
  const course = currentCourse(this);
  const on = /\/enrol\/index\.php/.test(this.page.url()) && (await this.page.getByRole('heading', { name: 'Enrolment options' }).count()) > 0;
  if (notCase && on) throw failure(this, `Expected not to see the enrolment options of "${course.name}", but the browser shows them.`, 'An enrolled account goes to the course page itself.');
  if (!notCase && !on) {
    throw failure(this, `Expected the enrolment options of "${course.name}", but the browser is on ${this.page.url()} ("${clean(await this.page.title())}").`, 'The site shows them to an account that is not enrolled (and to a guest) instead of the course page.');
  }
});

/**
 * Assert the sections of the course page, in order, by their names: the
 * table holds one section name per row (the first one, "General", included).
 *
 * Example #1: Then the course sections should be:
 * Example #2: And the course sections should be:
 * Example #3: Then the course sections should be:
 * Example #4: But the course sections should be:
 * Example #5: Then the course sections should be:
 */
Then(/^the course sections should be:$/, async function (table) {
  const wanted = table.raw().map((row) => clean(row[0])).filter(Boolean);
  if (!/\/course\/view\.php/.test(this.page.url())) await openCurrentCourse(this);
  const read = () => this.page.evaluate(() => [...document.querySelectorAll('#region-main li.section.course-section, #region-main [data-for="section"]')]
    .map((s) => (s.getAttribute('data-sectionname') || ((s.querySelector('.sectionname, h3') || {}).textContent || '')).replace(/\s+/g, ' ').trim())).catch(() => []);
  await eventually(this, read, (names) => names.length === wanted.length && names.every((n, i) => same(n, wanted[i])), (names) => ({
    message: `Expected the sections ${listed(wanted)}, in that order, but the course page shows ${listed(names)}.`,
    hint: 'A section is read by the name the course page gives it.',
  }));
});

/**
 * Assert that a section of the course page lists, or does not list, an
 * activity (by the name the course page shows).
 *
 * Example #1: Then the section "Getting started" should list the activity "Testing diary"
 * Example #2: Then the section "Practice" should not list the activity "Testing diary"
 * Example #3: And the section "Practice" should list the activity "Basics quiz"
 * Example #4: Then the section "General" should list the activity "Announcements"
 * Example #5: But the section "Wrap-up" should not list the activity "Class discussion"
 */
Then(/^the section "([^"]*)" should( not)* list the activity "([^"]*)"$/, async function (section, notCase, name) {
  currentCourse(this);
  if (!/\/course\/view\.php/.test(this.page.url())) await openCurrentCourse(this);
  const all = await courseActivities(this);
  const inSection = all.filter((a) => same(a.section, section));
  const sections = [...new Set(all.map((a) => a.section))];
  if (!inSection.length && !sections.some((s) => same(s, section)) && !notCase) {
    throw failure(this, `The course page has no section "${section}" with activities. Sections with activities: ${listed(sections)}.`, 'Name the section as the course page writes it.');
  }
  const has = inSection.some((a) => same(a.name, name));
  if (notCase && has) throw failure(this, `Expected the section "${section}" not to list "${name}", but it does.`, 'An activity is listed in the section it was added to.');
  if (!notCase && !has) {
    throw failure(this, `Expected the section "${section}" to list "${name}", but it lists ${listed(inSection.map((a) => a.name))}.`, 'An activity is listed by its name in the section it was added to; an account sees a hidden activity only with the right to.');
  }
});

/**
 * Open an activity of the scenario's course by its name, through its link on
 * the course page.
 *
 * Example #1: When I open the activity "Testing diary"
 * Example #2: When we open the activity "Basics quiz"
 * Example #3: And I open the activity "Course handbook"
 * Example #4: Given I open the activity "Class discussion"
 * Example #5: When we open the activity "Announcements"
 */
When(/^(I |we )*open the activity "([^"]*)"$/, async function (pronounCase, name) {
  await openActivity(this, name);
});

/**
 * Assert the completion of an activity as the course page shows it to the
 * account: "Done" for an activity whose conditions are met (or which the
 * account marked as done), "To do" otherwise.
 *
 * Example #1: Then the activity "Course handbook" should be marked as done
 * Example #2: Then the activity "Testing diary" should not be marked as done
 * Example #3: And the activity "Class discussion" should be marked as done
 * Example #4: Then the activity "Basics quiz" should not be marked as done
 * Example #5: But the activity "Course handbook" should not be marked as done
 */
Then(/^the activity "([^"]*)" should( not)* be marked as done$/, async function (name, notCase) {
  currentCourse(this);
  await openCurrentCourse(this);
  await eventually(this, () => findActivity(this, name), (a) => a.completion && a.completion.done === !notCase, (a) => ({
    message: !a.completion
      ? `The activity "${name}" shows no completion on the course page.`
      : `Expected "${name}" ${notCase ? 'not ' : ''}to be marked as done, but the course page shows "${a.completion.label}".`,
    hint: !a.completion
      ? 'An activity shows its completion when completion tracking is on for it and for the course.'
      : 'An automatic condition is met by what the account does (views, submits, gets a grade); a manual one by "Mark as done".',
  }), budget(this));
});

/**
 * Assert that an activity lists a completion condition, as the course page
 * writes it ("View", "Make a submission", "Receive a grade").
 *
 * Example #1: Then the activity "Course handbook" should require "View"
 * Example #2: Then the activity "Testing diary" should require "Make a submission"
 * Example #3: And the activity "Basics quiz" should require "Receive a grade"
 * Example #4: Then the activity "Testing diary" should require "Make a submission"
 * Example #5: And the activity "Course handbook" should require "View"
 */
Then(/^the activity "([^"]*)" should require "([^"]*)"$/, async function (name, condition) {
  currentCourse(this);
  if (!/\/course\/view\.php/.test(this.page.url())) await openCurrentCourse(this);
  const activity = await findActivity(this, name);
  if (!activity.conditions.some((c) => same(c.text, condition))) {
    throw failure(this, `Expected "${name}" to require "${condition}", but its completion conditions are ${listed(activity.conditions.map((c) => c.text))}.`, activity.completion && activity.completion.kind === 'manual' ? 'The activity is marked as done by hand: it lists no condition.' : 'The conditions are listed under the "To do" or "Done" button of the activity on the course page.');
  }
});

/**
 * Mark an activity of the scenario's course as done, or as not done, the way
 * a person does: its "Mark as done" button on the course page (a "Done"
 * button undoes it). The step waits for the site to save it.
 *
 * Example #1: When I mark the activity "Class discussion" as done
 * Example #2: When I mark the activity "Class discussion" as not done
 * Example #3: And we mark the activity "Class discussion" as done
 * Example #4: Then I mark the activity "Class discussion" as not done
 * Example #5: Given we mark the activity "Class discussion" as done
 */
When(/^(I |we )*mark the activity "([^"]*)" as( not)* done$/, async function (pronounCase, name, notCase) {
  currentCourse(this);
  await openCurrentCourse(this);
  const activity = await findActivity(this, name);
  if (!activity.completion || activity.completion.kind !== 'manual') {
    throw failure(this, `The activity "${name}" has no "Mark as done" button: ${activity.completion ? 'its completion is automatic' : 'it shows no completion'}.`, 'Only an activity whose completion is marked by hand has the button.');
  }
  if (activity.completion.done === !notCase) return;
  const button = this.page.locator(`li.activity[data-id="${activity.id}"] button[data-action="toggle-manual-completion"], #module-${activity.id} button[data-action="toggle-manual-completion"]`).first();
  await afterAction(this, () => personClick(button));
  await eventually(this, () => findActivity(this, name), (a) => a.completion && a.completion.done === !notCase, (a) => ({
    message: `The button of "${name}" still reads "${a.completion ? a.completion.label : '(none)'}" after it was pressed.`,
    hint: 'The site saves the change in the background; look for an error toast on the screenshot.',
  }));
});

/**
 * Open a page of the course menu of the scenario's course (the menu under its
 * title: "Course", "Participants", "Grades", "Activities", and the items of
 * its "More" menu).
 *
 * Example #1: When I go to the "Participants" page of the course
 * Example #2: When we go to the "Grades" page of the course
 * Example #3: And I go to the "Activities" page of the course
 * Example #4: When I go to the "Course" page of the course
 * Example #5: When we go to the "Participants" page of the course
 */
When(/^(I |we )*go to the "([^"]*)" page of the course$/, async function (pronounCase, item) {
  await openCurrentCourse(this);
  const links = await this.page.evaluate(() => [...document.querySelectorAll('.secondary-navigation a, nav[aria-label="Course menu"] a')]
    .map((a) => ({ text: (a.textContent || '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') })).filter((a) => a.href && a.href !== '#'));
  const link = links.find((l) => same(l.text, item));
  if (!link) throw failure(this, `The course menu has no "${item}" page. It offers ${listed(links.map((l) => l.text))}.`, 'The course menu is under the title of the course; what it offers depends on the roles of the account.');
  await open(this, link.href);
});
