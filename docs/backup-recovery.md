# Backup and Recovery

Machine Commerce Proof treats receipt history and signing identity as separate recovery assets.

## Default backup

```bash
npm run backup -- --destination=./backups
```

The default backup contains historical receipt/task logs, the public key and a signed-independent SHA-256 manifest. It intentionally excludes the private signing key.

## Full signing backup

```bash
npm run backup -- --include-private-key --destination=/secure/offline/location
```

Use a controlled secret-management process for this output. Never commit it, upload it to public artifacts, or put it in issue/CI logs.

## Validate before restore

```bash
npm run restore-check -- --source=/path/to/backup
```

This is read-only and only validates file hashes against `manifest.json`.

## Recovery sequence

1. Stop the service.
2. Validate the backup with `restore-check`.
3. Provision a new `DATA_DIR`.
4. Restore the approved files.
5. Start the service.
6. Run `npm run status` and `npm run audit`.
7. Verify representative historical receipts independently.

Old receipts retain their embedded public verification information. New receipts should use the active current signing identity.
