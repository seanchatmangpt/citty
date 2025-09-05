Feature: Shopping Cart and Checkout
  As a marketplace customer
  I want to manage items in my cart and complete purchases
  So that I can buy the products I need

  Background:
    Given I am logged into the marketplace
    And products are available for purchase
    And the shopping cart system is operational

  Scenario: Adding items to cart
    Given I am viewing a product page
    When I click "Add to Cart"
    Then the item should be added to my cart
    And the cart icon should show updated count
    And I should see a confirmation message

  Scenario: Updating item quantities in cart
    Given I have items in my cart
    When I change the quantity of an item
    Then the cart total should update automatically
    And inventory should be checked for availability
    And shipping costs should recalculate if applicable

  Scenario: Removing items from cart
    Given I have multiple items in my cart
    When I click "Remove" on an item
    Then the item should be removed from cart
    And the total should update immediately
    And I should be able to undo the removal

  Scenario: Cart persistence across sessions
    Given I have items in my cart
    When I log out and log back in
    Then my cart items should still be there
    And quantities should be preserved
    And any price changes should be reflected

  Scenario: Guest checkout process
    Given I am not logged in
    And I have items in my cart
    When I proceed to checkout
    Then I should have option for guest checkout
    And I should provide minimal required information
    And I should be able to create account during checkout

  Scenario: Express checkout with saved information
    Given I have saved payment and shipping information
    When I use express checkout
    Then I should complete purchase in under 30 seconds
    And all details should be pre-filled
    And I should only need to confirm the order

  Scenario: Cart abandonment recovery
    Given I have items in my cart but don't complete purchase
    When 24 hours pass
    Then I should receive an email reminder
    And the email should include cart contents
    And there should be a direct link to complete purchase

  Scenario: Inventory validation during checkout
    Given I have an item in my cart
    When the item goes out of stock during checkout
    Then I should be notified immediately
    And I should have options to wait or remove item
    And checkout should be blocked until resolved

  Scenario: Multiple payment methods
    Given I am at the payment step
    When I choose different payment methods
    Then credit cards, PayPal, and digital wallets should be accepted
    And payment processing should be secure
    And I should receive appropriate confirmation

  Scenario: Shipping options and calculations
    Given I have items ready for checkout
    When I enter my shipping address
    Then I should see available shipping options
    And costs should be calculated accurately
    And delivery estimates should be provided

  Scenario: Tax calculation accuracy
    Given I am checking out with items
    When I provide my billing address
    Then appropriate taxes should be calculated
    And tax breakdown should be clearly shown
    And total should include all applicable taxes

  Scenario: Order confirmation and receipt
    Given I have completed a purchase
    When the payment is processed
    Then I should receive an order confirmation
    And I should get a detailed receipt
    And I should be able to track the order

  Scenario: Mobile-responsive cart experience
    Given I am using a mobile device
    When I interact with the shopping cart
    Then all functions should work smoothly
    And the interface should be touch-friendly
    And performance should be optimized for mobile