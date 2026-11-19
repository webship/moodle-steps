@must-fail
Feature: Course and enrolment assertions that must fail
  Each scenario asserts something that is not true on the test site (see session-and-pages.feature).

  Scenario: An account that is not enrolled is not on the course page
    Fails with: Expected the page of "Software Testing 101", but the browser is on
    Given I am a logged in user with the "student2" user
    When I open the course "Software Testing 101"
    Then I should be on the course page

  Scenario: An enrolled student goes to the course page, not to the enrolment options
    Fails with: Expected the enrolment options of "Software Testing 101", but the browser is on
    Given I am a logged in user with the "student" user
    When I open the course "Software Testing 101"
    Then I should see the enrolment options of the course

  Scenario: The sections are in their own order
    Fails with: Expected the sections "General", "Practice", "Getting started", "Wrap-up", in that order, but the course page shows "General", "Getting started", "Practice", "Wrap-up".
    Given I am a logged in user with the "student" user
    When I open the course "Software Testing 101"
    Then the course sections should be:
      | General         |
      | Practice        |
      | Getting started |
      | Wrap-up         |

  Scenario: An activity is in its own section only
    Fails with: Expected the section "Practice" to list "Testing diary", but it lists "Basics quiz", "Class discussion".
    Given I am a logged in user with the "student" user
    When I open the course "Software Testing 101"
    Then the section "Practice" should list the activity "Testing diary"

  Scenario: An assignment nobody submitted is not done
    Fails with: Expected "Testing diary" to be marked as done, but the course page shows "To do".
    Given I am a logged in user with the "student" user
    When I open the course "Software Testing 101"
    Then the activity "Testing diary" should be marked as done

  Scenario: An activity requires only its own condition
    Fails with: Expected "Testing diary" to require "Receive a grade", but its completion conditions are "Make a submission".
    Given I am a logged in user with the "student" user
    When I open the course "Software Testing 101"
    Then the activity "Testing diary" should require "Receive a grade"

  Scenario: The account in no course is not a participant
    Fails with: Expected "student2" to be enrolled in "Software Testing 101", but the participants table lists
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    Then "student2" should be enrolled in the course

  Scenario: The student has the Student role only
    Fails with: Expected "student" to have the role "Non-editing teacher", but its roles are "Student".
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    Then "student" should have the role "Non-editing teacher" in the course

  Scenario: The right key is not refused
    Fails with: Expected the refusal "Incorrect enrolment key, please try again", but the browser went to
    Given I am a logged in user with the "student" user
    Then enrolling myself in the course "Software Testing 101" with the key "TEST101-key" should be refused with "Incorrect enrolment key, please try again"
