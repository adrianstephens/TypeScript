#!/usr/bin/env node
/**
 * Script to create a temporary branch combining operators and write-imports branches
 * Usage: node scripts/combine-branches.mjs [temp-branch-name] [--auto-resolve-baselines] [--theirs] [--ours]
 */

import { execSync } from 'child_process';
import { exit } from 'process';

const tempBranch = process.argv.find(arg => !arg.startsWith('--')) && process.argv[2] || 'temp-combined';
const autoResolveBaselines = process.argv.includes('--auto-resolve-baselines');
const preferTheirs = process.argv.includes('--theirs');
const preferOurs = process.argv.includes('--ours');

console.log(`Creating temporary combined branch: ${tempBranch}`);
if (autoResolveBaselines) console.log('🔧 Auto-resolve baseline conflicts enabled');
if (preferTheirs) console.log('📥 Will prefer write-imports (theirs) for all conflicts');
if (preferOurs) console.log('📤 Will prefer operators (ours) for all conflicts');

/**
 * Execute git command and return output
 * @param {string} command 
 * @returns {string | undefined}
 */
function git(command) {
    try {
        return execSync(`git ${command}`, { encoding: 'utf8' }).trim();
    } catch {
        return undefined;
    }
}

/**
 * Execute git command and exit on failure
 * @param {string} command 
 * @param {string} errorMessage 
 */
function gitOrExit(command, errorMessage) {
    try {
        execSync(`git ${command}`, { stdio: 'inherit' });
    } catch {
        console.error(`Error: ${errorMessage}`);
        exit(1);
    }
}

// Save current branch
const currentBranch = git('rev-parse --abbrev-ref HEAD');
console.log(`Current branch: ${currentBranch}`);

// Check if branches exist
const operatorsExists = git('show-ref --verify --quiet refs/heads/operators') !== undefined;
const writeImportsExists = git('show-ref --verify --quiet refs/heads/write-imports') !== undefined;

if (!operatorsExists) {
    console.error('Error: operators branch not found');
    exit(1);
}

if (!writeImportsExists) {
    console.error('Error: write-imports branch not found');
    exit(1);
}

// Delete temp branch if it exists
git(`branch -D ${tempBranch}`);

// Create new branch from operators
console.log('Creating branch from operators...');
gitOrExit('checkout operators', 'Failed to checkout operators branch');
gitOrExit(`checkout -b ${tempBranch}`, 'Failed to create temporary branch');

// Merge write-imports
console.log('Merging write-imports...');

if (preferTheirs) {
    // Use theirs strategy for all conflicts
    try {
        execSync('git merge write-imports -X theirs --no-edit', { stdio: 'inherit' });
        console.log('✅ Merge completed successfully using theirs strategy!');
    } catch {
        console.error('❌ Merge failed even with theirs strategy');
        exit(1);
    }
} else if (preferOurs) {
    // Use ours strategy for all conflicts
    try {
        execSync('git merge write-imports -X ours --no-edit', { stdio: 'inherit' });
        console.log('✅ Merge completed successfully using ours strategy!');
    } catch {
        console.error('❌ Merge failed even with ours strategy');
        exit(1);
    }
} else {
    // Default merge with optional auto-resolution
    try {
        execSync('git merge write-imports --no-edit', { stdio: 'inherit' });
        console.log('✅ Merge completed successfully!');
    } catch {
        if (autoResolveBaselines) {
            console.log('⚠️  Merge conflicts detected. Attempting to auto-resolve baseline conflicts...');
            
            // Check if conflicts are only in baseline files
            const conflictedFiles = git('diff --name-only --diff-filter=U') || '';
            const baselineConflicts = conflictedFiles.split('\n').filter(file => 
                file.includes('tests/baselines/reference/config/initTSConfig/') && file.endsWith('.json')
            );
            
            if (baselineConflicts.length > 0 && baselineConflicts.length === conflictedFiles.split('\n').filter(f => f.trim()).length) {
                console.log('🔧 Auto-resolving baseline file conflicts (accepting write-imports version)...');
                
                // Accept write-imports version for all baseline conflicts
                try {
                    execSync('git checkout --theirs tests/baselines/reference/config/initTSConfig/', { stdio: 'pipe' });
                    execSync('git add tests/baselines/reference/config/initTSConfig/', { stdio: 'pipe' });
                    execSync('git commit -m "Merge operators and write-imports branches (auto-resolved baseline conflicts)"', { stdio: 'pipe' });
                    console.log('✅ Auto-resolved baseline conflicts and completed merge!');
                } catch {
                    console.error('❌ Failed to auto-resolve conflicts');
                    console.log(`Current branch: ${tempBranch}`);
                    console.log('Run \'git status\' to see conflicts and resolve manually');
                    exit(1);
                }
            } else {
                console.error('❌ Non-baseline conflicts detected. Manual resolution required.');
                console.log(`Current branch: ${tempBranch}`);
                console.log('Conflicted files:');
                console.log(conflictedFiles);
                console.log('Run \'git status\' to see conflicts and resolve manually');
                exit(1);
            }
        } else {
            console.error('❌ Merge conflicts detected.');
            console.log(`Current branch: ${tempBranch}`);
            console.log('Options:');
            console.log('1. Resolve manually: git status');
            console.log('2. Re-run with: --auto-resolve-baselines');
            console.log('3. Re-run with: --theirs (prefer write-imports)');
            console.log('4. Re-run with: --ours (prefer operators)');
            exit(1);
        }
    }
}

console.log('');
console.log(`✅ Success! Created combined branch: ${tempBranch}`);
console.log('You can now build and test with both feature sets.');
console.log('');
console.log(`To return to your original branch: git checkout ${currentBranch}`);
console.log(`To delete the temp branch later: git branch -D ${tempBranch}`);
console.log('');