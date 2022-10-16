# Change Log

All notable changes to the "laravel-pint" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.1.3] - 2022-10-16

### Added

- Extension published to Open VSX for VSCodium users: https://open-vsx.org/extension/open-southeners/laravel-pint

## [1.1.2] - 2022-08-30

### Changed

- Use global context for extension initial installation auto-config [#24]

## [1.1.1] - 2022-08-16

### Fixed

- Custom config file path resolution (now yes, thanks to @adrum for the PR) [#23]
- Workspace files format command

### Changed

- `laravel-pint.configPath` now is also being used by the extension's exclude paths

## [1.1.0] - 2022-08-12

### Added

- More logging debug information (only enabled by setting the option `laravel-pint.enableDebugLogs`)

### Changed

- Format workspace was formatting all workspaces, now it formats only current active document's workspace (otherwise it complains about it on the Output logs tab of VS Code)

### Fixed

- Custom config file path resolution [#22]
- File formatting triggers under the whole workspace [#21]
- Minor bug with extension version debug info getting logged

## [1.0.2] - 2022-08-04

### Fixed

- Order of command arguments on PHP when running in Windows (thanks @serdartaylan) [#18]

## [1.0.1] - 2022-08-03

### Fixed

- Hide status bar with others document languages
- Show disabled status bar with active files that are excluded by Laravel Pint
- Fix command execution on Windows wasn't made properly

### Added

- First extension enable pre-setting workspace language-scoped (PHP) config: `editor.formatOnSave` and `laravel-pint.enable`
- Some output messages

## [1.0.0] - 2022-08-03

### Fixed

- Support to run Laravel Pint or Laravel Sails with PHP on Windows [#18]

### Added

- Support for multi-workspace environment
- Spanish translation for extension settings
- Extension category to _Formatters_ (now it works like a proper VS Code formatter) [#17]
- More debugging messages (can be enabled by the setting option `laravel-pint.enableDebugLogs`)
- Status bar that shows extension debug output on click (still work in progress...)
- Security support for untrusted workspaces (limited functionality to just global)
- Add fallback to global Laravel Pint command whenever local binary isn't found in any workspace (supporting both Windows & Linux/Mac OS), configurable by the setting `laravel-pint.fallbackToGlobalBin` [#20]

### Changed

- Major codebase refactor

### Removed

- VS Code task provider for workspace formatting (in favour of the same format project command **which now works with multiple workspaces**)

## [0.7.3] - 2022-07-10

### Fixed

- Regression introduced in a3b67a5ef1cb4126d5605f062861c62deda3fbf5 (#15)

## [0.7.2] - 2022-07-07

### Fixed

- Minor changes to code style and internal fixes

## [0.7.1] - 2022-07-05

### Fixed

- Fix psr12 preset on `pint.json` autocompletion (thanks @yaegassy)

## [0.7.0] - 2022-06-30

### Added

- Format workspace files command.
- Format task provider.

## [0.6.1] - 2022-06-29

### Fixed

- Regression on alerts when projects aren't using Laravel Pint (#1).

## [0.6.0] - 2022-06-28

### Added

- `pint.json` JSON schema validator for validation and autocompletion.

## [0.5.0] - 2022-06-27

### Added

- Laravel Sail compatibility, adding options `runInLaravelSail` (default: false) and `sailExecutablePath` (default: `vendor/bin/sail`).

### Fixed

- Make default settings all compatible with Windows paths.
- Format command visible even when extension has not been activated.

## [0.4.0] - 2022-06-27

### Added

- Option `auto` for preset to leave it empty on the executable arguments.

### Changed

- `configPath` default behaviour (out of the box) to auto align and improve user experience and extension maintenance alignment with the official Laravel Pint.

## [0.3.0] - 2022-06-26

### Changed

- Extension's default preset to be `laravel` as of v0.2.0 release of Laravel Pint (before was `psr-12`) (#8, thanks @zepfietje)

## [0.2.1] - 2022-06-23

### Changed

- Added an hi-res version of the icon (#3, thanks @caneco)

## [0.2.0] - 2022-06-23

### Added

- `preset`, `config` and `formatOnSave` settings ([check this for more info about presets configuration](https://github.com/laravel/pint/tree/main/resources/presets))

### Fixed

- Settings auto reload on save

### Removed

- Alerts when executablePath setting isn't available in local project (#1)

## [0.1.0] - 2022-06-23

### Added

- Initial release
