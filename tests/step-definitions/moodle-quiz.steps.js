'use strict';

// The quiz: an attempt started, its questions answered, the attempt
// submitted and its review read by the student, the student's highest grade,
// and the attempts deleted again by the teacher (the results of the quiz).
//
// What a scenario attempts, it takes back: the teacher deletes the attempts.

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
  rowFor,
} = require('./moodle-helpers');

/** Open a quiz of the scenario's course by its name; returns its course module id. */
async function openQuiz(world, name) {
  const activity = await openActivity(world, name);
  if (activity.type && activity.type !== 'quiz') throw failure(world, `"${name}" is not a quiz (it is a ${activity.type}).`, 'Name a quiz of the course.');
  return activity.id;
}

/**
 * Start an attempt at a quiz of the scenario's course, the way a student
 * does: the quiz page, then "Attempt quiz" ("Re-attempt quiz" after an
 * earlier one, "Continue your attempt" for one in progress). The browser ends
 * on the first page of questions.
 *
 * Example #1: When I start an attempt at the quiz "Basics quiz"
 * Example #2: When we start an attempt at the quiz "Basics quiz"
 * Example #3: And I start an attempt at the quiz "Basics quiz"
 * Example #4: Given I start an attempt at the quiz "Basics quiz"
 * Example #5: When we start an attempt at the quiz "Basics quiz"
 */
When(/^(I |we )*start an attempt at the quiz "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, name) {
  await openQuiz(this, name);
  const button = this.page.getByRole('button', { name: /^(Attempt quiz|Re-attempt quiz|Continue your attempt|Continue the last attempt)$/ }).filter({ visible: true }).first();
  if (!(await button.count())) {
    const text = clean(await this.page.locator('#region-main').innerText().catch(() => ''));
    throw failure(this, `The quiz "${name}" offers no "Attempt quiz" (${text.slice(0, 200)}).`, 'A student attempts an open quiz with questions, within its number of attempts.');
  }
  await afterAction(this, () => personClick(button));
  // A quiz with a time limit or a password asks first, in a dialog.
  const start = this.page.getByRole('dialog').getByRole('button', { name: 'Start attempt' });
  if (await start.count()) await afterAction(this, () => start.click());
  try {
    await this.page.locator('.que').first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch {
    throw failure(this, `The attempt at "${name}" shows no question (${this.page.url()}).`, 'The quiz needs questions; look at the screenshot for what the site said.');
  }
});

/** The question of the attempt page a scenario names: by its number ("2") or by its text (or the start of it). */
async function question(world, ref) {
  const questions = world.page.locator('.que');
  const count = await questions.count();
  if (/^\d+$/.test(clean(ref))) {
    const i = Number(ref) - 1;
    if (i >= 0 && i < count) return questions.nth(i);
  } else {
    for (let i = 0; i < count; i += 1) {
      const text = clean(await questions.nth(i).locator('.qtext').innerText().catch(() => ''));
      if (text.toLowerCase().startsWith(clean(ref).toLowerCase())) return questions.nth(i);
    }
  }
  const texts = await questions.locator('.qtext').allInnerTexts().catch(() => []);
  throw failure(world, `The page has no question "${ref}". Its questions: ${listed(texts)}.`, 'Name a question by its number on the page or by its text (or the start of it).');
}

/**
 * Answer a question of the attempt on screen, the way a student does: the
 * choice whose label is the answer (true or false, multiple choice), or the
 * answer typed into its field (short answer, numerical). The question is
 * named by its text (or the start of it), or by its number.
 *
 * Example #1: When I answer "True" to the question "Testing can show that defects are present."
 * Example #2: When we answer "Unit test" to the question "Which test checks the smallest testable part"
 * Example #3: And I answer "defect" to the question "In one word, what do testers call a flaw in the software?"
 * Example #4: When I answer "False" to the question "1"
 * Example #5: And we answer "bug" to the question "3"
 */
