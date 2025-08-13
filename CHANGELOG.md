# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

---

## [0.0.1] – 2025-08-13

### Added

- Initial release of the Skopio VS Code extension.
- Logs coding activity as heartbeats and events via the Skopio CLI.
- Tracks activity categories: **Coding**, **Debugging**, **Compiling**, **Writing Docs**, **Code Reviewing**.
- Detects real activity (typing, cursor movement, file edits) to avoid idle logging.
- Auto-starts/stops logging based on editor activity.
