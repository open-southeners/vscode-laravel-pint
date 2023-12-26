import * as assert from 'assert';
import { afterEach } from 'mocha';
import * as fs from 'fs';
import * as vscode from 'vscode';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let originalFile = {
  path: '',
  content: ''
};

afterEach(async () => {
  if (originalFile.path !== '') {
    fs.writeFileSync(originalFile.path, originalFile.content, { encoding: 'utf-8' });
  }
});

suite('Extension Test Suite', () => {
  test('Open messy file and run formatting over it', async () => {
    await vscode.extensions.getExtension('open-southeners.laravel-pint')!.activate();

    const foundFiles = await vscode.workspace.findFiles("config/vendor.php");
    const document = await vscode.workspace.openTextDocument(foundFiles[0]);

    await vscode.languages.setTextDocumentLanguage(document, "php");
    try {
      await vscode.window.showTextDocument(document);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
      throw error;
    }
    
    const oldText = document.getText();
    
    originalFile.path = document.uri.path;
    originalFile.content = oldText;

    console.time('formatting file with Pint');
    
    await vscode.commands.executeCommand("laravel-pint.format");

    console.timeEnd('formatting file with Pint');

    await wait(1000);
    
    assert.notStrictEqual(oldText, document.getText());
	}).timeout(5000);
});