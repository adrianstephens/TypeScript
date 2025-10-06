#!/usr/bin/env node
/**
 * Script to create a temporary branch combining multiple branches
 * Usage: node scripts/combine-branches.mjs <base-branch> <merge-branch1> [merge-branch2] ... [options]
 * 
 * Examples:
 *   node scripts/combine-branches.mjs operators rewrite-imports
 *   node scripts/combine-branches.mjs main feature-a feature-b --auto-resolve-baselines
 *   node scripts/combine-branches.mjs operators rewrite-imports --temp-branch=my-test --theirs
 * 
 * Options:
 *   --temp-branch=<name>      Name for the temporary branch (default: temp-combined)
 *   --auto-resolve-baselines  Auto-resolve conflicts in baseline test files
 *   --theirs                  Prefer merge branches for all conflicts
 *   --ours                    Prefer base branch for all conflicts
 *   --force                   Discard uncommitted changes if any exist
 */

import { execSync } from 'child_process';
import { exit } from 'process';

// Parse command line arguments
const args = process.argv.slice(2);
const flags = args.filter(arg => arg.startsWith('--'));
const branches = args.filter(arg => !arg.startsWith('--'));

// Extract options
const tempBranchFlag = flags.find(flag => flag.startsWith('--temp-branch='));
const tempBranch = tempBranchFlag ? tempBranchFlag.split('=')[1] : 'temp-combined';
const autoResolveBaselines = flags.includes('--auto-resolve-baselines');
const preferTheirs = flags.includes('--theirs');
const preferOurs = flags.includes('--ours');

// Validate arguments
if (branches.length < 2) {
    console.error('❌ Error: Need at least 2 branches to combine');
    console.error('Usage: node scripts/combine-branches.mjs <base-branch> <merge-branch1> [merge-branch2] ...');
    console.error('Example: node scripts/combine-branches.mjs operators rewrite-imports');
    exit(1);
}

const baseBranch = branches[0];
const mergeBranches = branches.slice(1);

console.log(`🔀 Creating temporary combined branch: ${tempBranch}`);
console.log(`📍 Base branch: ${baseBranch}`);
console.log(`🔗 Merging branches: ${mergeBranches.join(', ')}`);
if (autoResolveBaselines) console.log('🔧 Auto-resolve baseline conflicts enabled');
if (preferTheirs) console.log('📥 Will prefer merge branches (theirs) for all conflicts');
if (preferOurs) console.log('📤 Will prefer base branch (ours) for all conflicts');

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

// Check for uncommitted changes
const statusOutput = git('status --porcelain');
const hasUncommittedChanges = statusOutput && statusOutput.trim().length > 0;
if (hasUncommittedChanges) {
    console.log('⚠️  You have uncommitted changes. Options:');
    console.log('1. Commit your changes first: git add . && git commit -m "WIP"');
    console.log('2. Stash your changes: git stash');
    console.log('3. Add --force flag to discard local changes');
    
    if (!flags.includes('--force')) {
        console.log('\nUse --force to proceed anyway (this will discard your local changes)');
        exit(1);
    } else {
        console.log('🔥 --force flag detected, discarding local changes...');
        try {
            execSync('git reset --hard HEAD', { stdio: 'pipe' });
            console.log('✅ Local changes discarded');
        } catch {
            console.error('❌ Failed to discard local changes');
            exit(1);
        }
    }
}

// Check if all branches exist
for (const branch of [baseBranch, ...mergeBranches]) {
    const branchExists = git(`show-ref --verify --quiet refs/heads/${branch}`) !== undefined ||
                        git(`show-ref --verify --quiet refs/remotes/origin/${branch}`) !== undefined;
    
    if (!branchExists) {
        console.error(`❌ Error: Branch '${branch}' not found`);
        exit(1);
    }
}

// Delete temp branch if it exists
git(`branch -D ${tempBranch}`);

// Create new branch from base branch
console.log(`Creating branch from ${baseBranch}...`);
gitOrExit(`checkout ${baseBranch}`, `Failed to checkout ${baseBranch} branch`);
gitOrExit(`checkout -b ${tempBranch}`, 'Failed to create temporary branch');

// Merge each branch sequentially
for (const mergeBranch of mergeBranches) {
    console.log(`Merging ${mergeBranch}...`);

    if (preferTheirs) {
        // Use theirs strategy for all conflicts
        try {
            execSync(`git merge ${mergeBranch} -X theirs --no-edit`, { stdio: 'inherit' });
            console.log(`✅ Merged ${mergeBranch} successfully using theirs strategy!`);
        } catch {
            console.error(`❌ Merge failed for ${mergeBranch} even with theirs strategy`);
            exit(1);
        }
    } else if (preferOurs) {
        // Use ours strategy for all conflicts
        try {
            execSync(`git merge ${mergeBranch} -X ours --no-edit`, { stdio: 'inherit' });
            console.log(`✅ Merged ${mergeBranch} successfully using ours strategy!`);
        } catch {
            console.error(`❌ Merge failed for ${mergeBranch} even with ours strategy`);
            exit(1);
        }
    } else {
        // Default merge with optional auto-resolution
        try {
            execSync(`git merge ${mergeBranch} --no-edit`, { stdio: 'inherit' });
            console.log(`✅ Merged ${mergeBranch} successfully!`);
        } catch {
            if (autoResolveBaselines) {
                console.log('⚠️  Merge conflicts detected. Attempting to auto-resolve baseline conflicts...');
                
                // Check if conflicts are only in baseline files
                const conflictedFiles = git('diff --name-only --diff-filter=U') || '';
                const baselineConflicts = conflictedFiles.split('\n').filter(file => 
                    file.includes('tests/baselines/reference/config/initTSConfig/') && file.endsWith('.json')
                );
                
                if (baselineConflicts.length > 0 && baselineConflicts.length === conflictedFiles.split('\n').filter(f => f.trim()).length) {
                    console.log(`🔧 Auto-resolving baseline file conflicts (accepting ${mergeBranch} version)...`);
                    
                    // Accept merge branch version for all baseline conflicts
                    try {
                        execSync('git checkout --theirs tests/baselines/reference/config/initTSConfig/', { stdio: 'pipe' });
                        execSync('git add tests/baselines/reference/config/initTSConfig/', { stdio: 'pipe' });
                        execSync(`git commit -m "Merge ${baseBranch} and ${mergeBranch} (auto-resolved baseline conflicts)"`, { stdio: 'pipe' });
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
                console.error(`❌ Merge conflicts detected while merging ${mergeBranch}.`);
                console.log(`Current branch: ${tempBranch}`);
                console.log('Options:');
                console.log('1. Resolve manually: git status');
                console.log('2. Re-run with: --auto-resolve-baselines');
                console.log('3. Re-run with: --theirs (prefer merge branches)');
                console.log('4. Re-run with: --ours (prefer base branch)');
                exit(1);
            }
        }
    }
}

console.log('');
console.log(`✅ Success! Created combined branch: ${tempBranch}`);
console.log(`📍 Base: ${baseBranch}`);
console.log(`🔗 Merged: ${mergeBranches.join(', ')}`);
console.log('You can now build and test with all feature sets.');
console.log('');
console.log(`To return to your original branch: git checkout ${currentBranch}`);
console.log(`To delete the temp branch later: git branch -D ${tempBranch}`);
console.log('');