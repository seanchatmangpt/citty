Feature: Product Listing and Discovery
  As a marketplace user
  I want to discover products efficiently
  So that I can find what I need to purchase

  Background:
    Given a marketplace with product catalog
    And products are indexed for search
    And category filters are available

  Scenario: Basic product search
    Given I am on the marketplace homepage
    When I search for "electronics"
    Then I should see relevant electronics products
    And products should be sorted by relevance
    And each product should display basic information

  Scenario: Category-based product filtering
    Given I am browsing the electronics category
    When I apply filters for "smartphones" under "mobile devices"
    Then I should see only smartphone products
    And the filter breadcrumb should show my selections
    And I should be able to clear individual filters

  Scenario: Advanced search with multiple criteria
    Given I am on the advanced search page
    When I set price range from $100 to $500
    And I select "4+ star rating" filter
    And I choose "free shipping" option
    Then I should see products matching all criteria
    And the result count should be displayed
    And I should be able to save this search

  Scenario: Product listing performance under load
    Given 10,000 concurrent users are browsing
    When they perform product searches simultaneously
    Then search results should load within 500ms
    And the system should remain responsive
    And no search requests should fail

  Scenario: Product availability real-time updates
    Given I am viewing a product listing
    When a product goes out of stock
    Then the listing should update within 2 seconds
    And the product should show as "Out of Stock"
    And I should have option to be notified when available

  Scenario: Personalized product recommendations
    Given I have a browsing history
    And I have made previous purchases
    When I visit the marketplace
    Then I should see personalized recommendations
    And recommendations should be relevant to my interests
    And I can indicate if recommendations are helpful

  Scenario Outline: Cross-platform product discovery
    Given I am using <device> with <browser>
    When I search for products
    Then the interface should be optimized for my device
    And all search functions should work properly
    And performance should meet <performance_target>

    Examples:
      | device  | browser | performance_target |
      | desktop | Chrome  | 300ms              |
      | mobile  | Safari  | 500ms              |
      | tablet  | Firefox | 400ms              |

  Scenario: Product comparison functionality
    Given I have selected multiple products
    When I click "Compare Products"
    Then I should see a comparison table
    And key features should be highlighted
    And I can add or remove products from comparison

  Scenario: Accessibility compliance for product discovery
    Given I am using screen reader technology
    When I navigate product listings
    Then all products should be properly labeled
    And navigation should be keyboard accessible
    And alternative text should be provided for images