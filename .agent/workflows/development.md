---
description: Development workflow rules for WinQA project
---

# WinQA Development Workflow

## Rules for Every Code Change

### 1. Commit and Push After Every Change
After making any code changes, always commit and push for backup:
```bash
git add -A
git commit -m "descriptive message"
git push
```

### 2. Build After New Features
After building a new feature, run the build command:
```bash
npm run build
```

### 3. Fix ALL Errors Before Proceeding
- If there are build errors, fix ALL of them before moving on
- Do not leave any errors unresolved

### 4. Push Only After All Errors Fixed
Only after all errors are fixed:
```bash
git add -A
git commit -m "descriptive message"
git push origin <current-branch>
```

Push only to the current branch.
