# npm Trusted Publishing Setup Guide

This guide explains how to set up npm Trusted Publishing with OIDC for the circleci-logs package.

## Prerequisites

- npm account with 2FA enabled
- Repository admin access
- npm CLI v11.5.1 or later (required for OIDC)

## npm Trusted Publisher Configuration

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

## Release Workflow

### Creating a Release

1. **Update package.json version**:
   ```bash
   # Update version in package.json
   npm version patch  # or minor, major
   ```

2. **Commit and push the version change**:
   ```bash
   git add package.json package-lock.json
   git commit -m "chore: release v$(node -p "require('./package.json').version")"
   git push origin main
   ```

3. **Create and push a tag**:
   ```bash
   # Create a tag matching the version
   git tag v$(node -p "require('./package.json').version")
   git push origin v$(node -p "require('./package.json').version")
   ```

4. **Automatic Publishing**:
   - The release workflow will automatically:
     - Verify tag matches package.json version
     - Build and test the package
     - Publish to npm with provenance
     - Generate release notes from commits
     - Create a GitHub Release

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
   - Check workflow filename matches exactly (`release.yml`)
   - Verify npm version is 11.5.1 or later

2. **"Error: package.json version doesn't match tag version"**
   - Ensure package.json version matches the tag (without 'v' prefix)
   - Update package.json before creating the tag

3. **"Error: Process completed with exit code 1"**
   - Check GitHub Actions logs for detailed error
   - Ensure all tests pass
   - Verify build completes successfully

4. **Release doesn't trigger**
   - Ensure tag name starts with 'v' (e.g., v1.0.0)
   - Check that tag was pushed to the correct branch

### Security Considerations

- Never commit npm tokens to the repository
- Use Trusted Publishing instead of tokens
- Enable "Require two-factor authentication and disallow tokens" after setup
- Review all changes in Release PRs before merging

## Additional Resources

- [npm Trusted Publishers Documentation](https://docs.npmjs.com/trusted-publishers)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements)