# MCP Server Publisher Agent

A specialized agent for NPM package publishing of MCP servers with proper workflow automation. This agent implements NPM best practices to prevent version collisions and ensure smooth publication workflows.

## Features

### 🔍 Pre-flight Version Collision Detection
- Automatically checks if a version already exists on NPM before attempting to publish
- Uses `npm view <package>@<version> version` to verify version availability
- Suggests next available version if conflicts are detected
- Prevents wasted time and frustrating publication failures

### 📈 Proper NPM Version Workflow
- Uses `npm version patch|minor|major` instead of manual package.json editing
- Automatically creates git commits and tags following semantic versioning
- Follows NPM community best practices for version management
- Maintains clean git history with proper version tags

### ✅ Complete Publication Workflow
The agent implements a comprehensive 6-step publication process:

1. **Pre-flight Safety Checks**
   - Verify working directory is clean
   - Check current branch (warns if not main/master)
   - Ensure local branch is up to date with remote
   - Validate package.json structure

2. **Build Validation**
   - Clean and rebuild TypeScript compilation
   - Verify main entry point exists
   - Check binary executables (if defined)
   - Validate build artifacts

3. **Test Execution** (optional)
   - Run test suite if configured
   - Fail publication if tests fail
   - Support for test:ci scripts

4. **Version Management**
   - Use proper `npm version` commands
   - Check for version collisions before bumping
   - Support custom version specification
   - Create git tags automatically

5. **NPM Publication**
   - Publish with `--access public` for public packages
   - Support custom distribution tags
   - Comprehensive error handling

6. **Git Integration**
   - Push version commits to remote
   - Push version tags to remote
   - Maintain synchronization with remote repository

### 🛠 Build & Test Integration
- TypeScript compilation with validation
- Executable permission management for binary files
- Test suite execution with timeout handling
- Build artifact verification

### 🔄 Git Integration
- Coordinates with git workflow for version commits and tags
- Handles branch validation and remote synchronization
- Pushes changes and tags to remote repository
- Clean rollback instructions on failures

### 🚨 Error Handling & Rollback
- Comprehensive error detection and reporting
- Automatic rollback instructions for failed publications
- Safe failure modes that don't leave repository in broken state
- Clear error messages with actionable solutions

### 🎯 MCP Server Specifics
- Understands MCP server build patterns (TypeScript, permissions, executables)
- Validates MCP-specific package structures
- Handles binary executable permissions correctly
- Supports both standalone and HTTP server configurations

## Installation & Setup

The publisher agent is built into the frappe-mcp-server package. After building the project, it's available as both a binary and npm script:

```bash
# Build the project (includes the publisher agent)
npm run build

# The agent is now available as:
npx mcp-server-publisher [command]
# or
npm run publisher [command]
```

## Usage

### Quick Commands

```bash
# Publish a patch version (bug fixes)
npm run publish-patch

# Publish a minor version (new features)
npm run publish-minor

# Publish a major version (breaking changes)
npm run publish-major

# Check if a specific version exists
npm run check-version 1.2.3

# Get suggestions for next version
npm run suggest-version
```

### Detailed Command Reference

#### `/publish-patch [options]`
Publishes a patch version increment (e.g., 1.0.0 → 1.0.1)
- Use for bug fixes and small corrections
- No breaking changes or new features

```bash
# Standard patch release
npm run publish-patch

# Dry run to preview changes
npm run publish-patch -- --dry-run

# Skip tests (not recommended)
npm run publish-patch -- --skip-tests

# Force publish despite preflight failures
npm run publish-patch -- --force
```

#### `/publish-minor [options]`
Publishes a minor version increment (e.g., 1.0.0 → 1.1.0)
- Use for new features that don't break existing functionality
- Backward compatible changes

```bash
# Standard minor release
npm run publish-minor

# With options
npm run publish-minor -- --dry-run --skip-build
```

