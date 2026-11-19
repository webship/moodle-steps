@calendar
Feature: The calendar
  As a student I want my own events and the due dates of my course in my calendar

  Scenario: A student adds an event to the calendar and deletes it
    Given I am a logged in user with the "student" user
    When I add the event "Study group" to my calendar
    Then my calendar should show the event "Study group"
    When I delete the event "Study group" from my calendar
    Then my calendar should not show the event "Study group"

  Scenario: The due date of an assignment is an upcoming event
    Given I am a logged in user with the "student" user
    Then the upcoming events should list "Testing diary is due"
    And the upcoming events should not list "Study group"
