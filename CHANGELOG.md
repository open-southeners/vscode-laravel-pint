# Change Log

All notable changes to the "laravel-pint" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.6.1] - 2022-06-29

### Fixed

- Regression on alerts when projects aren't using Laravel Pint (#1)

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
