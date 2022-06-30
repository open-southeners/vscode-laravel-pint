# Laravel Pint for VS Code

[![main](https://github.com/open-southeners/vscode-laravel-pint/actions/workflows/main.yml/badge.svg)](https://github.com/open-southeners/vscode-laravel-pint/actions/workflows/main.yml) [![codecov](https://codecov.io/gh/open-southeners/vscode-laravel-pint/branch/main/graph/badge.svg?token=5M9M8VDLEV)](https://codecov.io/gh/open-southeners/vscode-laravel-pint) [![Visual Studio Marketplace Last Updated](https://img.shields.io/visual-studio-marketplace/last-updated/open-southeners.laravel-pint)](https://marketplace.visualstudio.com/items?itemName=open-southeners.laravel-pint&ssr=false#version-history) [![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/open-southeners.laravel-pint)](https://marketplace.visualstudio.com/items?itemName=open-southeners.laravel-pint&ssr=false#version-history) [![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/open-southeners.laravel-pint)](https://marketplace.visualstudio.com/items?itemName=open-southeners.laravel-pint&ssr=false#review-details) ![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/open-southeners.laravel-pint)

**This extension is NOT official from the Laravel team.** [Take a look into the official project](https://github.com/laravel/pint).

Integrates Laravel Pint into your VSCode projects for automatic code formatting.

## Getting started

1. Just install and enable this extension.
2. Run the following command in a terminal or console at your project's path:

```sh
composer require laravel/pint --dev
```

3. Finally, save any file and it will format it for you. Or press `Ctrl + Shift + P` on Windows/Linux (`Cmd + Shift + P` on Mac OS) and type _"Format document using Laravel Pint"_ this will format the current opened file.

## Features

- `pint.json` autocompletion and validation
- Run Laravel Pint locally or in Docker (using [Laravel Sail](https://laravel.com/docs/9.x/sail)) when saving a PHP document
- Provides a format document command to format opened PHP files
- Provides a format workspace files command to format all workspace folder PHP files
- Format with Laravel Pint task

## License

**Logo (icon) is property of Laravel Team or Laravel Pint project.**

This project is open-sourced software licensed under the [MIT license](LICENSE.md).