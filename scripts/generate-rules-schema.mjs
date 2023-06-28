#!/usr/bin/env node

import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const response = await fetch("https://raw.githubusercontent.com/mlocati/php-cs-fixer-configurator/master/docs/data/3.20.0.json");

const body = await response.text();

let rulesProperties = {};

// Adding Laravel opinionated ones from https://github.com/laravel/pint/tree/main/app/Fixers
rulesProperties["Laravel/laravel_phpdoc_alignment"] = {
  description: "Aligns PHPDocs (@throws, @return, etc) using Laravel's opinionated style",
  type: "boolean"
};

function relativePath(fromPath) {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), fromPath);
}

function mapTypeToJsonSchema(type, defaultValueType) {
  if (type === 'bool') {
    return 'boolean';
  }

  if (type === "array" && defaultValueType === "object") {
    return "object";
  }

  return type;
}

function ruleIntoJsonSchemaProperty(rule) {
  const jsonSchemaProperty = {
    description: rule.summary
  };

  if (!('configuration' in rule)) {
    return jsonSchemaProperty;
  }

  if (rule.configuration.length > 0) {
    jsonSchemaProperty.type = 'object';
    
    jsonSchemaProperty.properties = {};
    
    rule.configuration.forEach(configItem => {
      jsonSchemaProperty.properties[configItem.name] = {};

      jsonSchemaProperty.properties[configItem.name].description = configItem.description;

      let defaultValueType = undefined;
      if ('defaultValue' in configItem) {
        jsonSchemaProperty.properties[configItem.name].default = configItem.defaultValue;

        if (configItem.defaultValue === null) {
          defaultValueType = 'null';
        } else if (typeof configItem.defaultValue === 'object') {
          if (!Array.isArray(configItem.defaultValue)) {
            defaultValueType = 'object';
          } else {
            defaultValueType = 'array';
          }
        } else {
          defaultValueType = typeof configItem.defaultValue;
        }
      }
      
      if ('allowedTypes' in configItem) {
        jsonSchemaProperty.properties[configItem.name].type =
          configItem.allowedTypes.length > 1
            ? configItem.allowedTypes.map((type) => mapTypeToJsonSchema(type, defaultValueType))
            : mapTypeToJsonSchema(configItem.allowedTypes[0], defaultValueType);
      }
      
      if ('allowedValues' in configItem) {
        jsonSchemaProperty.properties[configItem.name].oneOf = [
          {
            enum: configItem.allowedValues
          }
        ];
      }
    });
  }

  if ('allowedTypes' in rule.configuration) {
    jsonSchemaProperty.type = rule.configuration.allowedTypes;
  }

  if ('allowedValues' in rule.configuration) {
    if (!jsonSchemaProperty?.type) {
      jsonSchemaProperty.type = 'array';
    }

    jsonSchemaProperty.oneOf = rule.configuration.allowedValues;
  }

  return jsonSchemaProperty;
}

Object.entries(JSON.parse(body).fixers).forEach(rule => {
  rulesProperties[rule[0]] = ruleIntoJsonSchemaProperty(rule[1]);
});

const schemaContentPath = relativePath('../pint-schema.json');
let schemaContent = readFileSync(schemaContentPath, 'utf-8');

schemaContent = JSON.parse(schemaContent.toString());

schemaContent.properties.rules.properties = rulesProperties;

writeFileSync(
  schemaContentPath,
  JSON.stringify(schemaContent, null, 2),
  { encoding: 'utf-8' }
);