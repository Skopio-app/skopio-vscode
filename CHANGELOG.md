# Changelog

## [0.0.2] - 2025-08-15

### Added

- Add new `source` flag for saving the source of generated heartbeats/events.

---

## [0.0.1] – 2025-08-13

### Added

- Initial release of the Skopio VS Code extension.
- Logs coding activity as heartbeats and events via the Skopio CLI.
- Tracks activity categories: **Coding**, **Debugging**, **Compiling**, **Writing Docs**, **Code Reviewing**.
- Detects real activity (typing, cursor movement, file edits) to avoid idle logging.
- Auto-starts/stops logging based on editor activity.
