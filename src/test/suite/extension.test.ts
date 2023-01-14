import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  test('Open messy file and save', async () => {
    const foundFiles = await vscode.workspace.findFiles("config/vendor.php")
    const document = await vscode.workspace.openTextDocument(foundFiles[0])

    const oldText = document.getText();

    await document.save();

    const newText = document.getText();

    assert.notStrictEqual(oldText, newText);
	});
});