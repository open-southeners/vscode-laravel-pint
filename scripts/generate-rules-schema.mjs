#!/usr/bin/env node

import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const CONFIGURATOR_DATA_API_URL = "https://api.github.com/repos/mlocati/php-cs-fixer-configurator/contents/docs/data?ref=main";
const CONFIGURATOR_DATA_RAW_URL = "https://raw.githubusercontent.com/mlocati/php-cs-fixer-configurator/main/docs/data";
const PINT_PRESETS_API_URL = "https://api.github.com/repos/laravel/pint/contents/resources/presets?ref=main";
const REQUEST_HEADERS = {
  "Accept": "application/vnd.github+json",
  "User-Agent": "open-southeners-vscode-laravel-pint-schema-generator"
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error(`Request failed for "${url}" with status ${response.status}`);
  }

  return response.json();
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}

async function getLatestPhpCsFixerConfiguratorVersion() {
  const files = await fetchJson(CONFIGURATOR_DATA_API_URL);

  return files
    .map((file) => file.name.match(/^(\d+\.\d+\.\d+)\.json$/)?.[1])
    .filter(Boolean)
    .sort(compareVersions)
    .at(-1);
}

async function getLatestPintPresets() {
  const files = await fetchJson(PINT_PRESETS_API_URL);

  return files
    .filter((file) => file.name.endsWith(".php"))
    .map((file) => file.name.replace(/\.php$/, ""))
    .sort();
}

function relativePath(fromPath) {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), fromPath);
}

function splitTopLevel(value, separator) {
  const parts = [];
  let current = "";
  let genericDepth = 0;
  let insideString = false;

  for (const character of value) {
    if (character === "'") {
      insideString = !insideString;
      current += character;
      continue;
    }

    if (!insideString) {
      if (character === "<") {
        genericDepth += 1;
      } else if (character === ">") {
        genericDepth -= 1;
      } else if (character === separator && genericDepth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }

    current += character;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
}

function normalizePhpType(type) {
  switch (type) {
    case "array":
      return "array";
    case "bool":
      return "boolean";
    case "class-string":
      return "string";
    case "float":
      return "number";
    case "int":
      return "integer";
    case "null":
      return "null";
    case "object":
      return "object";
    case "scalar":
      return ["string", "number", "boolean"];
    case "string":
      return "string";
    default:
      return undefined;
  }
}

function schemaFromType(type) {
  const trimmedType = type.trim();

  if (trimmedType.startsWith("?")) {
    return {
      oneOf: [
        schemaFromType(trimmedType.slice(1)),
        { type: "null" }
      ]
    };
  }

  const unionTypes = splitTopLevel(trimmedType, "|");
  if (unionTypes.length > 1) {
    const enumValues = unionTypes
      .map((unionType) => unionType.match(/^'([^']+)'$/)?.[1])
      .filter(Boolean);

    if (enumValues.length === unionTypes.length) {
      return { enum: enumValues };
    }

    return {
      oneOf: unionTypes.map(schemaFromType)
    };
  }

  if (trimmedType.endsWith("[]")) {
    return {
      type: "array",
      items: schemaFromType(trimmedType.slice(0, -2))
    };
  }

  if (trimmedType.startsWith("array<") && trimmedType.endsWith(">")) {
    const genericTypes = splitTopLevel(trimmedType.slice(6, -1), ",");

    if (genericTypes.length === 2) {
      return {
        type: "object",
        additionalProperties: schemaFromType(genericTypes[1])
      };
    }
  }

  const enumValue = trimmedType.match(/^'([^']+)'$/)?.[1];
  if (enumValue) {
    return { enum: [enumValue] };
  }

  const normalizedType = normalizePhpType(trimmedType);
  if (normalizedType) {
    return { type: normalizedType };
  }

  return {};
}

function schemaFromAllowedTypes(allowedTypes) {
  if (allowedTypes.length === 1) {
    return schemaFromType(allowedTypes[0]);
  }

  return {
    oneOf: allowedTypes.map(schemaFromType)
  };
}

function normalizeDefaultValue(defaultValue, allowedTypes = []) {
  if (
    Array.isArray(defaultValue)
    && defaultValue.length === 0
    && allowedTypes.some((allowedType) => allowedType.startsWith("array<"))
  ) {
    return {};
  }

  return defaultValue;
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

      if ('defaultValue' in configItem) {
        jsonSchemaProperty.properties[configItem.name].default = normalizeDefaultValue(
          configItem.defaultValue,
          configItem.allowedTypes ?? []
        );
      }
      
      if ('allowedTypes' in configItem) {
        Object.assign(
          jsonSchemaProperty.properties[configItem.name],
          schemaFromAllowedTypes(configItem.allowedTypes)
        );
      }
      
      if ('allowedValues' in configItem) {
        jsonSchemaProperty.properties[configItem.name].enum = configItem.allowedValues;
      }
    });
  }

  if ('allowedTypes' in rule.configuration) {
    Object.assign(jsonSchemaProperty, schemaFromAllowedTypes(rule.configuration.allowedTypes));
  }

  if ('allowedValues' in rule.configuration) {
    jsonSchemaProperty.enum = rule.configuration.allowedValues;
  }

  return jsonSchemaProperty;
}

const latestConfiguratorVersion = await getLatestPhpCsFixerConfiguratorVersion();
if (!latestConfiguratorVersion) {
  throw new Error("Unable to resolve the latest php-cs-fixer-configurator dataset version.");
}

const [configuratorData, pintPresets] = await Promise.all([
  fetchJson(`${CONFIGURATOR_DATA_RAW_URL}/${latestConfiguratorVersion}.json`),
  getLatestPintPresets()
]);

const rulesProperties = {};

Object.entries(configuratorData.fixers).forEach(rule => {
  rulesProperties[rule[0]] = ruleIntoJsonSchemaProperty(rule[1]);
});

const schemaContentPath = relativePath('../pint-schema.json');
let schemaContent = readFileSync(schemaContentPath, 'utf-8');

schemaContent = JSON.parse(schemaContent.toString());

schemaContent.properties.preset.oneOf[0].enum = pintPresets;
schemaContent.properties.rules.properties = rulesProperties;

writeFileSync(
  schemaContentPath,
  JSON.stringify(schemaContent, null, 2),
  { encoding: 'utf-8' }
);

console.log(`Updated Pint schema using php-cs-fixer-configurator ${latestConfiguratorVersion}`);
