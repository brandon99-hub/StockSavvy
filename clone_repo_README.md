# Repository Cloning Utility

This utility provides a simple way to clone Git repositories from the command line.

## Requirements

- Python 3.6 or higher
- Git installed and available in your system's PATH

## Usage

You can use this script to clone any Git repository by providing the repository URL. Optionally, you can specify a target directory and a specific branch to clone.

### Basic Usage

```bash
python clone_repo.py <repository_url>
```

This will clone the repository to the current directory using the default branch.

### Advanced Usage

```bash
python clone_repo.py <repository_url> -d <target_directory> -b <branch_name>
```

#### Arguments

- `repository_url` (required): The URL of the Git repository to clone
- `-d, --directory` (optional): The directory where the repository will be cloned to
- `-b, --branch` (optional): The specific branch to clone

## Examples

### Clone a repository to the current directory

```bash
python clone_repo.py https://github.com/username/repository.git
```

### Clone a repository to a specific directory

```bash
python clone_repo.py https://github.com/username/repository.git -d C:\path\to\directory
```

### Clone a specific branch

```bash
python clone_repo.py https://github.com/username/repository.git -b develop
```

### Clone a specific branch to a specific directory

```bash
python clone_repo.py https://github.com/username/repository.git -d C:\path\to\directory -b develop
```

## Error Handling

The script provides informative error messages if the cloning process fails. Common issues include:

- Invalid repository URL
- Network connectivity issues
- Git not installed or not in PATH
- Insufficient permissions for the target directory
- Non-existent branch name

## Using as a Module

You can also import the `clone_repository` function from this script to use it in your own Python code:

```python
from clone_repo import clone_repository

# Clone a repository
success = clone_repository(
    repo_url="https://github.com/username/repository.git",
    target_dir="C:\\path\\to\\directory",
    branch="main"
)

if success:
    print("Repository cloned successfully!")
else:
    print("Failed to clone repository.")
```