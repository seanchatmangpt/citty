Feature: Payment Processing
  As a marketplace customer
  I want to make payments securely and efficiently
  So that I can complete my purchases with confidence

  Background:
    Given the payment processing system is secure and operational
    And multiple payment methods are supported
    And fraud detection systems are active

  Scenario: Credit card payment processing
    Given I am at the payment step of checkout
    When I enter valid credit card information
    And I submit the payment
    Then the payment should be processed successfully
    And I should receive payment confirmation
    And the order should be created

  Scenario: Payment method validation
    Given I enter payment information
    When I use an invalid card number
    Then I should see an immediate validation error
    And the form should highlight the problematic field
    And I should be guided on how to correct it

  Scenario: Secure payment processing (PCI compliance)
    Given I am entering sensitive payment data
    When the payment form loads
    Then the connection should be encrypted (HTTPS)
    And card details should not be stored locally
    And the form should meet PCI DSS requirements

  Scenario: Multiple currency support
    Given I am shopping from different countries
    When I proceed to checkout
    Then I should see prices in my local currency
    And payment should be processed in appropriate currency
    And exchange rates should be current and fair

  Scenario: Digital wallet integration
    Given I have a digital wallet (PayPal, Apple Pay, Google Pay)
    When I choose to pay with my wallet
    Then I should be redirected to wallet authentication
    And payment should be processed seamlessly
    And I should return to confirmation page

  Scenario: Payment failure handling
    Given I attempt to make a payment
    When the payment fails due to insufficient funds
    Then I should receive a clear error message
    And I should be given alternative payment options
    And my cart should be preserved

  Scenario: Recurring payment setup
    Given I am purchasing a subscription
    When I set up recurring payments
    Then future payments should be automated
    And I should be notified before each charge
    And I should be able to modify or cancel anytime

  Scenario: Payment refund processing
    Given I need a refund for a purchase
    When the refund is approved
    Then the money should be returned to original payment method
    And I should receive confirmation of the refund
    And it should appear in my account within business days

  Scenario: Fraud detection and prevention
    Given suspicious payment activity is detected
    When I attempt to make a payment
    Then additional verification may be required
    And the transaction should be flagged for review
    And I should be notified of security measures

  Scenario: Payment splitting and installments
    Given I want to split my payment
    When I choose installment options
    Then I should see available plans
    And I should understand total cost including fees
    And payment schedule should be clearly outlined

  Scenario: B2B payment processing
    Given I am making a business purchase
    When I choose B2B payment options
    Then I should be able to use purchase orders
    And I should have net payment terms available
    And appropriate tax handling should be applied

  Scenario: Payment retry mechanism
    Given a payment fails due to temporary issues
    When the system detects a recoverable failure
    Then automatic retry should be attempted
    And I should be notified of retry attempts
    And manual retry option should be available

  Scenario: Payment audit trail
    Given payments are being processed
    When I need to review payment history
    Then I should see complete transaction logs
    And all payment attempts should be recorded
    And audit information should be detailed and searchable