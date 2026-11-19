@quiz
Feature: The quiz
  As a student I want to attempt a quiz and see how I did;
  as a teacher I want to be able to delete attempts

  # What a scenario attempts, the teacher deletes again.
  @critical
  Scenario: A student answers every question right
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    When I start an attempt at the quiz "Basics quiz"
    And I answer "True" to the question "Testing can show that defects are present."
    And I answer "Unit test" to the question "Which test checks the smallest testable part of the software?"
    And I answer "defect" to the question "In one word, what do testers call a flaw in the software?"
    And I submit the quiz attempt
    Then the "Status" of the attempt should be "Finished"
    And the "Marks" of the attempt should be "3.00/3.00"
    And the "Grade" of the attempt should be "10.00 out of 10.00 (100%)"
    And the question "Testing can show that defects are present." should be marked "Correct"
    And my highest grade at the quiz "Basics quiz" should be "10.00 / 10.00"
    And the activity "Basics quiz" should be marked as done
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I delete the attempts of "student" at the quiz "Basics quiz"
    Then the grader report should show "-" for "student" in "Basics quiz"

  Scenario: A wrong answer is marked incorrect
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    When I start an attempt at the quiz "Basics quiz"
    And I answer "False" to the question "1"
    And I answer "System test" to the question "2"
    And I answer "bug" to the question "3"
    And I submit the quiz attempt
    Then the question "1" should be marked "Incorrect"
    And the question "2" should be marked "Incorrect"
    And the question "3" should be marked "Correct"
    And the "Marks" of the attempt should be "1.00/3.00"
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I delete the attempts of "student" at the quiz "Basics quiz"
