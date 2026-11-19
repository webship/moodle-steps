@must-fail
Feature: Session and page assertions that must fail
  Each scenario asserts something that is not true on the test site. tests/check-must-fail.js runs
  them and checks that each one fails at its last step, with the message its description announces
  and a hint. They only read: the site is left as it was.

  Scenario: A visitor is not logged in
    Fails with: Expected to be logged in, but
    Given I am an anonymous user
    Then I should be logged in

  Scenario: A student is logged in
    Fails with: Expected nobody to be logged in, but the user menu names "Student User".
    Given I am a logged in user with the "student" user
    Then I should not be logged in

  Scenario: The student is not the teacher
    Fails with: Expected "teacher" (Teacher User) to be logged in, but the user menu names "Student User".
    Given I am a logged in user with the "student" user
    Then I should be logged in as "teacher"

  Scenario: An account is not a guest
    Fails with: Expected guest access, but the user menu names "Student User".
    Given I am a logged in user with the "student" user
    Then I should be logged in as a guest

  Scenario: A signed-in page shows no login form
    Fails with: Expected the login form, but the page is
    Given I am a logged in user with the "student" user
    When I go to my dashboard
    Then I should see the login form

  Scenario: The login page shows no success message
    Fails with: Expected the success message "Welcome", but the page shows no message
    Given I am an anonymous user
    When I go to "/login/index.php"
    Then I should see the success message "Welcome"

  Scenario: A refused login shows an error, of no other kind
    Fails with: Expected the success message "Unable to log in", but the page shows error: "Unable to log in"
    Given I am an anonymous user
    When I log in with the username "student" and the password "wrong-password"
    Then I should see the success message "Unable to log in"

  Scenario: A refused login shows an error message
    Fails with: Expected no error message, but the page shows "Unable to log in"
    Given I am an anonymous user
    When I log in with the username "student" and the password "wrong-password"
    Then I should not see any error message

  Scenario: The dashboard shows no message of a kind it does not have
    Fails with: Expected the message "Course deleted", but the page shows no message
    Given I am a logged in user with the "student" user
    When I go to my dashboard
    Then I should see the message "Course deleted"

  Scenario: The student's courses do not list a course it is not in
    Fails with: Expected the course overview to list "No such course", but it lists "Software Testing 101".
    Given I am a logged in user with the "student" user
    When I go to my courses
    Then my courses should list "No such course"

  Scenario: The progress is not what the student did
    Fails with: Expected the progress of "Software Testing 101" to be 90%, but the course overview shows
    Given I am a logged in user with the "student" user
    When I go to my courses
    Then the course progress of "Software Testing 101" should be "90%"

  Scenario: The Dashboard has no such block
    Fails with: Expected the block "Weather forecast", but the page shows the blocks
    Given I am a logged in user with the "student" user
    When I go to my dashboard
    Then I should see the block "Weather forecast"

  Scenario: The timeline does not list an activity with nothing due
    Fails with: Expected the timeline to list "Class discussion", but it lists "Testing diary".
    Given I am a logged in user with the "student" user
    When I go to my dashboard
    Then the timeline should list "Class discussion"

  @js-off
  Scenario: A student may not open the site administration
    Fails with: Expected access to /admin/search.php, but it refused it with "Access denied"
    Given I am a logged in user with the "student" user
    Then I should have access to "/admin/search.php"

  Scenario: The administrator may open course management
    Fails with: Expected no access to /course/management.php, but it opened the page (HTTP 200).
    Given I am a logged in user with the "administrator" user
    Then I should not have access to "/course/management.php"

  @js-off
  Scenario: The table of who may open a page is checked row by row
    Fails with: The access to /admin/search.php differs for 1 of 2 rows: "student": expected allowed, but it refused it with "Access denied"
    Then the access to "/admin/search.php" should be:
      | account       | access  |
      | administrator | allowed |
      | student       | allowed |
