@administration
Feature: The site administration
  As an administrator I want to find a setting by its words, and to manage the courses;
  as a manager I want to make and remove courses, without the site settings

  Scenario: The search of the site administration finds a setting and its value
    Given I am a logged in user with the "administrator" user
    When I search the site administration for "guest login button"
    Then the site administration search should find the setting "Guest login button"
    And the setting "Guest login button" should be "Show"

  Scenario: Course management lists the test course in its category
    Given I am a logged in user with the "administrator" user
    Then the category "Test courses" should list the course "Software Testing 101"
    And the category "Category 1" should not list the course "Software Testing 101"

  Scenario: A manager makes a course and deletes it again
    Given I am a logged in user with the "manager" user
    When I create the course "Throwaway course" with the short name "THROW1" in the category "Test courses"
    Then the category "Test courses" should list the course "Throwaway course"
    When I delete the course "Throwaway course" from the category "Test courses"
    Then the category "Test courses" should not list the course "Throwaway course"

  @js-off
  Scenario: Who may open the site administration and course management
    Then the access to "/admin/search.php" should be:
      | account       | access  |
      | administrator | allowed |
      | teacher       | denied  |
      | student       | denied  |
      | visitor       | login   |
    And the access to "/course/management.php" should be:
      | account       | access  |
      | administrator | allowed |
      | manager       | allowed |
      | student       | denied  |
