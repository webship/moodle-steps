# Step definitions

| File | Covers |
| --- | --- |
| `moodle-session.steps.js` | The session: login by a handle of the users registry (a session taken over when the account already has one), login through the form, login with a user name and a password, the guest login, logout, who is signed in, guest access, the login form. |
| `moodle-pages.steps.js` | The messages of a page (alert boxes, the errors under fields, toasts), the wait on the page's own work, the Dashboard and My courses, the course overview and the progress of a course, the blocks of a page, the timeline, who may open a page. |
| `moodle-course.steps.js` | A course opened by its name, the course page and the enrolment options, the sections and their activities, an activity opened, completion, the course menu. |
| `moodle-enrolment.steps.js` | Participants, an account enrolled and unenrolled by a teacher, roles given and taken back, self enrolment with a key, leaving a course. |
| `moodle-assignment.steps.js` | Online text handed in, the submission status, a submission removed, a grade given and cleared, the grading summary, the grade a student reads. |
| `moodle-quiz.steps.js` | An attempt started, questions answered, the attempt submitted and reviewed, the highest grade, attempts deleted. |
| `moodle-forum.steps.js` | A discussion posted, a reply, the discussions of a forum, the replies of a discussion, a discussion deleted. |
| `moodle-grades.steps.js` | The grader report and the user report. |
| `moodle-messages.steps.js` | Messages through the messaging drawer, conversations, notifications, the calendar. |
| `moodle-admin.steps.js` | The search of the site administration, settings, course management. |
| `moodle-helpers.js` | Shared plumbing: the wait on the site's own signals, the toast recorder, friendly errors, the users registry, the session cache and the login, the messages of a page, the course and activity lookups, tables, the rich text editor. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill and see vocabulary already covers is not added here.
- No step phrase names the platform. A name appears only as an argument a step
  asserts.
- The regular expression starts with the pronoun group `(I |we )*` where a
  person acts (a phrase about "my" or "myself" takes "I" only), and an assertion
  takes `should( not)*`, so one definition reads both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Find things the way a person does: a name, a label, a role, a text. The stable
  hooks of the pages (`data-for`, `data-region`, `data-activityname`, the ids of
  the tables) are the fallback.
- Wait on the site, never on a fixed time: `pageReady` (the site's pending
  JavaScript, its module loader, React mounts, the page's own requests) after
  every action, and `eventually` for what an assertion reads.
- Fail with `failure(world, message, hint)`: what was expected, what was found
  and where to look; it says when the browser cut a request.
- A step never creates or deletes a user: accounts are configuration, named in
  the `users` registry of `cucumber.js` and created by the build of the site.
- What a step changes on the site, another step can change back, so a scenario
  leaves the site as it found it.
- Open the page in a real browser before writing or changing its step, and
  write the step from what is there.
- Give every assertion a scenario in `tests/must-fail/` that makes it fail.
