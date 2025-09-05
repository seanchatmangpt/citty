Feature: Risk Management Protocols
  As a risk manager
  I want comprehensive risk controls across all trading activities
  So that losses are limited and regulatory requirements are met

  Background:
    Given risk management systems are operational
    And risk limits are properly configured
    And monitoring dashboards are available
    And escalation procedures are defined

  Scenario: Position limit enforcement
    Given trading limits are set for each trader
    When a trader approaches their position limit
    Then warnings should be issued at 80% of limit
    And orders should be blocked at 100% of limit
    And risk managers should be immediately notified

  Scenario: Value-at-Risk (VaR) monitoring
    Given portfolio positions are marked-to-market
    When daily VaR calculations are performed
    Then risk exposure should be within approved limits
    And VaR breaches should trigger immediate alerts
    And portfolio adjustments should be recommended

  Scenario: Stop-loss order execution
    Given positions have predefined stop-loss levels
    When market prices breach stop levels
    Then automatic liquidation should occur immediately
    And slippage should be minimized through smart routing
    And execution should be confirmed within seconds

  Scenario: Concentration risk monitoring
    Given a diversified trading portfolio
    When concentration in any single position exceeds limits
    Then automatic rebalancing should be triggered
    And position sizes should be reduced accordingly
    And risk metrics should be recalculated

  Scenario: Liquidity risk assessment
    Given positions in various instruments
    When market liquidity deteriorates
    Then liquidity-adjusted VaR should be calculated
    And position sizing should reflect liquidity constraints
    And exit strategies should be prepared

  Scenario: Counterparty risk evaluation
    Given trading relationships with multiple counterparties
    When assessing counterparty creditworthiness
    Then exposure limits should be set for each counterparty
    And credit spreads should be monitored continuously
    And collateral requirements should be adjusted

  Scenario: Market risk scenario analysis
    Given current portfolio positions
    When running stress test scenarios
    Then portfolio performance should be projected
    And worst-case scenarios should be identified
    And hedging strategies should be recommended

  Scenario: Operational risk controls
    Given trading systems and processes
    When operational failures occur
    Then backup systems should activate automatically
    And trading should continue with minimal disruption
    And incident reports should be generated

  Scenario: Regulatory capital calculation
    Given trading and banking book positions
    When calculating regulatory capital requirements
    Then risk-weighted assets should be computed accurately
    And capital ratios should meet regulatory minimums
    And reporting should be timely and accurate

  Scenario: Dynamic hedging strategies
    Given options positions with Greeks exposure
    When market conditions change
    Then delta hedging should be adjusted continuously
    And gamma and vega exposures should be managed
    And hedging costs should be optimized

  Scenario: Credit risk mitigation
    Given exposure to credit-sensitive instruments
    When credit quality deteriorates
    Then positions should be reduced proactively
    And credit hedging instruments should be utilized
    And provisions should be calculated appropriately

  Scenario: Real-time risk dashboard
    Given multiple risk metrics need monitoring
    When risk managers access the dashboard
    Then all key metrics should be displayed clearly
    And alerts should be prioritized by severity
    And drill-down capabilities should be available

  Scenario: Risk limit breach escalation
    Given a significant risk limit breach occurs
    When the breach is detected
    Then immediate escalation should begin
    And senior management should be notified
    And remedial action should be taken within minutes