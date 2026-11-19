@enrolment
Feature: Enrolment and roles
  As a teacher I want to enrol people in my course and give them roles;
  as a student I want to enrol myself with the key I was given

  Scenario: The teacher enrols an account and unenrols it again
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I enrol "student2" in the course as "Student"
    Then I should see the message "1 enrolled users"
    And "student2" should be enrolled in the course
    And "student2" should have the role "Student" in the course
    When I unenrol "student2" from the course
    Then "student2" should not be enrolled in the course

  Scenario: The teacher gives a student a second role and takes it back
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I assign the role "Non-editing teacher" to "student" in the course
    Then "student" should have the role "Non-editing teacher" in the course
    And "student" should have the role "Student" in the course
    When I remove the role "Non-editing teacher" from "student" in the course
    Then "student" should not have the role "Non-editing teacher" in the course
    And "student" should have the role "Student" in the course

  Scenario: A wrong enrolment key is refused
    Given I am a logged in user with the "student2" user
    Then enrolling myself in the course "Software Testing 101" with the key "wrong-key" should be refused with "Incorrect enrolment key, please try again"

  Scenario: A student enrols with the key, then leaves the course
    Given I am a logged in user with the "student2" user
    When I enrol myself in the course "Software Testing 101" with the key "TEST101-key"
    Then I should be on the course page
    And I should see the success message "You are enrolled in the course."
    When I unenrol myself from the course "Software Testing 101"
    Then I should see the success message "You are unenrolled from the course"
    And my courses should not list "Software Testing 101"
