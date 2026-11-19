<p align="center"><img src="https://raw.githubusercontent.com/webship/moodle-steps/2.0.x/assets/logo.svg" alt="Moodle logo" width="96"></p>

# moodle-steps

Cucumber step definitions for testing Moodle learning sites with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/moodle-steps` targets what the platform renders on every site with
its default theme (Boost): the session and the guest access; the Dashboard, My
courses and their blocks; the course page with its sections, activities and
completion; enrolment by a teacher and self enrolment with a key; the roles of
a participant; the assignment (a submission handed in, graded with feedback,
read back by the student), the quiz (an attempt, its review, the highest grade,
the attempts deleted by the teacher) and the forum (a discussion, a reply, a
discussion deleted); the gradebook (the grader report and the user report);
messages, notifications and the calendar; the search of the site
administration and course management; who may open a page; and the messages a
page shows, its toasts included. The steps are proven on the release package of
5.3 (5.3.1+), the current stable release, which is also a long-term support
line.

No step phrase names the platform: a scenario reads `Given I am a logged in user
with the "student" user` and `When I submit the text "My entry" for the
assignment "Testing diary"`.

Every step waits on the site's own signals, never on a clock: the list of
JavaScript work the site keeps (`M.util.pending_js`, the one its own test runner
waits on), its module loader, the parts of the page built with React, and the
requests the page sends on its own.

CI builds a real site with [DDEV](https://ddev.com) on the runner, from the
release package and with its own command-line installer, on two PHP versions,
and runs the whole suite against each, twice, on every push and pull request,
then the assertions that must fail; see
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and Node.js 20 or later with npm. PHP, the database and the mail catcher run in DDEV's containers.

**1. The site.** The pack's own build script (the one CI runs) makes the site in a DDEV project of type `php`: the release package of the current stable release in `moodle/`, served from `moodle/public`, its data folder `moodledata/` beside it (outside the web root), MariaDB 11.4, cron running in the web container, installed by the release's own `admin/cli/install.php`. Then it turns the guest login button on, turns the user tours off, makes the test course of [A test site](#a-test-site) and the five accounts of [Test users](#test-users). It takes about four minutes.

```bash
git clone https://github.com/webship/moodle-steps.git
SITE_DIR="$PWD/learning-site" moodle-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://moodlesteps.ddev.site`. Its accounts are `administrator`, `manager`, `teacher`, `student` and `student2`, each with the password `dD.123123ddd` (step 3 names them).

In the [Webship Workspace](https://github.com/webship/workspace), its Moodle plugin builds the same site instead, in a sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/` and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require moodle --with-needs
bash core/scripts/plugins.sh --activate moodle --with-needs
bash core/scripts/plugins.sh --install moodle
bash dev/cmd-moodle-project.sh mdlsite --install --add-users --test-course
```

That site answers at `https://mdlsite.ddev.site`. `--test-course` makes the same test course, with the same settings. Its accounts are the plugin's, the same five names, roles and full names with the workspace's shared password `dD.123123ddd`: `administrator`, `manager`, `teacher`, `student` and `student2` (step 3 names them). The workspace's own account is the installer's administrator; no feature logs in with it.

**2. A test project.**

```bash
mkdir moodle-tests && cd moodle-tests
npm init -y
npm install --save-dev webship-js @webship-js/moodle-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the paths (a feature named on the command line runs alone, as in the file `npx init-webship-js` writes), the tags that keep the assertions that must fail out of a normal run, the address of the site, and the accounts (the JSON of [Test users](#test-users)).

```javascript
// A feature or a scenario named on the command line runs alone (cucumber-js 12 would add it to the
// paths below): `npx cucumber-js tests/features/first-run.feature`.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/moodle-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://moodlesteps.ddev.site',
      // An account that logged in once keeps its session for the rest of the run.
      reuseSessions: true,
      // The browser logs "Failed to load resource: the server responded with a status of 404" for an
      // error page: not a fault of the site. The scenarios that open one carry @js-off.
      javascript: { mode: 'warn', levels: ['error'] },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        administrator: { username: 'administrator', password: 'dD.123123ddd', email: 'administrator@example.com', name: 'Administrator User' },
        manager: { username: 'manager', password: 'dD.123123ddd', email: 'manager@example.com', name: 'Manager User' },
        teacher: { username: 'teacher', password: 'dD.123123ddd', email: 'teacher@example.com', name: 'Teacher User' },
        student: { username: 'student', password: 'dD.123123ddd', email: 'student@example.com', name: 'Student User' },
        student2: { username: 'student2', password: 'dD.123123ddd', email: 'student2@example.com', name: 'Student2 User' },
      },
    },
  },
};
```

On a site from the Webship Workspace (step 1) the accounts are the same; its address goes in `LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A student opens the course
    Given I am a logged in user with the "student" user
    When I open the course "Software Testing 101"
    Then the section "Getting started" should list the activity "Testing diary"
    And the activity "Testing diary" should require "Make a submission"

  Scenario: A wrong password is refused
    Given I am an anonymous user
    When I log in with the username "student" and the password "wrong-password"
    Then I should see the error message "Your login info may be incorrect. Please try again."
    And I should not be logged in
