'use strict';

// The assignment: a submission of online text made, read and removed by the
// student, and graded (with feedback) and the grade taken back by the
// teacher, on the assignment's own pages.
//
// What a scenario submits or grades, it takes back: the student removes the
// submission, the teacher clears the grade.

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
  openActivity,
  readTable,
  columnIndex,
  rowFor,
  typeIntoEditor,
  recordedToasts,
} = require('./moodle-helpers');

/** Open an assignment of the scenario's course by its name; returns its course module id. */
async function openAssignment(world, name) {
  const activity = await openActivity(world, name);
  if (activity.type && activity.type !== 'assign') {
    throw failure(world, `"${name}" is not an assignment (it is a ${activity.type}).`, 'Name an assignment of the course.');
  }
  return activity.id;
}

/** The rows of the "Submission status" table of an assignment's page: { label: value }. */
async function submissionStatus(world) {
  return world.page.evaluate(() => {
    const table = [...document.querySelectorAll('#region-main table')].find((t) => /submission status/i.test((t.querySelector('caption') || {}).textContent || '') || t.classList.contains('submissionstatustable'))
      || document.querySelector('#region-main .submissionstatustable table, #region-main table.generaltable');
    const out = {};
    if (!table) return out;
    for (const tr of table.querySelectorAll('tr')) {
      const head = tr.querySelector('th');
      const cell = tr.querySelector('td');
      if (head && cell) out[head.textContent.replace(/\s+/g, ' ').trim()] = cell.textContent.replace(/\s+/g, ' ').trim();
    }
    return out;
  }).catch(() => ({}));
}

/**
 * Submit online text to an assignment of the scenario's course, the way a
 * student does: "Add submission" (or "Edit submission" when there is one),
 * the text typed into the "Online text" editor, then "Save changes". The
 * browser ends on the assignment's page.
 *
 * Example #1: When I submit the text "Found a defect in the login form." for the assignment "Testing diary"
 * Example #2: When we submit the text "The search returns nothing for an empty query." for the assignment "Testing diary"
 * Example #3: And I submit the text "A short entry." for the assignment "Testing diary"
 * Example #4: Given I submit the text "Found a defect in the login form." for the assignment "Testing diary"
 * Example #5: When we submit the text "A second entry." for the assignment "Testing diary"
 */
When(/^(I |we )*submit the text "([^"]*)" for the assignment "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, text, name) {
  await openAssignment(this, name);
  const button = this.page.getByRole('button', { name: /^(Add submission|Edit submission)$/ }).filter({ visible: true }).first();
  if (!(await button.count())) {
    const status = await submissionStatus(this);
    throw failure(this, `The assignment "${name}" offers no "Add submission" or "Edit submission" (its status: ${listed(Object.entries(status).map(([k, v]) => `${k}: ${v}`))}).`, 'A student submits while the assignment is open; a submission that is locked or graded with "Prevent submission changes" cannot be edited.');
  }
  await afterAction(this, () => personClick(button));
  await typeIntoEditor(this, 'Online text', text);
  await afterAction(this, () => personClick(this.page.locator('#region-main form').getByRole('button', { name: 'Save changes' })));
  const errors = await this.page.locator('#region-main .invalid-feedback, #region-main .alert-danger').filter({ visible: true }).allInnerTexts().catch(() => []);
  if (errors.length || /action=editsubmission|action=savesubmission/.test(this.page.url())) {
    throw failure(this, `The submission of "${name}" was not saved: ${listed(errors) || this.page.url()}.`, 'The form says why under the field.');
  }
});

/**
 * Assert a line of the "Submission status" table of an assignment of the
 * scenario's course, as the student sees it ("Submission status", "Grading
 * status", "Online text", …).
 *
 * Example #1: Then the "Submission status" of the assignment "Testing diary" should be "Submitted for grading"
 * Example #2: Then the "Grading status" of the assignment "Testing diary" should be "Not graded"
 * Example #3: And the "Submission status" of the assignment "Testing diary" should be "No submissions have been made yet"
 * Example #4: Then the "Grading status" of the assignment "Testing diary" should be "Graded"
 * Example #5: And the "Online text" of the assignment "Testing diary" should be "Found a defect in the login form."
 */
Then(/^the "([^"]*)" of the assignment "([^"]*)" should be "([^"]*)"$/, async function (row, name, expected) {
  await openAssignment(this, name);
  await eventually(this, () => submissionStatus(this), (status) => Object.keys(status).some((k) => same(k, row) && same(status[k], expected)), (status) => {
    const key = Object.keys(status).find((k) => same(k, row));
    return {
      message: key ? `Expected the "${row}" of "${name}" to be "${expected}", but it is "${status[key]}".` : `The status table of "${name}" has no line "${row}". Its lines: ${listed(Object.keys(status))}.`,
      hint: 'The table is the "Submission status" of the assignment page, as the account sees it.',
    };
  });
});

