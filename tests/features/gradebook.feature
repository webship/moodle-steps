@gradebook
Feature: The gradebook
  As a teacher I want the grader report to show every grade of my students;
  as a student I want my user report to show my own grades

  Scenario: A grade shows in the grader report and in the student's user report, until it is cleared
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I grade "student" with "70" for the assignment "Testing diary"
    Then the grader report should show "70.00" for "student" in "Testing diary"
    And the grader report should show "-" for "student" in "Basics quiz"
    And the grader report should show "70.00" for "student" in "Course total"
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then my grade for "Testing diary" in the user report should be "70.00"
    And my grade for "Basics quiz" in the user report should be "-"
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I clear the grade of "student" for the assignment "Testing diary"
    Then the grader report should show "-" for "student" in "Testing diary"
