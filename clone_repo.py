import subprocess
import os
import sys
import argparse

def clone_repository(repo_url, target_dir=None, branch=None):
    """
    Clone a Git repository to the specified directory.
    
    Args:
        repo_url (str): The URL of the repository to clone
        target_dir (str, optional): The directory to clone the repository to. 
                                   If not provided, the repository will be cloned to the current directory.
        branch (str, optional): The branch to clone. If not provided, the default branch will be cloned.
    
    Returns:
        bool: True if the repository was cloned successfully, False otherwise.
    """
    try:
        # Build the git clone command
        cmd = ['git', 'clone']
        
        # Add branch if specified
        if branch:
            cmd.extend(['--branch', branch])
        
        # Add repository URL
        cmd.append(repo_url)
        
        # Add target directory if specified
        if target_dir:
            cmd.append(target_dir)
        
        # Execute the command
        print(f"Cloning repository: {repo_url}")
        if branch:
            print(f"Branch: {branch}")
        if target_dir:
            print(f"Target directory: {target_dir}")
        
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        
        print("Repository cloned successfully!")
        return True
    
    except subprocess.CalledProcessError as e:
        print(f"Error cloning repository: {e}")
        print(f"Error output: {e.stderr}")
        return False
    
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Clone a Git repository')
    parser.add_argument('repo_url', help='The URL of the repository to clone')
    parser.add_argument('-d', '--directory', help='The directory to clone the repository to')
    parser.add_argument('-b', '--branch', help='The branch to clone')
    
    args = parser.parse_args()
    
    clone_repository(args.repo_url, args.directory, args.branch)

if __name__ == '__main__':
    main()