```

**5. Run it.** Set `LAUNCH_URL` to the address of the site: `https://moodlesteps.ddev.site` for the build script's site, `https://mdlsite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://moodlesteps.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
10 steps (10 passed)
[webship-js] HTML report → …/moodle-tests/tests/reports/cucumber_report.html
```

`npx cucumber-js tests/features/first-run.feature` runs that feature alone.

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under `node_modules/@webship-js/moodle-steps/tests/features/`): together they use every step of the pack. They read no file of their own, and they run as they are on the site of either way of step 1.

### What the suite tests

The features of this repository run every step of the pack against the test site, twice in a row in CI on every change, then the assertions that must fail: logging in with the form, a wrong password and an account the site does not have (refused the same way), a visitor sent to the login form, each of the five accounts, logging out, the guest access; the course overview and the progress of a course, the timeline, a course an account is not in; the sections of the course and the activities of each, what completes each activity, an activity marked as done and undone by hand, a page completed by viewing it, the course menu, the enrolment options shown to an account that is not enrolled and to a guest; an account enrolled and unenrolled by the teacher, a second role given and taken back, a wrong enrolment key, self enrolment with the key and leaving the course; an assignment handed in, its notification, graded with feedback, the grade read back by the student, the grade cleared and the submission removed, a submission edited; a quiz answered right and wrong, its review, the highest grade, the attempts deleted by the teacher; a discussion posted, a reply, the discussion deleted by the teacher; a grade in the grader report and the user report; a message sent and read, a conversation deleted, the notifications, an event added to the calendar and deleted, the upcoming events; the search of the site administration and the value of a setting, course management, a course made and deleted by the manager; and who may open the site administration and course management.

Not tested: the platform's own tests (it has its own runner); completing a registration or making an account (the suite never creates one); the email the site sends (the suite reads the notifications inside the site); the forms that edit activities and course settings; the question bank; groups and groupings; badges, competencies and reports beyond the gradebook; the mobile app; another theme than Boost; a site in another language than English.

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A site of the 5.x line (proven on 5.3) with the default theme, and accounts on it for the suite

## Install

```bash
npm install --save-dev @webship-js/moodle-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/moodle-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the site and name the accounts the suite logs in with
   (see [Accounts](#accounts)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-site.ddev.site',
     loginPath: '/login/index.php',   // the login page
     users: {
       teacher: { username: 'teacher', password: process.env.TEACHER_PASSWORD, email: 'teacher@example.com', name: 'Teacher User' },
     },
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and replace the course, activities, names and texts with those of your site.

```gherkin
Feature: Who may open course management

  Scenario: Course management is for the administrator and the manager
    Then the access to "/course/management.php" should be:
      | account       | access  |
      | administrator | allowed |
      | manager       | allowed |
      | student       | denied  |
```

## What is included

| File | Steps | Covers |
| --- | --- | --- |
| `moodle-session.steps.js` | 9 | Login by a handle of the users registry (a session taken over when the account already has one), login through the form, login with a user name and a password, the guest login, logout, who is signed in, guest access, the login form. |
| `moodle-pages.steps.js` | 12 | The messages of a page by kind (alert boxes, the errors under fields, toasts), any message, no error; the wait on the page's own work; the Dashboard and My courses, the course overview and the progress of a course, the blocks of a page, the timeline; who may open a page, one account or a table of them. |
| `moodle-course.steps.js` | 10 | A course opened by its name, the course page and the enrolment options, the sections in order, the activities of a section, an activity opened, completion (done or not, the conditions, marked by hand), the pages of the course menu. |
| `moodle-enrolment.steps.js` | 9 | An account enrolled and unenrolled by a teacher, a participant, the roles of a participant given and taken back, self enrolment with a key (and its refusal), leaving a course. |
| `moodle-assignment.steps.js` | 7 | Online text handed in, the lines of the submission status, a submission removed, a grade (with feedback) given and cleared by a teacher, the grading summary, the grade a student reads. |
| `moodle-quiz.steps.js` | 7 | An attempt started, a question answered (choices, short answer), the attempt submitted, its review, how a question was marked, the highest grade, the attempts deleted by a teacher. |
| `moodle-forum.steps.js` | 5 | A discussion posted, a reply posted in place, the discussions of a forum, the replies of a discussion, a discussion deleted. |
| `moodle-grades.steps.js` | 2 | A grade in the grader report, a grade in the user report. |
| `moodle-messages.steps.js` | 9 | A message sent through the messaging drawer, a message received, a conversation deleted, the notifications (new or not) and marking them read, an event added to the calendar and deleted, the month view, the upcoming events. |
| `moodle-admin.steps.js` | 6 | The search of the site administration, a setting it finds and the value it holds, the courses of a category in course management, a course made and deleted. |
| `moodle-helpers.js` | | Shared plumbing for the files above and for your own steps: the wait on the site's own signals, the toast recorder, friendly errors (a request the browser cut says so), the users registry, the session cache and the login, the messages of a page, the course and activity lookups, tables, the rich text editor. It registers no step. |

Text, links, buttons, fields, cookies, the status code of a page and the
accessibility audit are webship-js's own steps (`I should see "..."`, `I fill
in "..." with "..."`, `I click the "..." button`, `the response status code
should be 200`, `the page should have no serious accessibility violations`):
this pack adds only what the platform decides.

## How the steps find things and wait

- **By what a person reads.** A course by its name, through the course search
  of the site; an activity by its name on the course page; a participant by
  their full name or address; a field by its label; a question by its text; a
  menu item by its words. The stable hooks of the pages are the fallback:
  `data-for="cmitem"` and `data-activityname` of an activity,
  `data-region="completionrequirements"`, `table#participants`,
  `table#user-grades`, `table.user-grade`, `[data-region="message-drawer"]`,
  `.form-item[id^="admin-"]`.
- **On the site's own signals.** After every action a step waits until the
  document is loaded, the site's list of pending JavaScript
  (`M.util.pending_js`) is empty, its module loader loads no module, every part
  of the page built with React is mounted (`data-react-mounted`), and no
  request of the page has been running for 200 ms. `When I wait for the page to
  be ready` is that wait, for a project's own steps. No step sleeps.
- **Toasts.** The short messages that close by themselves ("1 enrolled users",
  "The changes to the grade and feedback were saved") are recorded as they
  appear, so `I should see the message "..."` reads one after it closed.
- **The rich text editor.** A step types into the editor of a field the way a
  person does (into the editor itself), then checks what the editor holds.
- **The sticky parts of the theme.** An element is brought to the middle of the
  window before a click, so the fixed header never covers it.
- **Failures say what was found.** `Expected the section "Practice" to list
  "Testing diary", but it lists "Basics quiz", "Class discussion".` with a hint
  on where to look; a request the browser cut (the network of the machine
  changed) says so instead of blaming the scenario.

## Accounts

The suite never creates or deletes a user. Accounts are configuration: list
the ones the site has in `worldParameters.users`, by a handle the scenarios
use, each with its `username` and `password`, and its `email` and `name` (the
full name the site shows) where a step reads a list of people.

```javascript
users: {
  teacher: { username: 'teacher', password: process.env.TEACHER_PASSWORD, email: 'teacher@example.com', name: 'Teacher User' },
  student: { username: 'student', password: process.env.STUDENT_PASSWORD, email: 'student@example.com', name: 'Student User' },
},
```

An account that logged in once keeps its session for the rest of the run: a
later scenario that logs in as the same handle takes the session over instead
of filling in the login form again. `reuseSessions: false` in
`worldParameters` turns that off.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js`
lists them in `worldParameters.users` (the default values; the
`<HANDLE>_USERNAME`, `<HANDLE>_PASSWORD`, `<HANDLE>_EMAIL` and `<HANDLE>_NAME`
variables replace them, and `ACCOUNT_PASSWORD` every password at once).
[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
creates them on the local test site, and CI does the same on the runner. They are
placeholder credentials of that throwaway site, not of any real one.

```json
{
  "administrator": { "username": "administrator", "password": "dD.123123ddd", "email": "administrator@example.com", "name": "Administrator User" },
  "manager": { "username": "manager", "password": "dD.123123ddd", "email": "manager@example.com", "name": "Manager User" },
  "teacher": { "username": "teacher", "password": "dD.123123ddd", "email": "teacher@example.com", "name": "Teacher User" },
  "student": { "username": "student", "password": "dD.123123ddd", "email": "student@example.com", "name": "Student User" },
  "student2": { "username": "student2", "password": "dD.123123ddd", "email": "student2@example.com", "name": "Student2 User" }
}
```

`administrator` is a site administrator (the installer's account on the
script's site), `manager` has the Manager role on the whole site, `teacher` is a
Teacher (editing) and `student` a Student of the test course, and `student2` is
in no course: it enrols itself with the key.

## A test site

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
builds the site the suite of this repository runs against, the documented way:
a DDEV project of type `php` (Apache, as the documented DDEV way runs it),
MariaDB 11.4 (5.3 needs 11.4 or later), PHP 8.3 (`PHP_VERSION`), Node.js 24, the
release package of the stable branch (`MOODLE_BRANCH`, `503`; `MOODLE_VERSION`
pins a point release) unpacked in `moodle/` in the web container, served from
`moodle/public` (a release without a `public/` folder, 4.5, is served from
`moodle/`), `moodledata/` beside it, at least 5000 input variables, and cron
(`admin/cli/cron.php`) run again and again by the web container's own process
supervisor. The release's own installer (`admin/cli/install.php
--non-interactive`) writes `moodle/config.php` and the database. Then
[`site/test-site.php`](site/test-site.php), run with the site's own PHP:

- the settings the suite relies on: the guest login button shown, completion
  tracking on, no user tours (a tour opens a dialog over a page the first time an
  account sees it);
- the category "Test courses" with the course "Software Testing 101"
  (`TEST101`), completion on, its sections "Getting started", "Practice" and
  "Wrap-up", and in them the page "Course handbook" (completed by viewing it),
  the assignment "Testing diary" (online text, due in a week, feedback comments,
  completed by a submission), the quiz "Basics quiz" (three questions: true or
  false, multiple choice, short answer; completed by a grade) and the forum
  "Class discussion" (marked as done by hand); self enrolment with the key
  `TEST101-key`; no guest access to the course;
- the accounts of [Test users](#test-users), with their roles and enrolments.

```bash
SITE_DIR="$PWD/../learning-site" .github/scripts/build-ddev-site.sh
npm test
```

A new site of the 5.x line differs from an older one in two ways the steps
take in their stride: it asks every visitor to log in (`forcelogin`), and My
courses is off (`/my/courses.php` goes to the Dashboard, which carries the
course overview).

Nothing is installed that the release package does not bring: no plugin from
outside it, no paid service, no sign-in to any account.

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `moodle-admin.steps.js` (6)

- `I search the site administration for "guest login button"`
- `the site administration search should find the setting "Guest login button"`
- `the setting "Guest login button" should be "Show"`
- `the category "Test courses" should list the course "Software Testing 101"`
- `I create the course "Throwaway course" with the short name "THROW1" in the category "Test courses"`
- `I delete the course "Throwaway course" from the category "Test courses"`

### `moodle-assignment.steps.js` (7)

- `I submit the text "Found a defect in the login form." for the assignment "Testing diary"`
- `the "Submission status" of the assignment "Testing diary" should be "Submitted for grading"`
- `I remove my submission for the assignment "Testing diary"`
- `I grade "student" with "85" for the assignment "Testing diary"`
- `I clear the grade of "student" for the assignment "Testing diary"`
- `the "Needs grading" count of the assignment "Testing diary" should be "1"`
- `my grade for the assignment "Testing diary" should be "85.00 / 100.00"`

### `moodle-course.steps.js` (10)

- `I open the course "Software Testing 101"`
- `I should be on the course page`
- `I should see the enrolment options of the course`
- `the course sections should be:`
- `the section "Getting started" should list the activity "Testing diary"`
- `I open the activity "Testing diary"`
- `the activity "Course handbook" should be marked as done`
- `the activity "Course handbook" should require "View"`
- `I mark the activity "Class discussion" as done`
- `I go to the "Participants" page of the course`

### `moodle-enrolment.steps.js` (9)

- `I enrol "student2" in the course as "Student"`
- `I unenrol "student2" from the course`
- `"student" should be enrolled in the course`
- `"student" should have the role "Student" in the course`
- `I assign the role "Non-editing teacher" to "student" in the course`
- `I remove the role "Non-editing teacher" from "student" in the course`
- `I enrol myself in the course "Software Testing 101" with the key "TEST101-key"`
- `enrolling myself in the course "Software Testing 101" with the key "wrong-key" should be refused with "Incorrect enrolment key, please try again"`
- `I unenrol myself from the course "Software Testing 101"`

### `moodle-forum.steps.js` (5)

- `I post the discussion "A question about flaky tests" with the message "Why does a test pass here and fail in CI?" in the forum "Class discussion"`
- `I reply "Wait on the page, not on the clock." to the discussion "A question about flaky tests" in the forum "Class discussion"`
- `the forum "Class discussion" should list the discussion "A question about flaky tests"`
- `the discussion "A question about flaky tests" in the forum "Class discussion" should have the reply "Wait on the page, not on the clock."`
- `I delete the discussion "A question about flaky tests" from the forum "Class discussion"`

### `moodle-grades.steps.js` (2)

- `the grader report should show "85.00" for "student" in "Testing diary"`
- `my grade for "Testing diary" in the user report should be "85.00"`

### `moodle-messages.steps.js` (9)

- `I send the message "Hello, when is the next quiz?" to "teacher"`
- `I should have the message "Hello, when is the next quiz?" from "student"`
- `I delete my conversation with "teacher"`
- `I should have the notification "Welcome to Software Testing 101"`
- `I mark all my notifications as read`
- `I add the event "Study group" to my calendar`
- `my calendar should show the event "Study group"`
- `I delete the event "Study group" from my calendar`
- `the upcoming events should list "Testing diary is due"`

### `moodle-pages.steps.js` (12)

- `I should see the error message "Your login info may be incorrect. Please try again."`
- `I should see the message "1 enrolled users"`
- `I should not see any error message`
- `I wait for the page to be ready`
- `I go to my dashboard`
- `I go to my courses`
- `my courses should list "Software Testing 101"`
- `the course progress of "Software Testing 101" should be "0%"`
- `I should see the block "Timeline"`
- `the timeline should list "Testing diary"`
- `I should have access to "/course/management.php"`
- `the access to "/course/management.php" should be:`

### `moodle-quiz.steps.js` (7)

- `I start an attempt at the quiz "Basics quiz"`
- `I answer "True" to the question "Testing can show that defects are present."`
- `I submit the quiz attempt`
- `the "Grade" of the attempt should be "10.00 out of 10.00 (100%)"`
- `the question "Testing can show that defects are present." should be marked "Correct"`
- `my highest grade at the quiz "Basics quiz" should be "10.00 / 10.00"`
- `I delete the attempts of "student" at the quiz "Basics quiz"`

### `moodle-session.steps.js` (9)

- `I am a logged in user with the "student" user`
- `I log in as "student" with the login form`
- `I log in with the username "student" and the password "wrong-password"`
- `I log in as a guest`
- `I log out`
- `I should be logged in`
- `I should be logged in as "student"`
- `I should be logged in as a guest`
- `I should see the login form`

## Testing this package

```bash
npm install
SITE_DIR="$PWD/../learning-site" .github/scripts/build-ddev-site.sh
npm run test:examples      # the examples and the features against the step patterns
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
npm test                   # the suite, against the site
npm run test:must-fail     # assertions that must fail, each with its message
```

`LAUNCH_URL` points the suite at another site; `npx cucumber-js
tests/features/session.feature` runs one feature and `npx cucumber-js
tests/features/session.feature:<line>` one scenario (the line of its
`Scenario:`; the paths of `cucumber.js` are left out when the command line
names any); `FEATURES` runs a subset too
(`FEATURES=tests/features/session.feature npm test`); `CUCUMBER_TAGS=@critical`
runs the smoke lane; `HEADLESS=false` shows the browser.

`tests/must-fail/` holds scenarios that assert something that is not true on
the test site. `npm run test:must-fail` runs them and checks that each one
fails at its last step, with the message it announces and a hint: a step that
cannot fail proves nothing.

The suite leaves the site as it found it: what a scenario hands in, grades,
attempts, posts, enrols or adds, it takes back in the same scenario (the
student removes the submission, the teacher clears the grade and deletes the
attempts and the discussion, the event is deleted, the enrolment and the role
are undone), with one exception: viewing the course handbook completes it for
good, so the progress the course overview shows after it is the same on every
run. A run stopped half way can leave something behind; the build script makes
the test course again from nothing, and gives the accounts back their name,
password, roles and enrolments, without building anything else:

```bash
COURSE_ONLY=1 SITE_DIR="$PWD/../learning-site" .github/scripts/build-ddev-site.sh
ACCOUNTS_ONLY=1 SITE_DIR="$PWD/../learning-site" .github/scripts/build-ddev-site.sh
```

## How the steps were written

Every page a step touches was opened in a real browser first, and the step was
written from what is there: the roles and names of the accessibility tree, the
stable attributes, what the page does while it loads or saves, the exact
messages. The steps are proven on the release package 5.3.1+ with Boost, on PHP
8.3 and 8.4, in English, with Chromium.

Not covered: the editing forms of activities and courses, the question bank,
groups, badges, competencies, the reports beyond the gradebook, the mobile app,
other themes, other languages.

## License

MIT

## Logo

The Moodle logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The Moodle name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
