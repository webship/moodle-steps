@messaging
Feature: Messages and notifications
  As a student I want to message my teacher and read my notifications

  # Each account deletes its own copy of the conversation.
  Scenario: A student messages the teacher, who reads it
    Given I am a logged in user with the "student" user
    When I send the message "Hello, when does the next quiz open?" to "teacher"
    Given I am a logged in user with the "teacher" user
    Then I should have the message "Hello, when does the next quiz open?" from "student"
    When I delete my conversation with "student"
    Then I should not have the message "Hello, when does the next quiz open?" from "student"
    Given I am a logged in user with the "student" user
    When I delete my conversation with "teacher"

  Scenario: The enrolment of a student is notified
    Given I am a logged in user with the "student" user
    Then I should have the notification "Welcome to Software Testing 101"
