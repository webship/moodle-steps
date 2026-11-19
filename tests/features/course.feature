@course
Feature: The course page
  As a student of a course
  I want its sections, its activities and what each of them asks of me
  So that I can work through the course

  @critical
  Scenario: The sections and the activities of the course
    Given I am a logged in user with the "student" user
    When I open the course "Software Testing 101"
    Then I should be on the course page
    And the course sections should be:
      | General         |
      | Getting started |
      | Practice        |
      | Wrap-up         |
    And the section "General" should list the activity "Announcements"
    And the section "Getting started" should list the activity "Course handbook"
    And the section "Getting started" should list the activity "Testing diary"
    And the section "Practice" should list the activity "Basics quiz"
    And the section "Practice" should list the activity "Class discussion"
    And the section "Practice" should not list the activity "Testing diary"

  Scenario: Each activity says what completes it
    Given I am a logged in user with the "student" user
    When I open the course "Software Testing 101"
    Then the activity "Course handbook" should require "View"
    And the activity "Testing diary" should require "Make a submission"
    And the activity "Basics quiz" should require "Receive a grade"
    And the activity "Testing diary" should not be marked as done

  Scenario: An activity is marked as done by hand, and undone
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    When I mark the activity "Class discussion" as done
    Then I should see the message "Class discussion marked as done."
    And the activity "Class discussion" should be marked as done
    When I mark the activity "Class discussion" as not done
    Then I should see the message "Class discussion marked as undone."
    And the activity "Class discussion" should not be marked as done

  Scenario: Viewing a page completes it
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    When I open the activity "Course handbook"
    Then I should see "How this course works"
    And the activity "Course handbook" should be marked as done

  Scenario: The course menu leads to the participants
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I go to the "Participants" page of the course
    Then "student" should be enrolled in the course
    And "teacher" should be enrolled in the course

  Scenario: An account that is not enrolled is shown the enrolment options
    Given I am a logged in user with the "student2" user
    When I open the course "Software Testing 101"
    Then I should not be on the course page
    And I should see the enrolment options of the course

  Scenario: A guest cannot open the course
    Given I am an anonymous user
    And I log in as a guest
    When I open the course "Software Testing 101"
    Then I should see the enrolment options of the course
    And I should see the information message "Guests cannot access this course. Please log in."
