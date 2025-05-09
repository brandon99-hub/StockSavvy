# Repository Update Utility

This utility provides an automated way to update your Git repository with the latest changes.

## Requirements

- Python 3.6 or higher
- Git installed and available in your system's PATH
- An existing Git repository (this script must be run from within a Git repository)

## Usage

You can use this script to update your Git repository by pulling the latest changes from the remote repository.

### Basic Usage

```bash
python update_repo.py
```

This will update your repository by pulling the latest changes from the current branch.

### Advanced Usage

```bash
python update_repo.py -b <branch_name>
```

#### Arguments

- `-b, --branch` (optional): The branch to pull from. If not provided, the current branch will be used.

## Features

The script provides several helpful features:

1. **Repository Check**: Verifies that you're running the script from within a Git repository.
2. **Current Branch Detection**: Automatically detects your current branch if no branch is specified.
3. **Uncommitted Changes Handling**: Detects uncommitted changes and offers to stash them before updating.
4. **Stash Reapplication**: Attempts to reapply stashed changes after updating.
5. **Detailed Output**: Provides informative messages throughout the process.

## Examples

### Update using the current branch

```bash
python update_repo.py
```

### Update from a specific branch

```bash
python update_repo.py -b main
```

### Update from the develop branch

```bash
python update_repo.py -b develop
```

## Error Handling

The script provides informative error messages if the update process fails. Common issues include:

- Not being in a Git repository
- Network connectivity issues
- Git not installed or not in PATH
- Merge conflicts when pulling or reapplying stashed changes

## Using as a Module

You can also import the `update_repository` function from this script to use it in your own Python code:

```python
from update_repo import update_repository

# Update the repository
success = update_repository(branch="main")

if success:
    print("Repository updated successfully!")
else:
    print("Failed to update repository.")
```

## Workflow

The script follows this workflow:

1. Check if the current directory is a Git repository
2. Determine which branch to update from
3. Check for uncommitted changes
4. If there are uncommitted changes, ask the user if they want to stash them
5. Pull the latest changes from the remote repository
6. If changes were stashed, attempt to reapply them
7. Report success or failure