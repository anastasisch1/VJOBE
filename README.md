# VJOBE Community

A local desktop job application tracker for macOS and Windows, built with Electron and vanilla JavaScript.

Track applications, save vacancies, organize tags and statuses, keep calendar events, write formatted notes, and attach documents.

## Run

Windows users can download the x64 `.exe` installer from [Releases](https://github.com/anastasisch1/VJOBE/releases). Windows builds are unsigned. Verify the source and release before running a downloaded installer.

Install Node.js and npm, then run:

```sh
npm ci
npm start
```

## Build for macOS

```sh
npm run build:mac
```

The Apple Silicon and Intel apps are created in `dist/`. Builds are unsigned.

## Build for Windows

On Windows, run `npm ci` followed by `npm run build:win`. The NSIS installer is created in `dist/`. `npm run test:windows` tests the packaged app in a temporary profile. GitHub Actions builds, tests and publishes the Windows installer after relevant changes on `main`.

## Local Data

New installations start empty. This repository contains no personal application records, imported spreadsheets, CVs, or attachments.

The application keeps records in Electron local storage and copies attachments into its local profile. Community builds use a separate profile named `VJOBE Community` inside the operating system's application data directory. On macOS this is `~/Library/Application Support/VJOBE Community/`.

Existing personal VJOBE installations use a different profile. Running the community version does not migrate, reset, or delete their records. The app has no account or cloud sync.

On Windows, community data is stored in `%APPDATA%\VJOBE Community\`. The installer does not delete this profile on uninstall.

To back up your community data, quit the app and copy its entire profile directory to a private location. Never commit profiles or backups to Git.

## Contributing

Keep changes focused and test with synthetic data in a separate profile. Do not include personal records, attachments, local backups, or screenshots containing private information in commits or issues.

## License

MIT. See [LICENSE](LICENSE).
