# Laravel Pint for VS Code

![demo](https://github.com/open-southeners/vscode-laravel-pint/blob/main/images/demo.gif?raw=true)

[![test CI](https://github.com/open-southeners/vscode-laravel-pint/actions/workflows/test.yml/badge.svg)](https://github.com/open-southeners/vscode-laravel-pint/actions/workflows/test.yml) [![publish CI](https://github.com/open-southeners/vscode-laravel-pint/actions/workflows/publish.yml/badge.svg)](https://github.com/open-southeners/vscode-laravel-pint/actions/workflows/publish.yml) [![codecov](https://codecov.io/gh/open-southeners/vscode-laravel-pint/branch/main/graph/badge.svg?token=5M9M8VDLEV)](https://codecov.io/gh/open-southeners/vscode-laravel-pint) [![Visual Studio Marketplace Last Updated](https://img.shields.io/visual-studio-marketplace/last-updated/open-southeners.laravel-pint)](https://marketplace.visualstudio.com/items?itemName=open-southeners.laravel-pint&ssr=false#version-history) [![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/open-southeners.laravel-pint)](https://marketplace.visualstudio.com/items?itemName=open-southeners.laravel-pint&ssr=false#version-history) [![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/open-southeners.laravel-pint?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=open-southeners.laravel-pint&ssr=false#review-details) [![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/open-southeners.laravel-pint?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=open-southeners.laravel-pint) [![Open VSX Rating](https://img.shields.io/open-vsx/rating/open-southeners/laravel-pint?logo=vscodium&logoColor=%23fff)](https://open-vsx.org/extension/open-southeners/laravel-pint/reviews) [![Open VSX Downloads](https://img.shields.io/open-vsx/dt/open-southeners/laravel-pint?logo=vscodium&logoColor=%23fff)](https://open-vsx.org/extension/open-southeners/laravel-pint)

**This extension is NOT official from the Laravel team.** [Take a look into the official project](https://github.com/laravel/pint).

Integrates Laravel Pint into your VSCode projects for automatic code formatting.

## Getting started

1. Install the extension (it will automatically enable only for PHP files when the extension is enabled) 
2. Run the following command in a terminal or console at your project's path:

```sh
composer require laravel/pint --dev
```

3. Finally, save any file and it will format it for you (remember to set up). Or press `Ctrl + Shift + P` on Windows/Linux (`Cmd + Shift + P` on Mac OS) and type _"Format document using Laravel Pint"_ this will format the current opened file.

## Features

- `pint.json` autocompletion and validation
- Formatter for PHP files that uses Laravel Pint locally, globally or within Docker (using [Laravel Sail](https://laravel.com/docs/9.x/sail))
- Format workspace files command to format all **current active workspace PHP files**

## Partners

[![skore logo](https://github.com/open-southeners/partners/raw/main/logos/skore_logo.png)](https://getskore.com)

## License

**Logo (icon) is property of Laravel Team or Laravel Pint project.**

This project is open-sourced software licensed under the [MIT license](LICENSE.md).
