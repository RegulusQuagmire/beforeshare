# Publish the prepared release

Current status: ready for publication locally. No GitHub repository, deployment or public demo is claimed. All screenshots and demo images contain synthetic data only.

## Account steps

1. Sign in to GitHub. Create a **public** repository named **beforeshare**, without automatically adding a README, license or gitignore. If it already exists, inspect its contents first; do not overwrite an unrelated project.
2. In PowerShell, open the sanitized public-release checkout (the original development history remains private). Inspect the current branch/status and configured remotes:

```powershell
cd "$env:USERPROFILE\OneDrive\Desktop\beforeshare\work\public-release"
git status
git remote -v
```

3. This prepared checkout has no remote. Copy the new repository's HTTPS clone URL from GitHub, then run:

```powershell
$releaseRemote = Read-Host 'Paste the HTTPS clone URL copied from GitHub'
git remote add origin $releaseRemote
git branch -M main
git push -u origin main
```

If origin is already present, compare it with the intended repository and keep the correct existing remote; do not run remote add again or overwrite it blindly. Authenticate when Git asks. Do not force-push.

4. Open repository **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Open **Actions → Pages → Run workflow**, select main and run it. The initial main push may precede the Pages setting; this manual rerun handles that case. Wait for both build and deploy to succeed. Open the actual URL reported by the deployment's github-pages environment.
6. In a fresh browser context at that real URL: upload tests/fixtures/synthetic-account.png, cover both fields, add an arrow/two markers, crop, undo/redo, download PNG and open the result separately. Check crop dimensions and covered content. Check favicon, styles and no failed script/Worker requests.
7. Only after that succeeds, add the verified demo URL to README and the repository's About section. Commit/push that README update. If deployment fails, inspect the Actions log/report before claiming publication.

## Build paths

GitHub Actions passes GITHUB_REPOSITORY automatically. Project repositories build to /repository-name/; owner.github.io builds to /. Without that variable the default is /beforeshare/. Local development remains /. For custom-domain hosting, set VITE_BASE_PATH=/ consistently for build and tests.

The CI workflow runs on push/PR; Pages runs on pushes to main and workflow_dispatch. Deployment depends on all quality gates, using the same production path for build and browser tests. Only dist is published. Source files, fixtures, history and ignored test browser profiles are excluded from that artifact.

## Workflow references

Configuration follows the official [Vite static deployment guide](https://vite.dev/guide/static-deploy.html) and [GitHub Pages custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Action tags were resolved against their official actions/* Git repositories on 2026-10-10; workflow files pin full SHAs. Reverify official action releases and rerun all checks before future updates.
