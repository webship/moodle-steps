@session
Feature: The session
  As a person with an account on the learning site
  I want to log in, see who I am, and log out
  So that my courses are mine and nobody else's

  @critical
  Scenario: A student logs in with the login form and lands on the Dashboard
    Given I am an anonymous user
    When I log in as "student" with the login form
    Then I should be logged in as "student"
    And I should be on "/my/"

  Scenario: A wrong password is refused with the site's own words
    Given I am an anonymous user
    When I log in with the username "student" and the password "wrong-password"
    Then I should see the error message "Your login info may be incorrect. Please try again."
    And I should see the login form
    And I should not be logged in

  Scenario: An account the site does not have is refused the same way
    Given I am an anonymous user
    When I log in with the username "no-such-account" and the password "Nothing-at-all-1!"
    Then I should see the error message "Unable to log in"
    And I should not be logged in

  Scenario: A visitor who opens a page of the site is sent to the login form
    Given I am an anonymous user
    When I go to "/my/"
    Then I should see the login form

  @critical
  Scenario Outline: The <account> account logs in
    Given I am a logged in user with the "<account>" user
    Then I should be logged in as "<account>"

    Examples:
      | account       |
      | administrator |
      | manager       |
      | teacher       |
      | student       |
      | student2      |

  Scenario: Logging out ends the session
    Given I am an anonymous user
    And I log in as "teacher" with the login form
    When I log out
    Then I should see the login form
    And I should not be logged in

  Scenario: A guest is let in with guest access, and is not an account
    Given I am an anonymous user
    When I log in as a guest
    Then I should be logged in as a guest
    And I should not be logged in
    And I should see "Dashboard (Guest)"
