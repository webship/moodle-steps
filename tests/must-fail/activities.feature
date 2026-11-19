@must-fail
Feature: Activity and gradebook assertions that must fail
  Each scenario asserts something that is not true on the test site (see session-and-pages.feature).

  Scenario: Nothing was handed in
    Fails with: Expected the "Submission status" of "Testing diary" to be "Submitted for grading", but it is "No submissions have been made yet".
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then the "Submission status" of the assignment "Testing diary" should be "Submitted for grading"

  Scenario: Nothing needs grading
    Fails with: Expected "Needs grading" of "Testing diary" to be 1, but the grading summary says 0.
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    Then the "Needs grading" count of the assignment "Testing diary" should be "1"

  Scenario: The assignment has no grade yet
    Fails with: The assignment page of "Testing diary" shows no grade yet
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then my grade for the assignment "Testing diary" should be "85.00 / 100.00"

  Scenario: The grader report shows no grade where there is none
    Fails with: Expected the grader report to show "85.00" for "student" in "Testing diary", but it shows "-".
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    Then the grader report should show "85.00" for "student" in "Testing diary"

  Scenario: The user report shows no grade where there is none
    Fails with: Expected my grade for "Testing diary" to be "85.00", but the user report shows "-".
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then my grade for "Testing diary" in the user report should be "85.00"

  Scenario: A quiz nobody attempted has no highest grade
    Fails with: The quiz "Basics quiz" shows no highest grade.
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then my highest grade at the quiz "Basics quiz" should be "10.00 / 10.00"

  Scenario: The review of an attempt is only on its own page
    Fails with: The review of the attempt has no "Grade".
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then the "Grade" of the attempt should be "10.00 out of 10.00 (100%)"

  Scenario: A question is only on the page of its quiz
    Fails with: The page has no question "1".
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then the question "1" should be marked "Correct"

  Scenario: The forum has no discussion yet
    Fails with: Expected the forum "Class discussion" to list "A question about flaky tests", but it lists (none).
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then the forum "Class discussion" should list the discussion "A question about flaky tests"
