import assert from "node:assert/strict";
import test from "node:test";
import { ruleIntoJsonSchemaProperty, schemaFromType } from "./generate-rules-schema.mjs";

test("maps PHP array types to JSON Schema arrays", () => {
  assert.deepEqual(schemaFromType("int[]"), {
    type: "array",
    items: { type: "integer" }
  });

  assert.deepEqual(schemaFromType("string[][]"), {
    type: "array",
    items: {
      type: "array",
      items: { type: "string" }
    }
  });
});

test("constrains array items when upstream provides a list of allowed values", () => {
  const schema = ruleIntoJsonSchemaProperty({
    summary: "Test rule",
    configuration: [{
      name: "tokens",
      description: "Allowed tokens",
      allowedTypes: ["string[]"],
      allowedValues: [["attribute", "break"]]
    }]
  });

  assert.deepEqual(schema.properties.tokens, {
    description: "Allowed tokens",
    type: "array",
    items: {
      type: "string",
      enum: ["attribute", "break"]
    }
  });
});

test("keeps scalar allowed values as a property enum", () => {
  const schema = ruleIntoJsonSchemaProperty({
    summary: "Test rule",
    configuration: [{
      name: "strategy",
      description: "Strategy",
      allowedTypes: ["string"],
      allowedValues: ["first", "last"]
    }]
  });

  assert.deepEqual(schema.properties.strategy, {
    description: "Strategy",
    type: "string",
    enum: ["first", "last"]
  });
});