#### `/publish-major [options]`
Publishes a major version increment (e.g., 1.0.0 → 2.0.0)
- Use for breaking changes
- API changes that require user code updates

```bash
# Standard major release
npm run publish-major

# Preview major release
npm run publish-major -- --dry-run
```

#### `/check-version <version>`
Checks if a specific version already exists on NPM

```bash
# Check if version 1.2.3 exists
npm run check-version 1.2.3

# Output shows:
# - Package name
# - Version being checked
# - Current local version
# - Latest published version
# - Availability status
```

#### `/suggest-version`
Analyzes current version and suggests next available versions

```bash
npm run suggest-version

# Output shows:
# - Current version
# - Suggested patch version (bug fixes)
# - Suggested minor version (new features)  
# - Suggested major version (breaking changes)
```

#### `/dry-run [patch|minor|major]`
Simulates the publication process without making any changes

```bash
# Dry run patch release
npm run publisher /dry-run patch

# Dry run minor release  
npm run publisher /dry-run minor

# See exactly what would happen without risk
```

### Available Options

- `--dry-run`: Preview all changes without actually publishing
- `--skip-tests`: Skip test execution (not recommended for production)
- `--skip-build`: Skip build process (not recommended)
- `--force`: Ignore preflight check failures (use with caution)

## Examples

### Basic Patch Release
```bash
# Simple patch release for bug fixes
npm run publish-patch
```

Expected output:
```
🚀 Starting MCP Server Publication Process
📦 Package: frappe-mcp-server@0.3.7
📈 Version Type: patch
⚠️  LIVE MODE - Changes will be made to NPM and Git

Step 1: Running pre-flight checks...
✅ Working directory is clean
✅ On branch 'main'
✅ Local branch is up to date with remote
✅ package.json is valid
✅ Build directory exists

Step 2: Building package...
🔨 Running TypeScript compilation...
✅ TypeScript compilation successful
✅ Main file exists: build/index.js
✅ Binary exists: frappe-mcp-server -> build/index.js
✅ Binary exists: mcp-server-publisher -> build/agents/mcp-server-publisher.js

Step 3: Running tests...
ℹ️  No test script found, skipping tests

Step 4: Updating version...
📈 Updating version: npm version 0.3.8
✅ Version updated: 0.3.7 → 0.3.8

Step 5: Publishing to NPM...
📤 Publishing to NPM: npm publish --access public --tag latest
✅ Package published successfully

Step 6: Pushing git changes...
📤 Pushing git commits...
✅ Git commits pushed
🏷️  Pushing git tags...
✅ Git tags pushed

✅ Publication Complete!
📦 frappe-mcp-server@0.3.8 published successfully
```

### Dry Run Preview
```bash
# Preview what would happen
npm run publish-minor -- --dry-run
```

Expected output:
```
🚀 Starting MCP Server Publication Process
📦 Package: frappe-mcp-server@0.3.8
📈 Version Type: minor
🧪 DRY RUN MODE - No actual changes will be made

Step 1: Running pre-flight checks...
✅ Working directory is clean
✅ On branch 'main'
✅ Local branch is up to date with remote
✅ package.json is valid

🧪 DRY RUN: Would proceed with pre-flight checks
🧪 DRY RUN: Would complete build process
🧪 DRY RUN: Would complete test execution
🧪 DRY RUN: Would update version to 0.4.0
🧪 DRY RUN: Would publish to NPM
🧪 DRY RUN: Would push git changes and tags

✅ Success! frappe-mcp-server@0.4.0 would be published
```

### Version Collision Detection
```bash
# Check if version already exists
npm run check-version 0.3.7
```

Expected output:
```
📦 Package: frappe-mcp-server
🔍 Checking version: 0.3.7
📋 Current local version: 0.3.8
📋 Latest published version: 0.3.8
❌ Version 0.3.7 already exists
```

### Version Suggestions
```bash
# Get next version suggestions
npm run suggest-version
```

