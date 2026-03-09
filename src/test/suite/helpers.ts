import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as assert from 'assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'open-southeners.laravel-pint';

export const DEFAULT_SOURCE = `<?php

function playground_example( ) {return ['hello'=>'world'];}
`;

export const DEFAULT_EXPECTED = `<?php

function playground_example()
{
    return ['hello' => 'world'];
}
`;

export const CUSTOM_EXPECTED = `<?php

function playground_example()
{
    return array('hello' => 'world');
}
`;

export const SAVE_SOURCE = `<?php

function save_example( ) {return ['save'=>'me'];}
`;

export const SAVE_EXPECTED = `<?php

function save_example()
{
    return ['save' => 'me'];
}
`;

export const WORKSPACE_FIRST_SOURCE = `<?php

function workspace_first( ) {return ['first'=>'value'];}
`;

export const WORKSPACE_FIRST_EXPECTED = `<?php

function workspace_first()
{
    return ['first' => 'value'];
}
`;

export const WORKSPACE_SECOND_SOURCE = `<?php

function workspace_second( ) {return ['second'=>'value'];}
`;

export const WORKSPACE_SECOND_EXPECTED = `<?php

function workspace_second()
{
    return ['second' => 'value'];
}
`;

function getWorkspaceRoot() {
  const workspaceRoot = process.env.TEST_PLAYGROUND_WORKSPACE;

  assert.ok(workspaceRoot, 'TEST_PLAYGROUND_WORKSPACE is not set.');

  return workspaceRoot;
}

export function workspaceFile(...segments: string[]) {
  return path.join(getWorkspaceRoot(), ...segments);
}

export async function activateExtension() {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);

  assert.ok(extension, `Extension "${EXTENSION_ID}" is not available.`);

  await extension.activate();
}

export async function resetWorkspace() {
  const workspaceRoot = getWorkspaceRoot();

  execFileSync('git', ['reset', '--hard', 'HEAD'], {
    cwd: workspaceRoot,
    stdio: 'ignore'
  });

  execFileSync('git', ['clean', '-fd'], {
    cwd: workspaceRoot,
    stdio: 'ignore'
  });

  await fs.rm(workspaceFile('.runtime'), { recursive: true, force: true });
  await fs.mkdir(workspaceFile('.runtime'), { recursive: true });
}

export async function applyExtensionConfiguration(overrides: Partial<{
  configPath: string;
  dirtyOnly: boolean;
  executablePath: string;
  fallbackToGlobalBin: boolean;
  runInLaravelSail: boolean;
  sailExecutablePath: string;
}>) {
  const config = vscode.workspace.getConfiguration('laravel-pint');
  const rootConfig = vscode.workspace.getConfiguration();
  const phpValidateConfig = vscode.workspace.getConfiguration('php.validate');

  await config.update('enable', true, vscode.ConfigurationTarget.Workspace);
  await config.update('enableDebugLogs', true, vscode.ConfigurationTarget.Workspace);
  await config.update('configPath', overrides.configPath ?? 'pint.json', vscode.ConfigurationTarget.Workspace);
  await config.update('dirtyOnly', overrides.dirtyOnly ?? false, vscode.ConfigurationTarget.Workspace);
  await config.update('executablePath', overrides.executablePath ?? 'vendor/bin/pint', vscode.ConfigurationTarget.Workspace);
  await config.update('fallbackToGlobalBin', overrides.fallbackToGlobalBin ?? true, vscode.ConfigurationTarget.Workspace);
  await config.update('runInLaravelSail', overrides.runInLaravelSail ?? false, vscode.ConfigurationTarget.Workspace);
  await config.update('sailExecutablePath', overrides.sailExecutablePath ?? 'vendor/bin/sail', vscode.ConfigurationTarget.Workspace);

  /* eslint-disable @typescript-eslint/naming-convention */
  await rootConfig.update('[php]', {
    'editor.defaultFormatter': EXTENSION_ID,
    'editor.formatOnSave': true
  }, vscode.ConfigurationTarget.Workspace);
  /* eslint-enable @typescript-eslint/naming-convention */
  await phpValidateConfig.update('executablePath', 'php', vscode.ConfigurationTarget.Workspace);

  await delay(300);
}

export async function openPhpDocument(relativePath: string) {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(workspaceFile(relativePath)));

  await vscode.window.showTextDocument(document);
  await delay(300);

  return document;
}

export async function replaceDocumentContents(document: vscode.TextDocument, content: string) {
  const editor = vscode.window.activeTextEditor;

  assert.ok(editor, 'An active editor is required.');

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, content);
  });
}

export async function readWorkspaceFile(relativePath: string) {
  return fs.readFile(workspaceFile(relativePath), 'utf8');
}

export async function writeWorkspaceFile(relativePath: string, content: string) {
  await fs.writeFile(workspaceFile(relativePath), content, 'utf8');
}

export async function waitForFileContents(relativePath: string, expected: string, timeoutMs = 15000) {
  await waitForCondition(
    async () => (await readWorkspaceFile(relativePath)) === expected,
    `Timed out waiting for "${relativePath}" to match expected contents.`,
    timeoutMs
  );
}

export async function waitForDocumentContents(document: vscode.TextDocument, expected: string, timeoutMs = 15000) {
  await waitForCondition(
    async () => document.getText() === expected,
    `Timed out waiting for document "${document.uri.fsPath}" to match expected contents.`,
    timeoutMs
  );
}

export async function waitForFormattingEdits(document: vscode.TextDocument, timeoutMs = 15000) {
  let lastEdits: vscode.TextEdit[] | undefined;

  await waitForCondition(async () => {
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
      'vscode.executeFormatDocumentProvider',
      document.uri
    );

    lastEdits = edits;

    return !!edits && edits.length > 0;
  }, `Timed out waiting for formatting edits for "${document.uri.fsPath}".`, timeoutMs);

  return lastEdits ?? [];
}

export async function readRuntimeMarker(mode: 'custom' | 'global' | 'local' | 'sail') {
  const runtimeMarkerPath = workspaceFile('.runtime', `${mode}.json`);

  await waitForCondition(
    async () => {
      try {
        await fs.access(runtimeMarkerPath);
        return true;
      } catch {
        return false;
      }
    },
    `Timed out waiting for "${mode}" runtime marker.`
  );

  return JSON.parse(await fs.readFile(runtimeMarkerPath, 'utf8')) as {
    args: string[];
    cwd: string;
    mode: string;
  };
}

export async function closeAllEditors() {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

export async function delay(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForCondition(
  condition: () => Promise<boolean>,
  errorMessage: string,
  timeoutMs = 15000
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }

    await delay(200);
  }

  throw new Error(errorMessage);
}
