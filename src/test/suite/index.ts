import * as path from 'path';
import * as Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true
	});

	const testsRoot = path.resolve(__dirname, '..');
  const files = await glob('**/*.test.js', { cwd: testsRoot });

  files.forEach((filePath) => {
    mocha.addFile(path.resolve(testsRoot, filePath));
  });

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
          return;
        }

        resolve();
      });
    } catch (error) {
      console.error(error);
      reject(error);
    }
  });
}