/**
 * Remove the submission of the account in the browser from an assignment of
 * the scenario's course, the way a student does: "Remove submission", then
 * "Continue".
 *
 * Example #1: When I remove my submission for the assignment "Testing diary"
 * Example #2: And I remove my submission for the assignment "Testing diary"
 * Example #3: Then I remove my submission for the assignment "Testing diary"
 * Example #4: Given I remove my submission for the assignment "Testing diary"
 * Example #5: But I remove my submission for the assignment "Testing diary"
 */
When(/^I remove my submission for the assignment "([^"]*)"$/, { timeout: 120000 }, async function (name) {
  await openAssignment(this, name);
  const button = this.page.getByRole('button', { name: 'Remove submission' }).filter({ visible: true }).first();
  if (!(await button.count())) throw failure(this, `The assignment "${name}" offers no "Remove submission".`, 'A student removes a submission that is still open for changes.');
  await afterAction(this, () => personClick(button));
  await afterAction(this, () => personClick(this.page.locator('#region-main').getByRole('button', { name: 'Continue' })));
});

/** Open the grader of an assignment for one student, the way a teacher does: "Submissions", then the student's "Grade". */
async function openGrader(world, name, who) {
  const cmid = await openAssignment(world, name);
  await open(world, `/mod/assign/view.php?id=${cmid}&action=grading`);
  const { keys, label } = accountKeys(world, who);
  const table = await readTable(world, '#region-main table.generaltable, #region-main table');
  if (!table || !rowFor(table.rows, keys)) {
    throw failure(world, `The submissions of "${name}" do not list ${label}. They list ${listed(((table && table.rows) || []).map((r) => r[1]))}.`, 'The submissions list the students of the course.');
  }
  const row = world.page.locator('#region-main table tbody tr').filter({ hasText: new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i') }).first();
  const toggle = row.getByRole('button', { name: 'Grade actions' }).or(row.locator('a[aria-label="Grade actions"], [title="Grade actions"]')).first();
  if (await toggle.count()) {
    await personClick(toggle);
    await afterAction(world, () => row.getByRole('menuitem', { name: 'Grade' }).or(row.locator('a:text-is("Grade")')).first().click());
  } else {
    await afterAction(world, () => personClick(row.getByRole('link', { name: 'Grade' }).first()));
  }
  await world.page.getByRole('textbox', { name: /^Grade out of/ }).waitFor({ state: 'visible', timeout: budget(world) * 2 }).catch(() => {});
  await pageReady(world);
}

/** Save the grader's form and wait for its own confirmation. */
async function saveGrade(world) {
  const before = (await recordedToasts(world)).length;
  await personClick(world.page.getByRole('button', { name: 'Save changes' }).filter({ visible: true }).first());
  await pageReady(world);
  await eventually(world, () => recordedToasts(world), (t) => t.slice(before).some((x) => /changes to the grade and feedback were saved/i.test(x.text) || x.kind === 'error'), (t) => ({
    message: `The grader did not confirm the save; it showed ${listed(t.slice(before).map((x) => x.text))}.`,
    hint: 'The grader saves in the background and confirms with "The changes to the grade and feedback were saved".',
  }));
  const failed = (await recordedToasts(world)).slice(before).find((x) => x.kind === 'error');
  if (failed) throw failure(world, `The grader refused the grade: "${failed.text}".`, 'Read the message: a grade out of range or a form error is refused.');
}

/**
 * Grade a student's submission to an assignment of the scenario's course,
 * the way a teacher does: "Submissions", the student's "Grade", the grade
 * typed in "Grade out of …", the feedback typed in "Feedback comments" when
 * the step gives one, then "Save changes". The step waits for the grader to
 * confirm the save.
 *
 * Example #1: When I grade "student" with "85" for the assignment "Testing diary"
 * Example #2: When we grade "student" with "85" for the assignment "Testing diary" with the feedback "Well found."
 * Example #3: And I grade "student" with "70" for the assignment "Testing diary"
 * Example #4: Given I grade "student" with "100" for the assignment "Testing diary" with the feedback "A clear entry."
 * Example #5: When we grade "student" with "55" for the assignment "Testing diary"
 */
When(/^(I |we )*grade "([^"]*)" with "([^"]*)" for the assignment "([^"]*)"(?: with the feedback "([^"]*)")?$/, { timeout: 120000 }, async function (pronounCase, who, grade, name, feedback) {
  await openGrader(this, name, who);
  const field = this.page.getByRole('textbox', { name: /^Grade out of/ });
  if (!(await field.count())) throw failure(this, `The grader of "${name}" shows no "Grade out of …" field.`, 'The assignment has a point grade (Grade type: Point).');
  await field.fill(grade);
  if (typeof feedback === 'string') await typeIntoEditor(this, 'Feedback comments', feedback);
  await saveGrade(this);
});

/**
 * Take a student's grade of an assignment of the scenario's course back, the
 * way a teacher does: the grader, the "Grade out of …" field emptied, then
 * "Save changes".
 *
 * Example #1: When I clear the grade of "student" for the assignment "Testing diary"
 * Example #2: When we clear the grade of "student" for the assignment "Testing diary"
 * Example #3: And I clear the grade of "student" for the assignment "Testing diary"
 * Example #4: Then I clear the grade of "student" for the assignment "Testing diary"
 * Example #5: Given we clear the grade of "student" for the assignment "Testing diary"
 */
When(/^(I |we )*clear the grade of "([^"]*)" for the assignment "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, who, name) {
  await openGrader(this, name, who);
  await this.page.getByRole('textbox', { name: /^Grade out of/ }).fill('');
  if (await this.page.locator('[id="id_assignfeedbackcomments_editor"]').count()) await typeIntoEditor(this, 'Feedback comments', '').catch(() => {});
  await saveGrade(this);
});

