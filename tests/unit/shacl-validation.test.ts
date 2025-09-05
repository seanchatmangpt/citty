/**
 * SHACL Validation Tests for Real Implementations
 * Tests constraint validation against actual SHACL engines
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as rdfParser from '@rdfjs/parser-turtle';
import * as N3 from 'n3';
import { SHACLValidator } from 'rdf-validate-shacl';
import { Readable } from 'stream';

interface ValidationResult {
  conforms: boolean;
  report: any;
  violations: Array<{
    focusNode: string;
    resultPath: string;
    resultMessage: string;
    resultSeverity: string;
  }>;
}

class RealSHACLValidator {
  private validator: SHACLValidator | null = null;

  async loadShapes(shapesGraph: string): Promise<void> {
    const parser = new N3.Parser();
    const store = new N3.Store();
    
    try {
      const quads = parser.parse(shapesGraph);
      store.addQuads(quads);
      this.validator = new SHACLValidator(store);
    } catch (error) {
      throw new Error(`Failed to parse SHACL shapes: ${error}`);
    }
  }

  async validate(dataGraph: string): Promise<ValidationResult> {
    if (!this.validator) {
      throw new Error('No shapes loaded. Call loadShapes() first.');
    }

    const parser = new N3.Parser();
    const dataStore = new N3.Store();
    
    try {
      const quads = parser.parse(dataGraph);
      dataStore.addQuads(quads);
      
      const report = await this.validator.validate(dataStore);
      
      // Extract violations from the validation report
      const violations = this.extractViolations(report);
      
      return {
        conforms: report.conforms,
        report: report,
        violations: violations
      };
    } catch (error) {
      throw new Error(`Validation failed: ${error}`);
    }
  }

  private extractViolations(report: any): Array<{
    focusNode: string;
    resultPath: string;
    resultMessage: string;
    resultSeverity: string;
  }> {
    const violations: Array<{
      focusNode: string;
      resultPath: string;
      resultMessage: string;
      resultSeverity: string;
    }> = [];

    if (report.results) {
      for (const result of report.results) {
        violations.push({
          focusNode: result.focusNode?.value || 'unknown',
          resultPath: result.path?.value || 'unknown',
          resultMessage: result.message?.[0]?.value || 'No message',
          resultSeverity: result.severity?.value || 'sh:Violation'
        });
      }
    }

    return violations;
  }
}

describe('SHACL Validation with Real Implementation', () => {
  let validator: RealSHACLValidator;
  let tempDir: string;

  beforeEach(async () => {
    validator = new RealSHACLValidator();
    tempDir = join(tmpdir(), `shacl-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic Shape Validation', () => {
    it('should validate required properties constraints', async () => {
      const shapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PersonShape a sh:NodeShape ;
            sh:targetClass ex:Person ;
            sh:property [
                sh:path ex:name ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
            ] ;
            sh:property [
                sh:path ex:age ;
                sh:datatype xsd:integer ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
                sh:minInclusive 0 ;
                sh:maxInclusive 150 ;
            ] .
      `;

      const validData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:john a ex:Person ;
            ex:name "John Doe" ;
            ex:age 30 .
      `;

      await validator.loadShapes(shapes);
      const result = await validator.validate(validData);

      expect(result.conforms).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect missing required properties', async () => {
      const shapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PersonShape a sh:NodeShape ;
            sh:targetClass ex:Person ;
            sh:property [
                sh:path ex:name ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
                sh:message "Name is required" ;
            ] ;
            sh:property [
                sh:path ex:email ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
                sh:message "Email is required" ;
            ] .
      `;

      const invalidData = `
        @prefix ex: <http://example.org/> .

        ex:john a ex:Person ;
            ex:name "John Doe" .
            # Missing required email
      `;

      await validator.loadShapes(shapes);
      const result = await validator.validate(invalidData);

      expect(result.conforms).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      
      const emailViolation = result.violations.find(v => 
        v.resultPath.includes('email') || v.resultMessage.includes('Email')
      );
      expect(emailViolation).toBeDefined();
      expect(emailViolation?.resultMessage).toContain('required');
    });

    it('should validate datatype constraints', async () => {
      const shapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PersonShape a sh:NodeShape ;
            sh:targetClass ex:Person ;
            sh:property [
                sh:path ex:age ;
                sh:datatype xsd:integer ;
                sh:minInclusive 0 ;
                sh:message "Age must be a non-negative integer" ;
            ] ;
            sh:property [
                sh:path ex:email ;
                sh:datatype xsd:string ;
                sh:pattern "^[\\w\\._%+-]+@[\\w\\.-]+\\.[A-Za-z]{2,}$" ;
                sh:message "Invalid email format" ;
            ] .
      `;

      const invalidData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:john a ex:Person ;
            ex:age -5 ;  # Invalid negative age
            ex:email "invalid-email" .  # Invalid email format
      `;

      await validator.loadShapes(shapes);
      const result = await validator.validate(invalidData);

      expect(result.conforms).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);

      // Should have violations for both age and email
      const ageViolation = result.violations.find(v => 
        v.resultPath.includes('age') || v.resultMessage.includes('Age')
      );
      const emailViolation = result.violations.find(v => 
        v.resultPath.includes('email') || v.resultMessage.includes('email')
      );

      expect(ageViolation).toBeDefined();
      expect(emailViolation).toBeDefined();
    });
  });

  describe('Advanced Shape Constraints', () => {
    it('should validate node shape targeting', async () => {
      const shapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:EmployeeShape a sh:NodeShape ;
            sh:targetClass ex:Employee ;
            sh:property [
                sh:path ex:employeeId ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
                sh:pattern "^EMP[0-9]{4}$" ;
                sh:message "Employee ID must be in format EMP####" ;
            ] ;
            sh:property [
                sh:path ex:department ;
                sh:class ex:Department ;
                sh:minCount 1 ;
                sh:message "Employee must belong to a department" ;
            ] .

        ex:DepartmentShape a sh:NodeShape ;
            sh:targetClass ex:Department ;
            sh:property [
                sh:path ex:name ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
                sh:message "Department must have a name" ;
            ] .
      `;

      const validData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:dept1 a ex:Department ;
            ex:name "Engineering" .

        ex:emp1 a ex:Employee ;
            ex:employeeId "EMP0001" ;
            ex:department ex:dept1 .
      `;

      await validator.loadShapes(shapes);
      const result = await validator.validate(validData);

      expect(result.conforms).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should validate complex logical constraints', async () => {
      const shapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PersonShape a sh:NodeShape ;
            sh:targetClass ex:Person ;
            sh:or (
                [
                    sh:property [
                        sh:path ex:phone ;
                        sh:datatype xsd:string ;
                        sh:minCount 1 ;
                    ]
                ]
                [
                    sh:property [
                        sh:path ex:email ;
                        sh:datatype xsd:string ;
                        sh:minCount 1 ;
                    ]
                ]
            ) ;
            sh:message "Person must have either phone or email" .
      `;

      // Test with phone only - should be valid
      const validDataPhone = `
        @prefix ex: <http://example.org/> .
        
        ex:john a ex:Person ;
            ex:name "John Doe" ;
            ex:phone "123-456-7890" .
      `;

      // Test with email only - should be valid  
      const validDataEmail = `
        @prefix ex: <http://example.org/> .
        
        ex:jane a ex:Person ;
            ex:name "Jane Doe" ;
            ex:email "jane@example.com" .
      `;

      // Test with neither - should be invalid
      const invalidData = `
        @prefix ex: <http://example.org/> .
        
        ex:bob a ex:Person ;
            ex:name "Bob Smith" .
      `;

      await validator.loadShapes(shapes);

      const result1 = await validator.validate(validDataPhone);
      expect(result1.conforms).toBe(true);

      const result2 = await validator.validate(validDataEmail);
      expect(result2.conforms).toBe(true);

      const result3 = await validator.validate(invalidData);
      expect(result3.conforms).toBe(false);
      expect(result3.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Validation Scenarios', () => {
    it('should validate command ontology constraints', async () => {
      const commandShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix cmd: <http://example.org/commands#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        cmd:CommandShape a sh:NodeShape ;
            sh:targetClass cmd:Command ;
            sh:property [
                sh:path rdfs:label ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
                sh:message "Command must have exactly one label" ;
            ] ;
            sh:property [
                sh:path cmd:hasArgument ;
                sh:class cmd:Argument ;
                sh:message "Command arguments must be of type Argument" ;
            ] ;
            sh:property [
                sh:path cmd:category ;
                sh:datatype xsd:string ;
                sh:in ( "development" "deployment" "testing" "utility" ) ;
                sh:message "Command category must be one of the allowed values" ;
            ] .

        cmd:ArgumentShape a sh:NodeShape ;
            sh:targetClass cmd:Argument ;
            sh:property [
                sh:path rdfs:label ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
                sh:message "Argument must have a label" ;
            ] ;
            sh:property [
                sh:path cmd:type ;
                sh:datatype xsd:string ;
                sh:in ( "string" "integer" "boolean" "array" ) ;
                sh:minCount 1 ;
                sh:message "Argument type must be specified and valid" ;
            ] ;
            sh:property [
                sh:path cmd:required ;
                sh:datatype xsd:boolean ;
                sh:maxCount 1 ;
                sh:message "Required flag must be boolean" ;
            ] .
      `;

      const validCommandData = `
        @prefix cmd: <http://example.org/commands#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        cmd:BuildCommand a cmd:Command ;
            rdfs:label "Build Command" ;
            cmd:category "development" ;
            cmd:hasArgument cmd:target, cmd:verbose .

        cmd:target a cmd:Argument ;
            rdfs:label "Build target" ;
            cmd:type "string" ;
            cmd:required true .

        cmd:verbose a cmd:Argument ;
            rdfs:label "Verbose output" ;
            cmd:type "boolean" ;
            cmd:required false .
      `;

      await validator.loadShapes(commandShapes);
      const result = await validator.validate(validCommandData);

      expect(result.conforms).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect command ontology constraint violations', async () => {
      const commandShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix cmd: <http://example.org/commands#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        cmd:CommandShape a sh:NodeShape ;
            sh:targetClass cmd:Command ;
            sh:property [
                sh:path rdfs:label ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
                sh:message "Command must have a label" ;
            ] ;
            sh:property [
                sh:path cmd:category ;
                sh:in ( "development" "deployment" "testing" ) ;
                sh:message "Invalid command category" ;
            ] .
      `;

      const invalidCommandData = `
        @prefix cmd: <http://example.org/commands#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        cmd:BadCommand a cmd:Command ;
            cmd:category "invalid-category" .
            # Missing required label
      `;

      await validator.loadShapes(commandShapes);
      const result = await validator.validate(invalidCommandData);

      expect(result.conforms).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);

      // Should have violations for missing label and invalid category
      const labelViolation = result.violations.find(v => 
        v.resultMessage.includes('label')
      );
      const categoryViolation = result.violations.find(v => 
        v.resultMessage.includes('category')
      );

      expect(labelViolation).toBeDefined();
      expect(categoryViolation).toBeDefined();
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle malformed SHACL shapes gracefully', async () => {
      const malformedShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:BadShape a sh:NodeShape
            sh:targetClass ex:Person ;
            # Missing semicolon and malformed syntax
      `;

      await expect(async () => {
        await validator.loadShapes(malformedShapes);
      }).rejects.toThrow();
    });

    it('should handle malformed data gracefully', async () => {
      const validShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
            sh:targetClass ex:Person .
      `;

      const malformedData = `
        @prefix ex: <http://example.org/> .
        
        ex:john a ex:Person
            # Missing semicolon
      `;

      await validator.loadShapes(validShapes);
      
      await expect(async () => {
        await validator.validate(malformedData);
      }).rejects.toThrow();
    });

    it('should handle large datasets efficiently', async () => {
      const shapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PersonShape a sh:NodeShape ;
            sh:targetClass ex:Person ;
            sh:property [
                sh:path ex:name ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
            ] .
      `;

      // Generate a larger dataset
      let largeData = `@prefix ex: <http://example.org/> .\n`;
      for (let i = 0; i < 100; i++) {
        largeData += `ex:person${i} a ex:Person ; ex:name "Person ${i}" .\n`;
      }

      await validator.loadShapes(shapes);
      
      const startTime = Date.now();
      const result = await validator.validate(largeData);
      const duration = Date.now() - startTime;

      expect(result.conforms).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Integration with File System', () => {
    it('should validate shapes and data from files', async () => {
      const shapesContent = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PersonShape a sh:NodeShape ;
            sh:targetClass ex:Person ;
            sh:property [
                sh:path ex:name ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
            ] .
      `;

      const dataContent = `
        @prefix ex: <http://example.org/> .
        
        ex:alice a ex:Person ;
            ex:name "Alice Smith" .
      `;

      const shapesFile = join(tempDir, 'shapes.ttl');
      const dataFile = join(tempDir, 'data.ttl');

      await writeFile(shapesFile, shapesContent);
      await writeFile(dataFile, dataContent);

      const shapesFromFile = await readFile(shapesFile, 'utf-8');
      const dataFromFile = await readFile(dataFile, 'utf-8');

      await validator.loadShapes(shapesFromFile);
      const result = await validator.validate(dataFromFile);

      expect(result.conforms).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});