When(/^(I |we )*answer "([^"]*)" to the question "([^"]*)"$/, async function (pronounCase, answer, ref) {
  const q = await question(this, ref);
  const radios = q.getByRole('radio');
  const count = await radios.count();
  if (count) {
    for (let i = 0; i < count; i += 1) {
      const radio = radios.nth(i);
      const label = await radio.evaluate((el) => {
        const by = el.getAttribute('aria-labelledby');
        const node = by ? document.getElementById(by) : (el.labels && el.labels[0]);
        if (!node) return '';
        const copy = node.cloneNode(true);
        copy.querySelectorAll('.answernumber').forEach((x) => x.remove());
        return copy.textContent.replace(/\s+/g, ' ').trim();
      });
      if (same(label, answer)) {
        await radio.check();
        await pageReady(this);
        return;
      }
    }
    const labels = await radios.evaluateAll((els) => els.map((el) => {
      const by = el.getAttribute('aria-labelledby');
      const node = by ? document.getElementById(by) : (el.labels && el.labels[0]);
      return node ? node.textContent.replace(/^\s*[a-z]\.\s*/i, '').replace(/\s+/g, ' ').trim() : '';
    }));
    throw failure(this, `The question "${ref}" has no choice "${answer}". Its choices: ${listed(labels.filter((l) => !/^clear my choice$/i.test(l)))}.`, 'Name the choice as the question writes it, without its letter.');
  }
  const field = q.locator('input[type="text"], textarea').filter({ visible: true }).first();
  if (!(await field.count())) throw failure(this, `The question "${ref}" has neither choices nor a field to type into.`, 'The step answers true or false, multiple choice, short answer and numerical questions.');
  await field.fill(answer);
});

/**
 * Submit the attempt on screen, the way a student does: "Finish attempt ...",
 * "Submit all and finish" on the summary, and "Submit all and finish" again in
 * the dialog that asks to confirm. The browser ends on the review of the
 * attempt.
 *
 * Example #1: When I submit the quiz attempt
 * Example #2: When we submit the quiz attempt
 * Example #3: And I submit the quiz attempt
 * Example #4: Then I submit the quiz attempt
 * Example #5: Given we submit the quiz attempt
 */
When(/^(I |we )*submit the quiz attempt$/, { timeout: 120000 }, async function (pronounCase) {
  if (/\/mod\/quiz\/attempt\.php/.test(this.page.url())) {
    const finish = this.page.locator('#region-main').locator('input[value="Finish attempt ..."], button:text-is("Finish attempt ...")').last();
    const navFinish = this.page.getByRole('link', { name: 'Finish attempt ...' }).or(this.page.getByRole('button', { name: 'Finish attempt ...' })).first();
    const target = (await finish.count()) ? finish : navFinish;
    await afterAction(this, () => personClick(target));
  }
  if (!/\/mod\/quiz\/summary\.php/.test(this.page.url())) {
    throw failure(this, `Expected the summary of the attempt, but the browser is on ${this.page.url()}.`, 'Start an attempt first (I start an attempt at the quiz "...").');
  }
  await afterAction(this, () => personClick(this.page.locator('#region-main').getByRole('button', { name: 'Submit all and finish' })));
  const dialog = this.page.getByRole('dialog').filter({ has: this.page.getByRole('button', { name: 'Submit all and finish' }) });
  await dialog.waitFor({ state: 'visible', timeout: budget(this) });
  await afterAction(this, () => dialog.getByRole('button', { name: 'Submit all and finish' }).click());
  if (!/\/mod\/quiz\/review\.php/.test(this.page.url())) {
    throw failure(this, `After "Submit all and finish", the browser is on ${this.page.url()}, not the review of the attempt.`, 'Look at the screenshot: a quiz may hide its review.');
  }
});

/** The summary table of the review on screen: { label: value }. */
async function reviewSummary(world) {
  return world.page.evaluate(() => {
    const out = {};
    for (const tr of document.querySelectorAll('table.quizreviewsummary tr')) {
      const head = tr.querySelector('th');
      const cell = tr.querySelector('td');
      if (head && cell) out[head.textContent.replace(/\s+/g, ' ').trim()] = cell.textContent.replace(/\s+/g, ' ').trim();
    }
    return out;
  }).catch(() => ({}));
}

/**
 * Assert a line of the review of the attempt on screen ("Status", "Marks",
 * "Grade"), as the review writes it.
 *
 * Example #1: Then the "Grade" of the attempt should be "10.00 out of 10.00 (100%)"
 * Example #2: Then the "Marks" of the attempt should be "3.00/3.00"
 * Example #3: And the "Status" of the attempt should be "Finished"
 * Example #4: Then the "Grade" of the attempt should be "0.00 out of 10.00 (0%)"
 * Example #5: And the "Marks" of the attempt should be "2.00/3.00"
 */
Then(/^the "([^"]*)" of the attempt should be "([^"]*)"$/, async function (line, expected) {
  const summary = await reviewSummary(this);
  const key = Object.keys(summary).find((k) => same(k, line));
  if (!key) throw failure(this, `The review of the attempt has no "${line}". It shows ${listed(Object.keys(summary))} (${this.page.url()}).`, 'Submit the attempt first (I submit the quiz attempt): the review shows Status, Started, Completed, Duration, Marks and Grade.');
  if (!same(summary[key], expected)) throw failure(this, `Expected the "${line}" of the attempt to be "${expected}", but the review says "${summary[key]}".`, 'The review shows what the attempt scored, as the quiz grades it.');
});

/**
 * Assert how the review of the attempt on screen marks a question: "Correct",
 * "Incorrect", "Partially correct" (the state of the question).
 *
 * Example #1: Then the question "Testing can show that defects are present." should be marked "Correct"
 * Example #2: Then the question "1" should be marked "Incorrect"
 * Example #3: And the question "Which test checks the smallest testable part" should be marked "Correct"
 * Example #4: Then the question "3" should be marked "Correct"
 * Example #5: And the question "In one word" should be marked "Incorrect"
 */
Then(/^the question "([^"]*)" should be marked "([^"]*)"$/, async function (ref, expected) {
  const q = await question(this, ref);
  const state = clean(await q.locator('.info .state').innerText().catch(() => ''));
  if (!same(state, expected)) throw failure(this, `Expected the question "${ref}" to be marked "${expected}", but the review marks it "${state || '(nothing)'}".`, 'The review marks each question with its state; the quiz may hide it until the quiz closes.');
});

/**
 * Assert the highest grade a quiz of the scenario's course shows the student
 * ("Highest grade: 10.00 / 10.00.").
 *
 * Example #1: Then my highest grade at the quiz "Basics quiz" should be "10.00 / 10.00"
 * Example #2: And my highest grade at the quiz "Basics quiz" should be "0.00 / 10.00"
 * Example #3: Then my highest grade at the quiz "Basics quiz" should be "6.67 / 10.00"
 * Example #4: But my highest grade at the quiz "Basics quiz" should be "10.00 / 10.00"
 * Example #5: Then my highest grade at the quiz "Basics quiz" should be "3.33 / 10.00"
 */
Then(/^my highest grade at the quiz "([^"]*)" should be "([^"]*)"$/, async function (name, expected) {
  await openQuiz(this, name);
  const text = clean(await this.page.locator('#region-main').innerText().catch(() => ''));
  const found = ((text.match(/Highest grade:\s*([\d.,]+\s*\/\s*[\d.,]+)/i) || [])[1] || '').replace(/[.,]+$/, '');
  if (!found) throw failure(this, `The quiz "${name}" shows no highest grade.`, 'The quiz shows it after a finished attempt.');
  if (clean(found).replace(/\s+/g, '') !== clean(expected).replace(/\s+/g, '')) {
    throw failure(this, `Expected the highest grade at "${name}" to be "${expected}", but the quiz says "${clean(found)}".`, 'The quiz grades by its "Grading method" (Highest grade by default).');
  }
});

/**
 * Delete the attempts of a student at a quiz of the scenario's course, the
 * way a teacher does: the results of the quiz, the student's attempts
 * selected, "Delete selected attempts", then "Yes".
 *
 * Example #1: When I delete the attempts of "student" at the quiz "Basics quiz"
 * Example #2: When we delete the attempts of "student" at the quiz "Basics quiz"
 * Example #3: And I delete the attempts of "student" at the quiz "Basics quiz"
 * Example #4: Then I delete the attempts of "student" at the quiz "Basics quiz"
 * Example #5: Given we delete the attempts of "student" at the quiz "Basics quiz"
 */
When(/^(I |we )*delete the attempts of "([^"]*)" at the quiz "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, who, name) {
  const cmid = await openQuiz(this, name);
  await open(this, `/mod/quiz/report.php?id=${cmid}&mode=overview`);
  const { keys, label } = accountKeys(this, who);
  const table = await readTable(this, 'table#attempts');
  if (!table) throw failure(this, `The results of "${name}" show no attempts table.`, 'The results are for an account that may see the attempts (a teacher).');
  if (!rowFor(table.rows, keys)) throw failure(this, `The results of "${name}" list no attempt of ${label}.`, 'The student has no attempt to delete.');
  const rows = this.page.locator('table#attempts tbody tr').filter({ hasText: new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i') });
  const boxes = rows.locator('input[type="checkbox"][name="attemptid[]"]');
  const n = await boxes.count();
  for (let i = 0; i < n; i += 1) await boxes.nth(i).check();
  await afterAction(this, () => personClick(this.page.getByRole('button', { name: 'Delete selected attempts' })));
  const dialog = this.page.getByRole('dialog').filter({ hasText: /delete these attempts/i });
  await dialog.waitFor({ state: 'visible', timeout: budget(this) });
  await afterAction(this, () => dialog.getByRole('button', { name: 'Yes' }).click());
  await eventually(this, () => readTable(this, 'table#attempts'), (t) => !t || !rowFor(t.rows, keys), () => ({
    message: `The results of "${name}" still list attempts of ${label}.`,
    hint: 'Look at the screenshot for what the site said.',
  }));
});
