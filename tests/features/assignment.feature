@assignment
Feature: The assignment
  As a student I want to hand in my work, and as a teacher I want to grade it
  So that the student gets a grade and feedback

  # What a scenario hands in or grades, it takes back: the teacher clears the grade, the student
  # removes the submission.
  @critical
  Scenario: A student hands in online text, the teacher grades it, the student reads the grade
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    When I submit the text "Found a defect in the login form: it accepts an empty password." for the assignment "Testing diary"
    Then the "Submission status" of the assignment "Testing diary" should be "Submitted for grading"
    And the "Grading status" of the assignment "Testing diary" should be "Not graded"
    And the activity "Testing diary" should be marked as done
    And I should have the new notification "Assignment submission confirmation - Testing diary"
    When I mark all my notifications as read
    Then I should not have the new notification "Assignment submission confirmation - Testing diary"
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    Then the "Needs grading" count of the assignment "Testing diary" should be "1"
    When I grade "student" with "85" for the assignment "Testing diary" with the feedback "Well found."
    Then I should see the message "The changes to the grade and feedback were saved"
    And the "Needs grading" count of the assignment "Testing diary" should be "0"
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    Then my grade for the assignment "Testing diary" should be "85.00 / 100.00"
    And the "Grading status" of the assignment "Testing diary" should be "Graded"
    Given I am a logged in user with the "teacher" user
    And I open the course "Software Testing 101"
    When I clear the grade of "student" for the assignment "Testing diary"
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    When I remove my submission for the assignment "Testing diary"
    Then the "Submission status" of the assignment "Testing diary" should be "No submissions have been made yet"
    And the "Grading status" of the assignment "Testing diary" should be "Not graded"
    And the activity "Testing diary" should not be marked as done

  Scenario: A student edits the text handed in before it is graded
    Given I am a logged in user with the "student" user
    And I open the course "Software Testing 101"
    When I submit the text "A first entry." for the assignment "Testing diary"
    And I submit the text "A better entry." for the assignment "Testing diary"
    Then the "Online text" of the assignment "Testing diary" should be "A better entry."
    When I remove my submission for the assignment "Testing diary"
    Then the "Submission status" of the assignment "Testing diary" should be "No submissions have been made yet"
