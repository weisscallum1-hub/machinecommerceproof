# GitHub setup — new repository only

This package is designed to be published into a **new repository**. Do not point the publishing script at an existing project.

Suggested repository name:

`machine-commerce-proof`

From the project root:

```bash
./scripts/publish-to-new-github.sh weisscallum1-hub machine-commerce-proof
```

The script checks whether `origin` already exists and refuses to replace it. It does not contain credentials or modify another repository.

The connected GitHub integration used during preparation can inspect repositories and manage contents, but repository creation itself must be performed at the GitHub account level.

## Create the repository

Create `machine-commerce-proof` as an empty repository first. Do not initialize it with a README, license, `.gitignore`, or template; this bundle already contains those files. After creation, run the publishing script from the project root.
