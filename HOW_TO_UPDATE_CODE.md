# How to Update Your StockSavvy2 Project with the Latest Code

This guide will help you use the `clone_repo.py` script to get the latest code from your repository.

## Understanding the Issue

You mentioned that your current code is not from the latest commit and you want to bring in the latest code. There are two main approaches to solve this:

1. **Clone the repository to a new location** (recommended for a fresh start)
2. **Update your existing repository** (if you want to keep your local changes)

## Option 1: Clone the Latest Code to a New Location

This is the simplest approach if you want a fresh copy of the latest code.

### Step 1: Run the clone_repo.py script

```bash
python clone_repo.py https://github.com/your-username/StockSavvy2.git -d C:\path\to\new\location
```

Replace `https://github.com/your-username/StockSavvy2.git` with your actual repository URL and `C:\path\to\new\location` with the directory where you want to clone the repository.

### Step 2: Copy any local changes (if needed)

If you have made local changes that aren't in the repository, you can manually copy those files from your current project to the newly cloned one.

## Option 2: Update Your Existing Repository

You have two ways to update your existing repository:

### Option 2A: Use the update_repo.py script (Recommended)

We've created a script that automates the update process:

```bash
python update_repo.py
```

This script will:
1. Check if you're in a Git repository
2. Detect uncommitted changes and offer to stash them
3. Pull the latest changes from your current branch
4. Try to reapply your stashed changes if applicable

You can also specify a branch:

```bash
python update_repo.py -b main
```

### Option 2B: Update manually

If you prefer to update manually:

#### Step 1: Save any uncommitted changes

If you have local changes you want to keep, first commit them or stash them:

```bash
git add .
git commit -m "Save my local changes before updating"
```

Or to stash them temporarily:

```bash
git stash
```

#### Step 2: Pull the latest changes

```bash
git pull origin main
```

Replace `main` with your main branch name (could be `master`, `develop`, etc.)

#### Step 3: Resolve any conflicts

If there are conflicts between your local changes and the remote changes, you'll need to resolve them manually.

## Using the clone_repo.py Script for Other Purposes

The `clone_repo.py` script is versatile and can be used for various scenarios:

### Clone a specific branch

```bash
python clone_repo.py https://github.com/your-username/StockSavvy2.git -b develop
```

### Clone to a specific directory with a specific branch

```bash
python clone_repo.py https://github.com/your-username/StockSavvy2.git -d C:\Projects\StockSavvy2-Latest -b main
```

## Troubleshooting

If you encounter any issues:

1. **Authentication errors**: Make sure you have the correct permissions to access the repository
2. **Network issues**: Check your internet connection
3. **Git not found**: Ensure Git is installed and in your system PATH
4. **Conflicts**: If you have conflicts when pulling, you'll need to resolve them manually

## Need More Help?

If you need more specific guidance or encounter issues not covered here, please provide more details about:

1. The exact repository URL you're trying to clone
2. Any specific branches you're working with
3. Any error messages you're seeing
4. Whether you have local changes you need to preserve
