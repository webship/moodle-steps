@must-fail
Feature: Message, calendar and administration assertions that must fail
  Each scenario asserts something that is not true on the test site (see session-and-pages.feature).

  Scenario: The teacher has no conversation with the student
    Fails with: Expected a conversation with Student User, but the messaging drawer lists
    Given I am a logged in user with the "teacher" user
    Then I should have the message "Hello" from "student"

  Scenario: The student has no such notification
    Fails with: Expected the notification "Your course was deleted", but the notifications menu holds
    Given I am a logged in user with the "student" user
    Then I should have the notification "Your course was deleted"

  Scenario: The calendar has no such event
    Fails with: Expected the calendar to show "Study group", but this month shows
    Given I am a logged in user with the "student" user
    Then my calendar should show the event "Study group"

  Scenario: The upcoming events do not list an event that is not there
    Fails with: Expected the upcoming events to list "Study group", but they list "Testing diary is due".
    Given I am a logged in user with the "student" user
    Then the upcoming events should list "Study group"

  Scenario: The search finds no setting for words no setting has
    Fails with: Expected the search to find the setting "Guest login button", but it finds (none)
    Given I am a logged in user with the "administrator" user
    When I search the site administration for "no setting is called like this"
    Then the site administration search should find the setting "Guest login button"

  Scenario: The guest login button is shown on the test site
    Fails with: Expected the setting "Guest login button" to be "Hide", but it is "Show".
    Given I am a logged in user with the "administrator" user
    When I search the site administration for "guest login button"
    Then the setting "Guest login button" should be "Hide"

  Scenario: The test course is in its own category only
    Fails with: Expected the category "Category 1" to list "Software Testing 101", but it lists (none).
    Given I am a logged in user with the "administrator" user
    Then the category "Category 1" should list the course "Software Testing 101"
