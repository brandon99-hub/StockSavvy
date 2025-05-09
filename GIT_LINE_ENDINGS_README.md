# Git Line Endings Guide

## Issue
The repository was experiencing issues with line endings in the file `backend/backend/api/migrations/0003_fix_migration_dependency.py`. Git was showing a warning:

```
warning: in the working copy of 'backend/backend/api/migrations/0003_fix_migration_dependency.py', CRLF will be replaced by LF the next time Git touches it
```

This warning occurs because:
1. Windows typically uses CRLF (`\r\n`) for line endings
2. Unix/Linux/macOS uses LF (`\n`) for line endings
3. Git was configured to convert line endings (with `core.autocrlf=true`)

## Solution
We fixed the issue by:
1. Converting the file's line endings from CRLF to LF using PowerShell:
   ```powershell
   (Get-Content -Raw backend\backend\api\migrations\0003_fix_migration_dependency.py) -replace "`r`n", "`n" | Set-Content -NoNewline backend\backend\api\migrations\0003_fix_migration_dependency.py
   ```
2. Adding the file to the staging area:
   ```
   git add backend\backend\api\migrations\0003_fix_migration_dependency.py
   ```

## Preventing Future Issues
The repository already has a `.gitattributes` file that specifies line ending behavior:
```
# Handle line endings automatically
* text=auto

# Specific file types
*.js text eol=lf
*.ts text eol=lf
*.jsx text eol=lf
*.tsx text eol=lf
*.html text eol=lf
*.css text eol=lf
*.json text eol=lf
*.md text eol=lf
*.py text eol=lf
```

This configuration should prevent line ending issues in most cases. However, to avoid similar issues in the future:

1. **For Windows users:**
   - Be aware that some text editors might save files with CRLF line endings by default
   - Configure your text editor to use LF line endings for this project
   - Popular editors like VS Code, PyCharm, and Sublime Text have settings for this

2. **If you encounter line ending warnings:**
   - Use the PowerShell command above to convert line endings
   - Or use Git's built-in attributes to normalize line endings:
     ```
     git add --renormalize .
     ```

3. **For new files:**
   - Make sure your editor is configured to use LF line endings for this project
   - The `.gitattributes` file should handle this automatically for most cases

## Additional Information
- Git's `core.autocrlf` is set to `true`, which means Git will convert LF to CRLF when checking out files (for Windows compatibility) and convert CRLF to LF when committing files
- The `.gitattributes` file overrides this behavior for specific file types
- Python files (`.py`) are configured to use LF line endings