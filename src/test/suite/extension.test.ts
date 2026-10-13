import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  activateExtension,
  applyExtensionConfiguration,
  BLADE_EXPECTED,
  BLADE_SOURCE,
  closeAllEditors,
  CUSTOM_EXPECTED,
  DEFAULT_EXPECTED,
  DEFAULT_SOURCE,
  openPhpDocument,
  openBladeDocument,
  monorepoLaravelFile,
  readRuntimeMarker,
  replaceDocumentContents,
  readWorkspaceFile,
  resetWorkspace,
  waitForDocumentContents,
  waitForFileContents,
  waitForFormattingEdits,
  WORKSPACE_FIRST_EXPECTED,
  WORKSPACE_SECOND_EXPECTED,
  WORKSPACE_SECOND_SOURCE,
  workspaceFile,
  writeWorkspaceFile
} from './helpers';

function normalizePathSeparators(value: string) {
  return value.replace(/\\/g, '/');
}

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

  test('formats the active file with the local workspace Pint binary through the manual command', async () => {
    const document = await openPhpDocument('src/command.php');

    await replaceDocumentContents(document, DEFAULT_SOURCE.replace('example( )', 'example(  )'));
    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForDocumentContents(document, DEFAULT_EXPECTED);
    assert.strictEqual(await readWorkspaceFile('src/command.php'), DEFAULT_SOURCE);

    const marker = await readRuntimeMarker('local');

    assert.ok(marker.args.includes('-'));
    assert.ok(marker.args.includes('--stdin-filename'));
    assert.ok(marker.args.includes('--repair'));
  });

  test('falls back to php when php.validate.executablePath is unset (#72)', async function () {
    if (process.platform !== 'win32') {
      this.skip();
    }

    await applyExtensionConfiguration({ phpValidateExecutablePath: null });
    const document = await openPhpDocument('src/command.php');

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForDocumentContents(document, DEFAULT_EXPECTED);
  });

  test('runs through a Herd-style php.bat executable on Windows (#72)', async function () {
    if (process.platform !== 'win32') {
      this.skip();
    }

    await applyExtensionConfiguration({
      phpValidateExecutablePath: workspaceFile('bin', 'php.bat')
    });
    const document = await openPhpDocument('src/command.php');

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForDocumentContents(document, DEFAULT_EXPECTED);
  });

  test('formats using a custom executable path and custom config path', async () => {
    await applyExtensionConfiguration({
      configPath: 'config/custom-pint.json',
      executablePath: 'tools/pint-custom',
      fallbackToGlobalBin: false
    });

    const document = await openPhpDocument('src/custom.php');

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForDocumentContents(document, CUSTOM_EXPECTED);

    const marker = await readRuntimeMarker('custom');

    assert.ok(marker.args.includes('--config'));
    assert.ok(marker.args.some((arg) => normalizePathSeparators(arg).endsWith('config/custom-pint.json')));
  });

  test('provides Blade formatting when enabled and Pint advertises --blade support', async () => {
    await applyExtensionConfiguration({
      executablePath: 'tools/pint-blade',
      fallbackToGlobalBin: false,
      formatBlade: true
    });
    await writeWorkspaceFile('resources/views/example.blade.php', BLADE_SOURCE);

    const document = await openBladeDocument('resources/views/example.blade.php');
    const edits = await waitForFormattingEdits(document);

    assert.ok(edits.length > 0);

    const marker = await readRuntimeMarker('blade');

    assert.ok(marker.args.includes('--blade'));
    assert.ok(marker.args.includes('-'));
    assert.ok(marker.args.includes('--stdin-filename'));
    assert.ok(marker.args.some((arg) => normalizePathSeparators(arg).endsWith('/resources/views/example.blade.php')));

    await vscode.commands.executeCommand('laravel-pint.format');
    await waitForDocumentContents(document, BLADE_EXPECTED);
  });

  test('leaves Blade files and workspace formatting untouched when Blade formatting is disabled', async () => {
    await applyExtensionConfiguration({
      executablePath: 'tools/pint-blade',
      fallbackToGlobalBin: false
    });
    await writeWorkspaceFile('resources/views/disabled.blade.php', BLADE_SOURCE);

    const document = await openBladeDocument('resources/views/disabled.blade.php');
    await vscode.commands.executeCommand('laravel-pint.format');

    assert.strictEqual(document.getText(), BLADE_SOURCE);

    await openPhpDocument('src/workspace-first.php');
    await vscode.commands.executeCommand('laravel-pint.formatProject');

    const marker = await readRuntimeMarker('blade');

    assert.ok(!marker.args.includes('--blade'));
  });

  test('leaves Blade files untouched when using an older Pint release', async () => {
    await applyExtensionConfiguration({ formatBlade: true });
    await writeWorkspaceFile('resources/views/legacy.blade.php', BLADE_SOURCE);

    const document = await openBladeDocument('resources/views/legacy.blade.php');
    await vscode.commands.executeCommand('laravel-pint.format');

    assert.strictEqual(document.getText(), BLADE_SOURCE);

    const marker = await readRuntimeMarker('local');

    assert.deepStrictEqual(marker.args, ['--help']);
  });

  test('enables Blade when formatting a workspace with a compatible Pint release', async () => {
    await applyExtensionConfiguration({
      executablePath: 'tools/pint-blade',
      fallbackToGlobalBin: false,
      formatBlade: true
    });
    await openPhpDocument('src/workspace-first.php');

    await vscode.commands.executeCommand('laravel-pint.formatProject');

    const marker = await readRuntimeMarker('blade');

    assert.ok(marker.args.includes('--blade'));
    assert.ok(marker.args.some((arg) => normalizePathSeparators(arg).endsWith('/playground/workspace')));
  });

  test('uses folder-scoped executable settings in a multi-root monorepo (#75)', async () => {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(monorepoLaravelFile('src', 'monorepo.php')));

    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForDocumentContents(document, CUSTOM_EXPECTED);

    const marker = await readRuntimeMarker('custom');

    assert.strictEqual(marker.mode, 'custom');
  });

  test('does not exclude app-modules when Pint excludes the app directory', async () => {
    await writeWorkspaceFile('pint.json', JSON.stringify({ exclude: ['app'] }));

    const document = await openPhpDocument('app-modules/format.php');
    await replaceDocumentContents(document, DEFAULT_SOURCE);

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForDocumentContents(document, DEFAULT_EXPECTED);
  });

  test('formats using the global Pint fallback when the local executable is missing', async () => {
    await applyExtensionConfiguration({
      executablePath: 'missing/bin/pint',
      fallbackToGlobalBin: true
    });

    const document = await openPhpDocument('src/global.php');

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForDocumentContents(document, DEFAULT_EXPECTED);

    const marker = await readRuntimeMarker('global');

    assert.ok(marker.args.includes('--repair'));
  });

  test('formats through the Sail executable when Sail mode is enabled', async () => {
    await applyExtensionConfiguration({
      runInLaravelSail: true
    });

    const document = await openPhpDocument('src/sail.php');

    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForDocumentContents(document, DEFAULT_EXPECTED);

    const marker = await readRuntimeMarker('sail');

    assert.ok(marker.args.includes('--repair'));
  });

  test('formats through docker exec when Docker mode is enabled', async () => {
    await applyExtensionConfiguration({
      dockerContainerName: 'laravel.test',
      dockerContainerRootPath: '/var/www/html',
      dockerExecutablePath: workspaceFile('bin', process.platform === 'win32' ? 'docker.cmd' : 'docker'),
      runInDocker: true
    });

    const document = await openPhpDocument('src/docker.php');

    await replaceDocumentContents(document, DEFAULT_SOURCE);
    await vscode.commands.executeCommand('laravel-pint.format');

    await waitForDocumentContents(document, DEFAULT_EXPECTED);

    const marker = await readRuntimeMarker('docker');

    assert.strictEqual(marker.container, 'laravel.test');
    assert.strictEqual(marker.cwd, '/var/www/html');
    assert.ok(marker.command?.endsWith('/vendor/bin/pint'));
    assert.ok(marker.args.includes('-'));
    assert.ok(marker.args.includes('--stdin-filename'));
    assert.ok(marker.args.some((arg) => normalizePathSeparators(arg).endsWith('/src/docker.php')));
    assert.ok(marker.args.some((arg) => normalizePathSeparators(arg).endsWith('/pint.json')));
    assert.ok(marker.args.includes('--repair'));
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
