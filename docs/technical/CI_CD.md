# CI/CD and Deployment

Fill this in with the developers. Describe only what actually exists.

## 1. Repository and branching
- Default branch: main (protected; no direct commits)
- Branch names: feature/<name>, fix/<name>, docs/<name>, test/<name>
- Pull request rules: one teammate's review; link the issue with `Closes #n`

## 2. GitHub Actions
| Workflow file | Trigger | What it does | Status badge / last run |
|---------------|---------|--------------|--------------------------|
| .github/workflows/ (name) | push / pull request | e.g., install, test, build | |

## 3. Deployment
| Part | Host | URL | How it is deployed | Who can redeploy |
|------|------|-----|--------------------|------------------|
| Frontend | Netlify | https://tupcossad.netlify.app | | |
| Backend | | | | |

## 4. Secrets and environment variables
List the names only (never the values): API keys, database URL. They are stored in repo Settings > Secrets and variables > Actions, or in the host's settings.

## 5. Release history
| Version | Date | What changed | Link to release |
|---------|------|--------------|------------------|
| | | | |
