Feature: Order Management
  As a marketplace customer and administrator
  I want to manage orders throughout their lifecycle
  So that I can track and fulfill purchases effectively

  Background:
    Given the order management system is operational
    And orders exist in various states
    And notification services are available

  Scenario: Order tracking for customers
    Given I have placed an order
    When I check my order status
    Then I should see current order state
    And I should see estimated delivery date
    And I should receive updates when status changes

  Scenario: Order history viewing
    Given I have multiple past orders
    When I access my order history
    Then I should see all my orders sorted by date
    And I should be able to filter by date range or status
    And I should be able to search for specific orders

  Scenario: Order cancellation by customer
    Given I have an order that hasn't shipped yet
    When I request order cancellation
    Then I should be able to cancel without penalty
    And I should receive full refund
    And I should get confirmation of cancellation

  Scenario: Order modification before shipping
    Given I have a pending order
    When I want to change shipping address
    Then I should be able to modify the address
    And the change should be reflected in the order
    And delivery estimate should be updated

  Scenario: Return and refund initiation
    Given I have received my order
    When I want to return an item
    Then I should be able to initiate return online
    And I should get a return shipping label
    And refund should process after item is received

  Scenario: Bulk order management for admin
    Given I am an administrator
    When I need to update multiple orders
    Then I should be able to select multiple orders
    And I should be able to apply bulk actions
    And changes should be applied to all selected orders

  Scenario: Order status workflow automation
    Given an order is placed
    When payment is confirmed
    Then the order should automatically move to processing
    And inventory should be reserved
    And fulfillment team should be notified

  Scenario: Real-time order updates
    Given I have an active order
    When the order status changes
    Then I should receive immediate notification
    And the change should reflect in my account
    And tracking information should be updated

  Scenario: Order dispute handling
    Given there is an issue with my order
    When I file a dispute
    Then a case should be created automatically
    And I should receive a case number
    And the dispute should be routed to appropriate team

  Scenario: Partial shipment management
    Given my order contains multiple items
    When only some items are available to ship
    Then I should be given options for partial shipment
    And I should see clear breakdown of what ships when
    And billing should be adjusted accordingly

  Scenario: Order export for accounting
    Given I need order data for business purposes
    When I request order export
    Then I should be able to download order data
    And the export should include all relevant details
    And data should be formatted for accounting software

  Scenario: Priority order processing
    Given an order is marked as priority
    When it enters the fulfillment queue
    Then it should be processed before standard orders
    And all teams should be notified of priority status
    And expedited shipping should be used

  Scenario: Order analytics and insights
    Given order data exists over time
    When I access order analytics
    Then I should see trends and patterns
    And I should get insights for business decisions
    And reports should be exportable