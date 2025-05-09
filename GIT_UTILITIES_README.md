# Git Utilities for StockSavvy2

This repository includes two Python utilities to help you manage your Git repository:

1. **clone_repo.py**: For cloning a repository to a new location
2. **update_repo.py**: For updating an existing repository

These utilities are designed to make it easier to work with your StockSavvy2 project and keep your code up-to-date with the latest changes.

## Quick Start Guide

### To get a fresh copy of the latest code:

```bash
python clone_repo.py https://github.com/your-username/StockSavvy2.git -d C:\path\to\new\location
```

### To update your existing code:

```bash
python update_repo.py
```

## Detailed Documentation

For more detailed information about each utility, please refer to:

- [HOW_TO_UPDATE_CODE.md](HOW_TO_UPDATE_CODE.md) - General guide on updating your code
- [clone_repo_README.md](clone_repo_README.md) - Documentation for the clone_repo.py script
- [update_repo_README.md](update_repo_README.md) - Documentation for the update_repo.py script

## Common Use Cases

### Scenario 1: Starting Fresh

If you want to start with a clean copy of the latest code:

```bash
python clone_repo.py https://github.com/your-username/StockSavvy2.git -d C:\Projects\StockSavvy2-Latest
```

### Scenario 2: Updating Your Working Copy

If you're already working on the project and want to get the latest changes:

```bash
python update_repo.py
```

### Scenario 3: Working with a Specific Branch

If you need to work with a specific branch:

```bash
# To clone a specific branch
python clone_repo.py https://github.com/your-username/StockSavvy2.git -b develop

# To update from a specific branch
python update_repo.py -b develop
```

## Troubleshooting

If you encounter issues with either script:

1. Make sure Git is installed and in your system PATH
2. Check that you have the correct permissions to access the repository
3. Verify your internet connection
4. For update_repo.py, ensure you're running it from within a Git repository

## Requirements

Both scripts require:

- Python 3.6 or higher
- Git installed and available in your system's PATH

## Contributing

If you'd like to improve these utilities, feel free to submit pull requests or open issues with suggestions.

## License

These utilities are provided as-is under the same license as the StockSavvy2 project.