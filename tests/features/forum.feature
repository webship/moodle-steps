@forum
Feature: The forum
  As a student I want to start a discussion and read the replies;
  as a teacher I want to reply, and to delete a discussion

  # What a scenario posts, the teacher deletes: a student cannot delete a post once anybody replied.
  @critical
  Scenario: A student asks, the teacher replies, the teacher deletes the discussion
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    When I post the discussion "A question about flaky tests" with the message "Why does a test pass on my machine and fail in CI?" in the forum "Class discussion"
    Then I should see the success message "Post added."
    And the forum "Class discussion" should list the discussion "A question about flaky tests"
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I reply "It usually depends on timing: wait on the page, not on the clock." to the discussion "A question about flaky tests" in the forum "Class discussion"
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then the discussion "A question about flaky tests" in the forum "Class discussion" should have the reply "wait on the page, not on the clock." from "teacher"
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I delete the discussion "A question about flaky tests" from the forum "Class discussion"
    Then I should see the success message "Discussion deleted"
    And the forum "Class discussion" should not list the discussion "A question about flaky tests"
