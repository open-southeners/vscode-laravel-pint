import * as path from 'path';
import { runTests } from '@vscode/test-electron';
import * as tmp from 'tmp';
import * as fs from 'fs-extra';

async function createTempDir() {
  return new Promise<string>((resolve, reject) => {
    tmp.dir((err, dir) => {
      if (err) {
        return reject(err);
      }
      resolve(dir);
    });
  });
}

async function createSettings(): Promise<string> {
  const userDataDirectory = await createTempDir();
  process.env.VSC_JUPYTER_VSCODE_SETTINGS_DIR = userDataDirectory;
  const settingsFile = path.join(userDataDirectory, "User", "settings.json");
  const defaultSettings: Record<string, string | boolean | string[]> = {
    "laravel-pint.enable": true,
    "editor.defaultFormatter": "open-southeners.laravel-pint",
    "laravel-pint.enableDebugLogs": true,
    "security.workspace.trust.enabled": false, // Disable trusted workspaces.
  };

  fs.ensureDirSync(path.dirname(settingsFile));
  fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, undefined, 4));
  return userDataDirectory;
}

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		const extensionTestsPath = path.resolve(__dirname, './suite/index');

    const workspacePath = path.resolve(__dirname, '../../playground/laravel');

    const userDataDirectory = await createSettings();

		await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspacePath]
        .concat(["--wait"])
        .concat(["--skip-welcome"])
        .concat(["--disable-extensions"])
        .concat(["--skip-release-notes"])
        .concat(["--enable-proposed-api"])
        .concat(["--user-data-dir", userDataDirectory]),
    });

    
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();
