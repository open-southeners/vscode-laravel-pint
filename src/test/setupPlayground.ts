import { execFileSync } from 'node:child_process';
import { existsSync, chmodSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const TEST_PINT_VERSION = '1.27.1';

const EXTENSION_ID = 'open-southeners.laravel-pint';

const TEMPLATE_FILES = [
  'default.php',
  'workspace-first.php',
  'workspace-second.php',
  'pint.json',
  'custom-pint.json'
] as const;

interface PreparedPlayground {
  binPath: string;
  phpPath: string;
  workspacePath: string;
}

function repoRootPath(...segments: string[]) {
  return path.resolve(__dirname, '../..', ...segments);
}

function workspacePath(...segments: string[]) {
  return repoRootPath('playground', 'workspace', ...segments);
}

async function ensureDirectory(directoryPath: string) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function copyTemplateFile(templateName: typeof TEMPLATE_FILES[number], destinationPath: string) {
  const sourcePath = repoRootPath('playground', 'templates', templateName);
  const content = (await fs.readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n');

  await fs.writeFile(destinationPath, content, 'utf8');
}

async function downloadPinnedPint(destinationPath: string) {
  const versionFilePath = `${destinationPath}.version`;

  if (existsSync(destinationPath) && existsSync(versionFilePath)) {
    const currentVersion = await fs.readFile(versionFilePath, 'utf8');

    if (currentVersion.trim() === TEST_PINT_VERSION) {
      return;
    }
  }

  const response = await fetch(`https://github.com/laravel/pint/releases/download/v${TEST_PINT_VERSION}/pint.phar`);

  if (!response.ok) {
    throw new Error(`Unable to download Pint v${TEST_PINT_VERSION}: ${response.status} ${response.statusText}`);
  }

  const body = Buffer.from(await response.arrayBuffer());

  await fs.writeFile(destinationPath, body);
  await fs.writeFile(versionFilePath, `${TEST_PINT_VERSION}\n`, 'utf8');
}

function wrapperSource(mode: 'local' | 'custom' | 'global', relativeProxyPath: string) {
  return `#!/usr/bin/env php
<?php

putenv('TEST_PINT_WRAPPER_MODE=${mode}');
require __DIR__ . '/${relativeProxyPath}';
`;
}

function sailWrapperSource() {
  return `#!/usr/bin/env php
<?php

putenv('TEST_PINT_WRAPPER_MODE=sail');
require __DIR__ . '/../../tools/pint-proxy.php';
`;
}

function dockerWrapperSource() {
  return `#!/usr/bin/env php
<?php

$workspacePath = dirname(__DIR__);
$runtimeDirectory = $workspacePath.DIRECTORY_SEPARATOR.'.runtime';
$containerFilesystemRoot = $runtimeDirectory.DIRECTORY_SEPARATOR.'docker-container';
$arguments = array_slice($_SERVER['argv'], 1);

if (! is_dir($runtimeDirectory)) {
  mkdir($runtimeDirectory, 0777, true);
}

if (! is_dir($containerFilesystemRoot)) {
  mkdir($containerFilesystemRoot, 0777, true);
}

function removePath(string $target): void
{
  if (! file_exists($target)) {
    return;
  }

  if (is_file($target) || is_link($target)) {
    unlink($target);
    return;
  }

  $entries = scandir($target);

  if (! is_array($entries)) {
    return;
  }

  foreach ($entries as $entry) {
    if ($entry === '.' || $entry === '..') {
      continue;
    }

    removePath($target.DIRECTORY_SEPARATOR.$entry);
  }

  rmdir($target);
}

function translateContainerPath(string $containerPath, string $workspacePath, string $workspaceMountPath, string $containerFilesystemRoot): string
{
  if (strpos($containerPath, $workspaceMountPath) === 0) {
    return $workspacePath.substr($containerPath, strlen($workspaceMountPath));
  }

  return $containerFilesystemRoot.str_replace('/', DIRECTORY_SEPARATOR, $containerPath);
}

function isContainerPathReference(string $path): bool
{
  $isWindowsDrivePath = (
    strlen($path) >= 3 &&
    ctype_alpha($path[0]) &&
    $path[1] === ':' &&
    ($path[2] === '\\\\' || $path[2] === '/')
  );

  if ($isWindowsDrivePath) {
    return false;
  }

  return strpos($path, ':') !== false;
}

$workspaceMountPath = '/var/www/html';

if (($arguments[0] ?? null) === 'cp') {
  $source = $arguments[1] ?? null;
  $destination = $arguments[2] ?? null;

  if (! $source || ! $destination) {
    fwrite(STDERR, "Incomplete Docker copy command.\\n");
    exit(1);
  }

  if (isContainerPathReference($destination)) {
    [, $containerDestination] = explode(':', $destination, 2);
    $translatedDestination = translateContainerPath($containerDestination, $workspacePath, $workspaceMountPath, $containerFilesystemRoot);

    if (! is_dir(dirname($translatedDestination))) {
      mkdir(dirname($translatedDestination), 0777, true);
    }

    copy($source, $translatedDestination);
    exit(0);
  }

  if (isContainerPathReference($source)) {
    [, $containerSource] = explode(':', $source, 2);
    $translatedSource = translateContainerPath($containerSource, $workspacePath, $workspaceMountPath, $containerFilesystemRoot);

    if (! is_dir(dirname($destination))) {
      mkdir(dirname($destination), 0777, true);
    }

    copy($translatedSource, $destination);
    exit(0);
  }

  fwrite(STDERR, "Unsupported Docker copy direction.\\n");
  exit(1);
}

if (($arguments[0] ?? null) !== 'exec') {
  fwrite(STDERR, "Unexpected Docker command.\\n");
  exit(1);
}

$arguments = array_slice($arguments, 1);
$workingDirectory = null;

if (($arguments[0] ?? null) === '-i') {
  $arguments = array_slice($arguments, 1);
}

if (($arguments[0] ?? null) === '-w') {
  $workingDirectory = $arguments[1] ?? null;
  $arguments = array_slice($arguments, 2);
}

$containerName = $arguments[0] ?? null;
$command = $arguments[1] ?? null;
$commandArguments = array_slice($arguments, 2);

if (! $workingDirectory || ! $containerName || ! $command) {
  fwrite(STDERR, "Incomplete Docker exec command.\\n");
  exit(1);
}

if ($command === 'mkdir') {
  $targetDirectory = $commandArguments[1] ?? null;

  if (! $targetDirectory) {
    fwrite(STDERR, "Missing Docker mkdir target.\\n");
    exit(1);
  }

  $translatedDirectory = translateContainerPath($targetDirectory, $workspacePath, $workspaceMountPath, $containerFilesystemRoot);

  if (! is_dir($translatedDirectory)) {
    mkdir($translatedDirectory, 0777, true);
  }

  exit(0);
}

if ($command === 'rm') {
  $targetDirectory = $commandArguments[1] ?? null;

  if (! $targetDirectory) {
    fwrite(STDERR, "Missing Docker rm target.\\n");
    exit(1);
  }

  $translatedDirectory = translateContainerPath($targetDirectory, $workspacePath, $workspaceMountPath, $containerFilesystemRoot);
  removePath($translatedDirectory);
  exit(0);
}

file_put_contents(
  $runtimeDirectory.DIRECTORY_SEPARATOR.'docker.json',
  json_encode([
    'mode' => 'docker',
    'command' => $command,
    'args' => $commandArguments,
    'container' => $containerName,
    'cwd' => $workingDirectory,
  ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
);

$translatedArguments = array_map(static function (string $argument) use ($containerFilesystemRoot, $workspaceMountPath, $workspacePath) {
  if (str_starts_with($argument, '/')) {
    return translateContainerPath($argument, $workspacePath, $workspaceMountPath, $containerFilesystemRoot);
  }

  return $argument;
}, $commandArguments);

$phpExecutable = getenv('TEST_PHP_BIN') ?: 'php';
$pintCommand = escapeshellarg($phpExecutable).' '.escapeshellarg($workspacePath.DIRECTORY_SEPARATOR.'tools'.DIRECTORY_SEPARATOR.'pint.phar');

foreach ($translatedArguments as $argument) {
  $pintCommand .= ' '.escapeshellarg($argument);
}

passthru($pintCommand, $exitCode);

exit($exitCode);
`;
}

function proxySource() {
  return `#!/usr/bin/env php
<?php

$workspacePath = dirname(__DIR__);
$mode = getenv('TEST_PINT_WRAPPER_MODE') ?: 'local';
$arguments = array_slice($_SERVER['argv'], 1);

if ($mode === 'sail') {
    if (($arguments[0] ?? null) !== 'bin' || ($arguments[1] ?? null) !== 'pint') {
        fwrite(STDERR, "Unexpected Sail command.\\n");
        exit(1);
    }

    $arguments = array_slice($arguments, 2);
}

$runtimeDirectory = $workspacePath.DIRECTORY_SEPARATOR.'.runtime';

if (! is_dir($runtimeDirectory)) {
    mkdir($runtimeDirectory, 0777, true);
}

file_put_contents(
    $runtimeDirectory.DIRECTORY_SEPARATOR.$mode.'.json',
    json_encode([
        'mode' => $mode,
        'args' => $arguments,
        'cwd' => getcwd(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
);

$phpExecutable = getenv('TEST_PHP_BIN') ?: 'php';
$command = escapeshellarg($phpExecutable).' '.escapeshellarg(__DIR__.DIRECTORY_SEPARATOR.'pint.phar');

foreach ($arguments as $argument) {
    $command .= ' '.escapeshellarg($argument);
}

passthru($command, $exitCode);

exit($exitCode);
`;
}

function globalWindowsWrapperSource(phpPath: string) {
  return `@echo off
set TEST_PINT_WRAPPER_MODE=global
"${phpPath.replace(/\\/g, '\\\\')}" "%~dp0..\\tools\\pint-proxy.php" %*
`;
}

function dockerWindowsWrapperSource(phpPath: string) {
  return `@echo off
"${phpPath.replace(/\\/g, '\\\\')}" "%~dp0docker" %*
`;
}

async function writeExecutable(filePath: string, content: string) {
  await fs.writeFile(filePath, content, 'utf8');
  chmodSync(filePath, 0o755);
}

function git(cwd: string, args: string[]) {
  execFileSync('git', args, {
    cwd,
    stdio: 'ignore'
  });
}

async function rebuildWorkspaceRepository(workspaceRoot: string) {
  await fs.rm(path.join(workspaceRoot, '.git'), { recursive: true, force: true });

  git(workspaceRoot, ['init']);
  git(workspaceRoot, ['config', 'user.email', 'tests@example.com']);
  git(workspaceRoot, ['config', 'user.name', 'VS Code Pint Tests']);
  git(workspaceRoot, ['add', '-A']);
  git(workspaceRoot, ['commit', '-m', 'Baseline']);
}

async function seedWorkspaceFiles() {
  await copyTemplateFile('default.php', workspacePath('src', 'command.php'));
  await copyTemplateFile('default.php', workspacePath('src', 'save.php'));
  await copyTemplateFile('default.php', workspacePath('src', 'custom.php'));
  await copyTemplateFile('default.php', workspacePath('src', 'docker.php'));
  await copyTemplateFile('default.php', workspacePath('src', 'global.php'));
  await copyTemplateFile('default.php', workspacePath('src', 'sail.php'));
  await copyTemplateFile('default.php', workspacePath('app-modules', 'format.php'));
  await copyTemplateFile('workspace-first.php', workspacePath('src', 'workspace-first.php'));
  await copyTemplateFile('workspace-second.php', workspacePath('src', 'workspace-second.php'));
  await copyTemplateFile('pint.json', workspacePath('pint.json'));
  await copyTemplateFile('custom-pint.json', workspacePath('config', 'custom-pint.json'));
}

function resolvePhpExecutable() {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  const output = execFileSync(lookupCommand, ['php'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });

  const phpPath = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!phpPath) {
    throw new Error('Unable to resolve a PHP executable for integration tests.');
  }

  return phpPath;
}

async function writeWorkspaceSettings(phpPath: string) {
  /* eslint-disable @typescript-eslint/naming-convention */
  const settings = {
    'laravel-pint.enable': true,
    'laravel-pint.enableDebugLogs': true,
    'laravel-pint.executablePath': 'vendor/bin/pint',
    'laravel-pint.configPath': 'pint.json',
    'laravel-pint.fallbackToGlobalBin': true,
    'laravel-pint.runInDocker': false,
    'laravel-pint.dockerExecutablePath': 'docker',
    'laravel-pint.dockerContainerName': 'laravel.test',
    'laravel-pint.dockerContainerRootPath': '/var/www/html',
    'laravel-pint.runInLaravelSail': false,
    'laravel-pint.sailExecutablePath': 'vendor/bin/sail',
    'laravel-pint.dirtyOnly': false,
    'php.validate.executablePath': phpPath,
    '[php]': {
      'editor.defaultFormatter': EXTENSION_ID,
      'editor.formatOnSave': true,
      'editor.formatOnSaveTimeout': 10000
    }
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  await fs.writeFile(
    workspacePath('.vscode', 'settings.json'),
    `${JSON.stringify(settings, null, 2)}\n`,
    'utf8'
  );
}

export async function setupPlayground(): Promise<PreparedPlayground> {
  const workspaceRoot = workspacePath();
  const binPath = workspacePath('bin');
  const phpPath = resolvePhpExecutable();
  const vendorBinPath = workspacePath('vendor', 'bin');
  const toolsPath = workspacePath('tools');

  await fs.rm(workspaceRoot, { recursive: true, force: true });

  await Promise.all([
    ensureDirectory(workspacePath('.runtime')),
    ensureDirectory(workspacePath('.vscode')),
    ensureDirectory(binPath),
    ensureDirectory(workspacePath('config')),
    ensureDirectory(workspacePath('app-modules')),
    ensureDirectory(workspacePath('src')),
    ensureDirectory(toolsPath),
    ensureDirectory(vendorBinPath)
  ]);

  await seedWorkspaceFiles();
  await writeWorkspaceSettings(phpPath);

  await fs.writeFile(workspacePath('.gitignore'), ".runtime/\n", 'utf8');

  await downloadPinnedPint(workspacePath('tools', 'pint.phar'));
  await fs.writeFile(workspacePath('tools', 'pint.version'), `${TEST_PINT_VERSION}\n`, 'utf8');

  await writeExecutable(workspacePath('tools', 'pint-proxy.php'), proxySource());
  await writeExecutable(workspacePath('vendor', 'bin', 'pint'), wrapperSource('local', '../../tools/pint-proxy.php'));
  await writeExecutable(workspacePath('tools', 'pint-custom'), wrapperSource('custom', 'pint-proxy.php'));
  await writeExecutable(workspacePath('bin', 'docker'), dockerWrapperSource());
  await writeExecutable(workspacePath('bin', 'pint'), wrapperSource('global', '../tools/pint-proxy.php'));
  await writeExecutable(workspacePath('vendor', 'bin', 'sail'), sailWrapperSource());
  await fs.writeFile(workspacePath('bin', 'docker.cmd'), dockerWindowsWrapperSource(phpPath), 'utf8');
  await fs.writeFile(workspacePath('bin', 'pint.cmd'), globalWindowsWrapperSource(phpPath), 'utf8');

  await rebuildWorkspaceRepository(workspaceRoot);

  return {
    binPath,
    phpPath,
    workspacePath: workspaceRoot
  };
}
