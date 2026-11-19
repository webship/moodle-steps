@dashboard
Feature: The Dashboard and My courses
  As a student
  I want my Dashboard to list my courses and what is due
  So that I know where to go next

  # Viewing the course handbook completes it for good (a view cannot be taken back), so the progress
  # is read after a view: one activity of the four with completion conditions.
  @critical
  Scenario: The student's courses and their progress
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    And I open the activity "Course handbook"
    When I go to my courses
    Then my courses should list "Software Testing 101"
    And the course progress of "Software Testing 101" should be "25%"
    And I should see the block "Course overview"

  Scenario: The timeline lists the assignment that is due
    Given I am a logged in user with the "student" user
    When I go to my dashboard
    Then I should see the block "Timeline"
    And the timeline should list "Testing diary"

  Scenario: An account in no course has no course in its course overview
    Given I am a logged in user with the "student2" user
    When I go to my courses
    Then my courses should not list "Software Testing 101"
