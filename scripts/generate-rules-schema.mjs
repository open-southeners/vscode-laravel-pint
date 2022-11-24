import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const response = await fetch("https://raw.githubusercontent.com/mlocati/php-cs-fixer-configurator/master/docs/data/3.13.0.json");

const body = await response.text();

let rulesProperties = {};

function relativePath(fromPath) {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), fromPath);
}

function mapTypeToJsonSchema(type) {
  if (type === 'bool') {
    return 'boolean';
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

  if (rule.configuration.length > 1) {
    jsonSchemaProperty.type = 'object';
    
    jsonSchemaProperty.properties = {};
    
    rule.configuration.forEach(configItem => {
      jsonSchemaProperty.properties[configItem.name] = {};

      jsonSchemaProperty.properties[configItem.name].description = configItem.description;

      if ('defaultValue' in configItem) {
        jsonSchemaProperty.properties[configItem.name].default = configItem.defaultValue;
      }
      
      if ('allowedTypes' in configItem) {
        jsonSchemaProperty.properties[configItem.name].type = configItem.allowedTypes.length > 1
            ? configItem.allowedTypes.map(mapTypeToJsonSchema)
            : mapTypeToJsonSchema(configItem.allowedTypes[0]);
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