/**
 * Assert a count of the "Grading summary" of an assignment of the scenario's
 * course, as a teacher sees it ("Participants", "Submitted", "Needs grading").
 *
 * Example #1: Then the "Needs grading" count of the assignment "Testing diary" should be "1"
 * Example #2: Then the "Submitted" count of the assignment "Testing diary" should be "0"
 * Example #3: And the "Participants" count of the assignment "Testing diary" should be "1"
 * Example #4: Then the "Needs grading" count of the assignment "Testing diary" should be "0"
 * Example #5: And the "Submitted" count of the assignment "Testing diary" should be "1"
 */
Then(/^the "([^"]*)" count of the assignment "([^"]*)" should be "([^"]*)"$/, async function (row, name, expected) {
  await openAssignment(this, name);
  const read = () => this.page.evaluate(() => {
    const out = {};
    for (const tr of document.querySelectorAll('#region-main table tr')) {
      const head = tr.querySelector('th');
      const cell = tr.querySelector('td');
      if (head && cell) out[head.textContent.replace(/\s+/g, ' ').trim()] = cell.textContent.replace(/\s+/g, ' ').trim();
    }
    return out;
  }).catch(() => ({}));
  await eventually(this, read, (s) => Object.keys(s).some((k) => same(k, row) && same(s[k], expected)), (s) => {
    const key = Object.keys(s).find((k) => same(k, row));
    return {
      message: key ? `Expected "${row}" of "${name}" to be ${expected}, but the grading summary says ${s[key]}.` : `The grading summary of "${name}" has no "${row}". It shows ${listed(Object.keys(s))}.`,
      hint: 'The grading summary is on the assignment page of an account that may grade it (a teacher).',
    };
  });
});

/**
 * Assert the grade and the feedback a student sees on an assignment of the
 * scenario's course: the "Feedback" part of the assignment page ("Grade"
 * holds, for example, "85.00 / 100.00").
 *
 * Example #1: Then my grade for the assignment "Testing diary" should be "85.00 / 100.00"
 * Example #2: And my grade for the assignment "Testing diary" should be "70.00 / 100.00"
 * Example #3: Then my grade for the assignment "Testing diary" should be "100.00 / 100.00"
 * Example #4: But my grade for the assignment "Testing diary" should be "85.00 / 100.00"
 * Example #5: Then my grade for the assignment "Testing diary" should be "55.00 / 100.00"
 */
Then(/^my grade for the assignment "([^"]*)" should be "([^"]*)"$/, async function (name, expected) {
  await openAssignment(this, name);
  const read = () => this.page.evaluate(() => {
    const out = {};
    for (const tr of document.querySelectorAll('#region-main .feedback table tr, #region-main table.generaltable tr')) {
      const head = tr.querySelector('th');
      const cell = tr.querySelector('td');
      if (head && cell) out[head.textContent.replace(/\s+/g, ' ').trim()] = cell.textContent.replace(/\s+/g, ' ').trim();
    }
    return out;
  }).catch(() => ({}));
  await eventually(this, read, (s) => same(s.Grade || '', expected), (s) => ({
    message: s.Grade ? `Expected the grade of "${name}" to be "${expected}", but the assignment page says "${s.Grade}".` : `The assignment page of "${name}" shows no grade yet (${listed(Object.keys(s))}).`,
    hint: 'The student sees the grade in the "Feedback" part of the assignment page once the teacher saved it.',
  }));
});