Expected output:
```
📦 Package: frappe-mcp-server
📋 Current version: 0.3.8

💡 Suggested next versions:
   Patch: 0.3.9 (bug fixes)
   Minor: 0.4.0 (new features)
   Major: 1.0.0 (breaking changes)
```

## Error Handling

### Publication Failures
If publication fails, the agent provides clear rollback instructions:

```
❌ Publication failed

🔄 Rollback instructions:
   1. git reset --hard HEAD~1
   2. git tag -d v0.3.9
   3. npm unpublish frappe-mcp-server@0.3.9 --force
```

### Common Issues

#### Version Already Exists
```
❌ Version 0.3.8 already exists on NPM
```
**Solution**: Use `/suggest-version` to get next available version

#### Dirty Working Directory
```
❌ Working directory is not clean. Commit or stash changes before publishing.
```
**Solution**: Commit or stash your changes before publishing

#### Build Failures
```
❌ Build failed: TypeScript compilation errors
```
**Solution**: Fix TypeScript errors before publishing

#### Test Failures
```
❌ Tests failed: 2 tests failing
```
**Solution**: Fix failing tests or use `--skip-tests` (not recommended)

## Best Practices

### 1. Always Use Dry Run First
```bash
# Preview changes before publishing
npm run publish-patch -- --dry-run
```

### 2. Keep Working Directory Clean
- Commit all changes before publishing
- Use meaningful commit messages
- Don't mix feature work with version releases

### 3. Follow Semantic Versioning
- **Patch** (0.0.X): Bug fixes, documentation updates
- **Minor** (0.X.0): New features, backward compatible
- **Major** (X.0.0): Breaking changes, API modifications

### 4. Test Before Publishing
- Don't skip tests unless absolutely necessary
- Fix failing tests rather than bypassing them
- Consider adding more tests for better coverage

### 5. Monitor Publication Results
- Check NPM package page after publishing
- Verify installation works: `npm install your-package`
- Test binary executables if applicable

### 6. Use Proper Branch Strategy
- Publish from main/master branch when possible
- Ensure branch is up to date with remote
- Consider using release branches for major versions

## Integration with Development Workflow

### Pre-commit Hooks
Consider adding pre-commit hooks to validate code before publication:

```json
// package.json
{
  "scripts": {
    "pre-commit": "npm run build && npm run test",
    "pre-publish": "npm run pre-commit"
  }
}
```

### CI/CD Integration
The publisher agent can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/publish.yml
name: Publish Package
on:
  workflow_dispatch:
    inputs:
      version_type:
        description: 'Version type'
        required: true
        default: 'patch'
        type: choice
        options:
        - patch
        - minor
        - major

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run publish-${{ github.event.inputs.version_type }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Troubleshooting

### Permission Issues
If you get permission errors:
```bash
# Login to NPM
npm login

# Check access
npm whoami

# Verify package access
npm access list packages
```

### Git Issues
If git operations fail:
```bash
# Check git status
git status

# Ensure remote is set
git remote -v

# Check authentication
git config user.name
git config user.email
```

### Build Issues
If builds fail:
```bash
# Clean build directory
rm -rf build/

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try build again
npm run build
```

## Advanced Usage

### Custom Version Numbers
You can specify custom versions by modifying the agent code or using npm version directly:

```bash
# Use npm version with custom version
npm version 1.0.0-beta.1
npm run publisher /publish-patch
```

### Distribution Tags
For publishing pre-release versions:

```bash
# Modify the agent to support custom tags
# Or use npm publish directly after version bump
npm publish --tag beta
```

### Rollback Procedures
If something goes wrong after publishing:

```bash
# Unpublish within 24 hours (if no dependents)
npm unpublish your-package@version --force

# Deprecate version (preferred method)
npm deprecate your-package@version "Reason for deprecation"

# Publish fixed version
npm run publish-patch
```

This agent eliminates the common frustrations of NPM publishing by implementing proper workflows, version collision detection, and comprehensive error handling. It's specifically designed for MCP servers but can be adapted for any Node.js package.