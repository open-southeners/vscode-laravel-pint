import * as path from 'path';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter } from 'node:path';

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import { setupPlayground, TEST_PINT_VERSION } from './setupPlayground';

function resolveMacOSAppBundlePath(vscodeExecutablePath: string) {
  const appBundleSuffix = '.app';
  const appBundleIndex = vscodeExecutablePath.indexOf(`${appBundleSuffix}${path.sep}`);

  if (appBundleIndex === -1) {
    return;
  }

  return vscodeExecutablePath.slice(0, appBundleIndex + appBundleSuffix.length);
}

function resolveMacOSExecutablePath(vscodeExecutablePath: string) {
  if (process.platform !== 'darwin' || existsSync(vscodeExecutablePath)) {
    return vscodeExecutablePath;
  }

  const codeExecutablePath = path.join(path.dirname(vscodeExecutablePath), 'Code');

  return existsSync(codeExecutablePath) ? codeExecutablePath : vscodeExecutablePath;
}

function clearMacOSDownloadAttributes(vscodeExecutablePath: string) {
  if (process.platform !== 'darwin') {
    return;
  }

  const appBundlePath = resolveMacOSAppBundlePath(vscodeExecutablePath);

  if (!appBundlePath) {
    return;
  }

  for (const attribute of ['com.apple.quarantine', 'com.apple.provenance']) {
    try {
      execFileSync('xattr', ['-dr', attribute, appBundlePath], {
        stdio: 'ignore'
      });
    } catch {
      // Ignore missing attributes or hosts that do not allow removing them.
    }
  }
}

async function main() {
	try {
      const playground = await setupPlayground();

      process.env.PATH = `${playground.binPath}${delimiter}${process.env.PATH ?? ''}`;
      process.env.TEST_PHP_BIN = playground.phpPath;
      process.env.TEST_PINT_VERSION = TEST_PINT_VERSION;
      process.env.TEST_PINT_TEMP_DIRECTORY = path.join(playground.workspacePath, '.runtime', 'temp');
      process.env.TEST_PLAYGROUND_WORKSPACE = playground.workspacePath;

		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

      const vscodeExecutablePath = await downloadAndUnzipVSCode({
        extensionDevelopmentPath,
        version: process.env.TEST_VSCODE_VERSION
      });

      const resolvedVSCodeExecutablePath = resolveMacOSExecutablePath(vscodeExecutablePath);

      clearMacOSDownloadAttributes(resolvedVSCodeExecutablePath);

		// Run the integration test against the prepared VS Code binary
		await runTests({
	      extensionDevelopmentPath,
	      extensionTestsPath,
	      vscodeExecutablePath: resolvedVSCodeExecutablePath,
      /**
       * A list of launch arguments passed to VS Code executable, in addition to `--extensionDevelopmentPath`
       * and `--extensionTestsPath` which are provided by `extensionDevelopmentPath` and `extensionTestsPath`
       * options.
       *
       * If the first argument is a path to a file/folder/workspace, the launched VS Code instance
       * will open it.
       *
       * See `code --help` for possible arguments.
       */
      launchArgs: [playground.workspaceFilePath, '--disable-extensions']
	    });

    
	} catch (err) {
		console.error('Failed to run tests');
    console.error(err);
		process.exit(1);
	}
}

main();
