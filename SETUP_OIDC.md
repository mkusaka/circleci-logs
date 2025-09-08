# npm Trusted Publishing Setup Guide

This guide explains how to set up npm Trusted Publishing with OIDC for the circleci-logs package.

## Prerequisites

- npm account with 2FA enabled
- Repository admin access
- npm CLI v11.5.1 or later (required for OIDC)

## 1. GitHub Repository Settings

### Enable GitHub Actions to create PRs

1. Go to Settings → Actions → General
2. Scroll to "Workflow permissions"
3. Enable "Allow GitHub Actions to create and approve pull requests"
4. Save changes

### Set up GitHub Labels

The release workflow uses the `Type: Release` label. You can create labels manually or use the included labels.json:

```bash
# Using GitHub CLI
gh label create "Type: Release" --color "0e8a16" --description "Release PR"

# Or create all labels from the JSON file
cat .github/labels.json | jq -r '.[] | @sh "gh label create \(.name) --color \(.color) --description \(.description)"' | sh
```

## 2. npm Trusted Publisher Configuration

### Configure Trusted Publisher on npmjs.com

1. Go to your package settings on npmjs.com:
   https://www.npmjs.com/package/circleci-logs/settings/access

2. In the "Trusted Publishers" section, click "Add Publisher"

3. Select "GitHub Actions" as the publisher type

4. Enter the following information:
   - **Organization or user**: `mkusaka`
   - **Repository**: `circleci-logs`
   - **Workflow filename**: `release.yml`
   - **Environment name**: (leave empty)

5. Click "Add Publisher"

### Enable Two-Factor Requirement (Recommended)

After setting up Trusted Publisher:

1. Go to package settings
2. Enable "Require two-factor authentication and disallow tokens"
3. This prevents token-based publishing and allows only OIDC or interactive publishing

## 3. Release Workflow

### Creating a Release

1. **Create a Release PR**:
   ```bash
   # Trigger the workflow from GitHub Actions UI
   # Go to Actions → Create Release PR → Run workflow
   # Select version type: patch, minor, or major
   ```

   Or using GitHub CLI:
   ```bash
   gh workflow run create-release-pr.yml -f version=patch
   ```

2. **Review the Release PR**:
   - The PR will be created as a draft with auto-generated release notes
   - Edit the PR body to customize release notes if needed
   - The PR body will become the GitHub Release notes

3. **Merge the Release PR**:
   - Once ready, mark the PR as ready for review
   - Merge the PR to trigger the release workflow

4. **Automatic Publishing**:
   - The release workflow will:
     - Build and test the package
     - Publish to npm with provenance
     - Create a GitHub Release
     - Comment on the PR with release results

### Manual Release (if needed)

If the automated release fails, you can manually publish:

```bash
# Ensure you have the latest npm
npm install -g npm@latest

# Build and test
pnpm install
pnpm run build
pnpm test

# Publish with provenance (requires npm 11.5.1+)
npm publish --provenance --access public
```

## 4. Verification

### Check npm Package

Visit https://www.npmjs.com/package/circleci-logs to verify:
- Package is published
- Provenance badge is visible
- Version is correct

### Check Provenance

Verify provenance attestation at:
https://search.sigstore.dev/?email=mkusaka

### Check GitHub Release

Releases are automatically created at:
https://github.com/mkusaka/circleci-logs/releases

## 5. Troubleshooting

### Common Issues

1. **"npm ERR! code ENEEDAUTH"**
   - Ensure Trusted Publisher is configured correctly
   - Check workflow filename matches exactly
   - Verify npm version is 11.5.1 or later

2. **"Error: Process completed with exit code 1"**
   - Check GitHub Actions logs for detailed error
   - Ensure all tests pass
   - Verify build completes successfully

3. **Release PR not created**
   - Ensure "Allow GitHub Actions to create and approve pull requests" is enabled
   - Check GitHub Actions permissions

4. **Merge doesn't trigger release**
   - Ensure PR has `Type: Release` label
   - Check that PR was merged (not closed)

### Security Considerations

- Never commit npm tokens to the repository
- Use Trusted Publishing instead of tokens
- Enable "Require two-factor authentication and disallow tokens" after setup
- Review all changes in Release PRs before merging

## Additional Resources

- [npm Trusted Publishers Documentation](https://docs.npmjs.com/trusted-publishers)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements)