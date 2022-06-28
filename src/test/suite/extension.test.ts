import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as fs from 'fs';
import { beforeEach } from 'mocha';
import path = require('path');
import * as vscode from 'vscode';
import * as myExtension from '../../extension';
import { PresetOptions } from '../../types';
import { asAbsolutePathFromWorkspaceFolder, buildCommandFromConfig } from '../../util';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

  // TODO: Not there yet...
  // myExtension.activate();

  beforeEach(() => {
    const workspaceConfigFile = path.resolve(__dirname, '../../../plaground/.vscode/settings.json');

    if (fs.existsSync(workspaceConfigFile)) {
      fs.rmSync(workspaceConfigFile);
    }
  })

	test('Default config settings', () => {
    const config = vscode.workspace.getConfiguration('laravel-pint');

    assert.strictEqual(config.get<string>('configPath'), '');
    assert.strictEqual(config.get<string>('executablePath'), '');
    assert.strictEqual(config.get<boolean>('formatOnSave'), true);
    assert.strictEqual(config.get<PresetOptions>('preset'), 'auto');
    assert.strictEqual(config.get<boolean>('runInLaravelSail'), false);
    assert.strictEqual(config.get<string>('sailExecutablePath'), '');
	});
	
  test('Build command with config args', async () => {
    const config = vscode.workspace.getConfiguration('laravel-pint');

    await config.update('executablePath', 'pint');
    await config.update('configPath', 'mypintconfig.json');

    const cmd = await buildCommandFromConfig('index.php', config);

    console.log(cmd)

    assert.ok(cmd);
    assert.ok(cmd.filter(value => ['vendor/bin/pint', 'index.php', '--config', 'mypintconfig.json'].includes(value)).length > 1);
	});
});