import * as path from 'path';
import { delimiter } from 'node:path';

import { runTests } from '@vscode/test-electron';
import { setupPlayground, TEST_PINT_VERSION } from './setupPlayground';

async function main() {
	try {
      const playground = await setupPlayground();

      process.env.PATH = `${playground.binPath}${delimiter}${process.env.PATH ?? ''}`;
      process.env.TEST_PHP_BIN = 'php';
      process.env.TEST_PINT_VERSION = TEST_PINT_VERSION;
      process.env.TEST_PLAYGROUND_WORKSPACE = playground.workspacePath;

		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Download VS Code, unzip it and run the integration test
		await runTests({
	      extensionDevelopmentPath,
	      extensionTestsPath,
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
	      launchArgs: [playground.workspacePath, '--disable-extensions']
	    });

    
	} catch (err) {
		console.error('Failed to run tests');
    console.error(err);
		process.exit(1);
	}
}

main();
