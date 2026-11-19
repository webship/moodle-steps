# Features

Reference features for the test site that `.github/scripts/build-ddev-site.sh`
builds: a new site from the release package with the test course
"Software Testing 101" and the five accounts of `cucumber.js`
(`administrator`, `manager`, `teacher`, `student`, `student2`). Copy a feature
into your project and replace the course, activities, names and texts with
those of your site.

| Feature | Covers |
| --- | --- |
| `session` | Logging in with the form, a wrong password, an account the site does not have, a visitor sent to the login form, each account, logging out, the guest access. |
| `dashboard` | The course overview and the progress of a course, the timeline, a course an account is not in. |
| `course` | The sections and their activities, what completes each activity, an activity marked as done and undone, a page completed by viewing it, the course menu, the enrolment options for an account that is not enrolled and for a guest. |
| `enrolment` | An account enrolled and unenrolled by the teacher, a second role given and taken back, a wrong enrolment key, self enrolment with the key and leaving the course. |
| `assignment` | Online text handed in, its notification, graded with feedback, the grade read by the student, the grade cleared and the submission removed; a submission edited. |
| `gradebook` | A grade in the grader report and in the student's user report, until it is cleared. |
| `quiz` | An attempt answered right and one answered wrong, the review, the highest grade, the attempts deleted by the teacher. |
| `forum` | A discussion posted by a student, a reply by the teacher, the discussion deleted by the teacher. |
| `messaging` | A message sent to the teacher and read, the conversations deleted, the notification of an enrolment. |
| `calendar` | An event added to the calendar and deleted, the upcoming events. |
| `administration` | The search of the site administration and the value of a setting, course management, a course made and deleted by the manager, who may open the site administration and course management. |

Scenarios that change something change it back in the same scenario: the
student removes the submission, the teacher clears the grade and deletes the
attempts and the discussion, the event, the enrolment, the role and the
conversations are undone. Viewing the course handbook completes it for good,
so the progress read after it is the same on every run. No scenario creates or
deletes a user.
