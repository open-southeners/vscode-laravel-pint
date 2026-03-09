import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  activateExtension,
  applyExtensionConfiguration,
  closeAllEditors,
  CUSTOM_EXPECTED,
  DEFAULT_EXPECTED,
  DEFAULT_SOURCE,
  openPhpDocument,
  readRuntimeMarker,
  readWorkspaceFile,
  resetWorkspace,
  waitForDocumentContents,
  waitForFileContents,
  WORKSPACE_FIRST_EXPECTED,
  WORKSPACE_FIRST_SOURCE,
  WORKSPACE_SECOND_EXPECTED,
  WORKSPACE_SECOND_SOURCE,
  writeWorkspaceFile
} from './helpers';

suite('Laravel Pint Extension', function () {
  this.timeout(20000);

  suiteSetup(async () => {
    await activateExtension();
  });

  setup(async () => {
    await closeAllEditors();
    await resetWorkspace();
    await applyExtensionConfiguration({});
  });

  test('formats the active file with the local workspace Pint binary', async () => {
    const document = await openPhpDocument('src/command.php');

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForFileContents('src/command.php', DEFAULT_EXPECTED);
    await waitForDocumentContents(document, DEFAULT_EXPECTED);

    const marker = await readRuntimeMarker('local');

    assert.ok(marker.args.some((arg) => arg.endsWith('command.php')));
    assert.ok(marker.args.includes('--repair'));
  });

  test('formats using a custom executable path and custom config path', async () => {
    await applyExtensionConfiguration({
      configPath: 'config/custom-pint.json',
      executablePath: 'tools/pint-custom',
      fallbackToGlobalBin: false
    });

    const document = await openPhpDocument('src/custom.php');

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForFileContents('src/custom.php', CUSTOM_EXPECTED);
    await waitForDocumentContents(document, CUSTOM_EXPECTED);

    const marker = await readRuntimeMarker('custom');

    assert.ok(marker.args.includes('--config'));
    assert.ok(marker.args.some((arg) => arg.endsWith('config/custom-pint.json')));
  });

  test('formats using the global Pint fallback when the local executable is missing', async () => {
    await applyExtensionConfiguration({
      executablePath: 'missing/bin/pint',
      fallbackToGlobalBin: true
    });

    const document = await openPhpDocument('src/global.php');

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForFileContents('src/global.php', DEFAULT_EXPECTED);
    await waitForDocumentContents(document, DEFAULT_EXPECTED);

    const marker = await readRuntimeMarker('global');

    assert.ok(marker.args.some((arg) => arg.endsWith('global.php')));
  });

  test('formats through the Sail executable when Sail mode is enabled', async () => {
    await applyExtensionConfiguration({
      runInLaravelSail: true
    });

    const document = await openPhpDocument('src/sail.php');

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForFileContents('src/sail.php', DEFAULT_EXPECTED);
    await waitForDocumentContents(document, DEFAULT_EXPECTED);

    const marker = await readRuntimeMarker('sail');

    assert.ok(marker.args.some((arg) => arg.endsWith('sail.php')));
  });

  test('formats all workspace PHP files with the workspace command', async () => {
    await openPhpDocument('src/workspace-first.php');

    await vscode.commands.executeCommand('laravel-pint.formatProject');

    await waitForFileContents('src/workspace-first.php', WORKSPACE_FIRST_EXPECTED);
    await waitForFileContents('src/workspace-second.php', WORKSPACE_SECOND_EXPECTED);
  });

  test('formats only dirty workspace files when dirtyOnly is enabled', async () => {
    await applyExtensionConfiguration({
      dirtyOnly: true
    });

    await writeWorkspaceFile('src/workspace-first.php', DEFAULT_SOURCE);
    await openPhpDocument('src/workspace-second.php');

    await vscode.commands.executeCommand('laravel-pint.formatProject');

    await waitForFileContents('src/workspace-first.php', DEFAULT_EXPECTED);

    const untouchedFile = await readWorkspaceFile('src/workspace-second.php');

    assert.strictEqual(untouchedFile, WORKSPACE_SECOND_SOURCE);
  });
});
