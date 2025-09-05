Feature: User Registration and Authentication
  As a new marketplace user
  I want to register and authenticate securely
  So that I can access marketplace features

  Background:
    Given the marketplace registration system is available
    And security measures are in place
    And email verification service is running

  Scenario: Successful user registration
    Given I am on the registration page
    When I enter valid personal information
    And I choose a strong password
    And I agree to terms and conditions
    Then my account should be created
    And I should receive a confirmation email
    And I should be redirected to email verification page

  Scenario: Password strength validation
    Given I am registering a new account
    When I enter a password that is too weak
    Then I should see password strength indicators
    And I should receive specific improvement suggestions
    And registration should be blocked until password is strong

  Scenario: Email verification process
    Given I have registered but not verified my email
    When I click the verification link in my email
    Then my account should be activated
    And I should be automatically logged in
    And I should see a welcome message

  Scenario: Duplicate email prevention
    Given an account already exists with "test@example.com"
    When I try to register with the same email
    Then I should see an error message
    And I should be offered to reset password instead
    And the existing account should remain unaffected

  Scenario: Social media authentication
    Given I choose to register via social media
    When I complete OAuth with Google/Facebook/Apple
    Then my account should be created automatically
    And profile information should be pre-populated
    And I should be immediately logged in

  Scenario: Multi-factor authentication setup
    Given I have successfully registered
    When I access security settings
    Then I should be able to enable 2FA
    And I should receive setup instructions
    And backup codes should be provided

  Scenario: Account lockout protection
    Given I have entered incorrect passwords 5 times
    When I try to login again
    Then my account should be temporarily locked
    And I should receive an email notification
    And I should be able to unlock via email link

  Scenario: GDPR compliance during registration
    Given I am registering from an EU location
    When I complete the registration form
    Then I should see clear privacy policy
    And I should explicitly consent to data processing
    And I should have right to data deletion

  Scenario: Age verification for restricted categories
    Given I am accessing age-restricted products
    When I complete registration
    Then I should be prompted for age verification
    And appropriate verification method should be used
    And access should be granted only after verification

  Scenario: Registration form validation
    Given I am on the registration page
    When I submit incomplete or invalid data
    Then I should see field-specific error messages
    And the form should retain valid entries
    And I should be guided to correct errors

  Scenario: Account recovery setup
    Given I am completing registration
    When I reach security questions setup
    Then I should choose from predefined questions
    And I should set secure answers
    And alternative recovery methods should be offered