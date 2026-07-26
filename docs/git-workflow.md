# Git workflow

MateMyParty uses a lightweight branch workflow without GitFlow tooling.

## Branches

- `main` contains stable, releasable code. Treat it as protected: require pull requests, passing CI, and owner review. Tag releases from this branch.
- `develop` is the integration branch for completed features targeting the next release.
- `feature/*` branches start from `develop`, remain focused, and merge back into `develop` through a pull request.
- `release/*` branches start from `develop` when a release needs stabilization. Only release fixes, versioning, and documentation belong there; merge the result into both `main` and `develop`.
- `hotfix/*` branches start from `main` for urgent production fixes and merge into both `main` and `develop`.

## Normal feature flow

```bash
git switch develop
git pull --ff-only
git switch -c feature/rsvp-foundation
# Commit focused changes and open a pull request into develop.
```

Stable releases merge from `release/*` or `develop` into `main`, pass CI, and receive an annotated semantic-version tag. Delete merged short-lived branches. Avoid direct pushes to `main` and `develop` once GitHub branch protection is enabled.

## Recommended GitHub protection

Require pull requests and the `quality` CI job on `main`; disallow force pushes and branch deletion. Apply the same checks to `develop`, while allowing maintainers to resolve exceptional integration problems. Start with one CODEOWNER approval and increase it as the team grows.
