'use strict';

// The gradebook of the scenario's course: the grader report a teacher reads
// (a row per student, a column per grade item) and the user report a student
// reads (a row per grade item).

const { Then } = require('@cucumber/cucumber');
const {
  clean,
  same,
  listed,
  failure,
  open,
  eventually,
  accountKeys,
  currentCourse,
  readTable,
  columnIndex,
  rowFor,
} = require('./moodle-helpers');

/** A grade as the reports write it: "85.00", "-" for none. */
function gradeText(text) {
  return clean(text).replace(/\s*(Cell actions|Actions)\s*$/i, '');
}

/**
 * Assert the grade a student has for a grade item (an activity, or "Course
 * total") in the grader report of the scenario's course ("-" for no grade).
 * The student is a handle of the users registry, matched by its full name or
 * its address.
 *
 * Example #1: Then the grader report should show "85.00" for "student" in "Testing diary"
 * Example #2: Then the grader report should show "-" for "student" in "Basics quiz"
 * Example #3: And the grader report should show "85.00" for "student" in "Course total"
 * Example #4: Then the grader report should show "-" for "student" in "Testing diary"
 * Example #5: And the grader report should show "10.00" for "student" in "Basics quiz"
 */
Then(/^the grader report should show "([^"]*)" for "([^"]*)" in "([^"]*)"$/, async function (expected, who, item) {
  const course = currentCourse(this);
  await open(this, `/grade/report/grader/index.php?id=${course.id}`);
  const { keys, label } = accountKeys(this, who);
  await eventually(this, () => readTable(this, 'table#user-grades'), (t) => {
    if (!t) return false;
    const col = columnIndex(t.head, item);
    const row = rowFor(t.rows, keys);
    return col >= 0 && row && same(gradeText(row[col]), expected);
  }, (t) => {
    if (!t) return { message: `The grader report of "${course.name}" shows no grades table (${this.page.url()}).`, hint: 'The grader report is for an account that may grade in the course (a teacher).' };
    const col = columnIndex(t.head, item);
    const row = rowFor(t.rows, keys);
    if (col < 0) return { message: `The grader report has no column "${item}". Its columns: ${listed(t.head)}.`, hint: 'A column is a grade item: an activity with a grade, a category, or "Course total".' };
    if (!row) return { message: `The grader report has no row for ${label}. Its rows: ${listed(t.rows.map((r) => r[0]))}.`, hint: 'The report lists the students of the course (by name and address).' };
    return { message: `Expected the grader report to show "${expected}" for ${label} in "${item}", but it shows "${gradeText(row[col])}".`, hint: 'A grade saved in an activity shows in the report at once; "-" is no grade.' };
  });
});

/**
 * Assert the grade the account in the browser has for a grade item (an
 * activity, or "Course total") in its user report of the scenario's course
 * ("-" for no grade).
 *
 * Example #1: Then my grade for "Testing diary" in the user report should be "85.00"
 * Example #2: Then my grade for "Basics quiz" in the user report should be "-"
 * Example #3: And my grade for "Course total" in the user report should be "85.00"
 * Example #4: Then my grade for "Testing diary" in the user report should be "-"
 * Example #5: And my grade for "Basics quiz" in the user report should be "10.00"
 */
Then(/^my grade for "([^"]*)" in the user report should be "([^"]*)"$/, async function (item, expected) {
  const course = currentCourse(this);
  await open(this, `/grade/report/user/index.php?id=${course.id}`);
  const read = () => this.page.evaluate(() => [...document.querySelectorAll('table.user-grade tbody tr')].map((tr) => {
    const title = tr.querySelector('.rowtitle') || tr.querySelector('th.column-itemname');
    const grade = tr.querySelector('td.column-grade');
    let g = '';
    if (grade) {
      const first = grade.querySelector('div > div') || grade;
      g = (first.childNodes.length && first.firstChild.nodeType === 3 ? first.textContent : first.textContent).replace(/\s+/g, ' ').trim();
    }
    return { item: title ? title.textContent.replace(/\s+/g, ' ').trim() : '', grade: g };
  }).filter((r) => r.item)).catch(() => []);
  await eventually(this, read, (rows) => rows.some((r) => same(r.item, item) && same(gradeText(r.grade), expected)), (rows) => {
    const row = rows.find((r) => same(r.item, item));
    return {
      message: row ? `Expected my grade for "${item}" to be "${expected}", but the user report shows "${gradeText(row.grade)}".` : `The user report of "${course.name}" has no item "${item}". Its items: ${listed(rows.map((r) => r.item))}.`,
      hint: 'The user report lists each grade item of the course with the grade of the account; "-" is no grade.',
    };
  });
});
