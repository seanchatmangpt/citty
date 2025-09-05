Feature: Citty Pro Framework
  As a CLI developer
  I want to use Citty Pro framework features
  So that I can build production-grade CLI applications with advanced capabilities

  Background:
    Given I have imported the Citty Pro framework
    And I have registered core hooks
    And I have initialized the context

  Scenario: Define and execute a simple task
    Given I define a task with id "greet"
    And the task accepts a name parameter
    When I call the task with input "World"
    Then the task should return "Hello, World!"
    And the "task:will:call" hook should have been triggered
    And the "task:did:call" hook should have been triggered

  Scenario: Define and run a workflow with multiple steps
    Given I define a task "fetch-data" that returns mock data
    And I define a task "transform-data" that processes input
    And I define a workflow with both tasks in sequence
    When I run the workflow
    Then each task should be executed in order
    And the workflow state should contain results from both tasks
    And all task hooks should be triggered

  Scenario: Execute CLI lifecycle with hooks
    Given I have a command with lifecycle support
    And I have registered a plugin that tracks events
    When I run the command with arguments
    Then the following hooks should be called in order:
      | hook                | 
      | cli:boot           |
      | config:load        |
      | ctx:ready          |
      | args:parsed        |
      | command:resolved   |
      | workflow:compile   |
      | output:will:emit   |
      | output:did:emit    |
      | persist:will       |
      | persist:did        |
      | report:will        |
      | report:did         |
      | cli:done           |

  Scenario: AI wrapper command with tool calling
    Given I define an AI wrapper command "analyze"
    And the command has AI tools configured
    And I mock the AI generate function
    When I execute the AI wrapper command
    Then the AI generate function should be called
    And tool calls should be handled
    And the command should return the expected output

  Scenario: Plugin system with OTEL integration
    Given I register the OTEL plugin
    And I configure tracing and metrics
    When I execute a command with tasks
    Then spans should be created for each task
    And metrics should be recorded
    And the telemetry data should be exported

  Scenario: Context management with unctx
    Given I create a context with session data
    And I run operations within the context
    When I access context from nested functions
    Then the context should be available throughout the call stack
    And context modifications should be isolated

  Scenario: Task validation with Zod schemas
    Given I define a task with input validation schema
    And I define output validation schema
    When I call the task with invalid input
    Then the task should throw a validation error
    When I call the task with valid input
    Then the task should execute successfully
    And the output should be validated

  Scenario: Error handling in lifecycle
    Given I have a command that throws an error
    When I run the command
    Then the error should be caught
    And error hooks should be triggered
    And the error output should be emitted
    And the process should exit with error code

  Scenario: Workflow with conditional steps
    Given I define a workflow with conditional logic
    And I set up steps with selectors
    When I run the workflow with different inputs
    Then only relevant steps should execute
    And the final state should reflect the execution path

  Scenario: Performance benchmarking
    Given I have tasks with different complexities
    When I run performance benchmarks
    Then execution times should be measured
    And memory usage should be tracked
    And benchmark reports should be generated