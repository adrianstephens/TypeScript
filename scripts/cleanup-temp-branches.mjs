#!/usr/bin/env node
/**
 * Script to clean up temporary combined branches
 * Usage: node scripts/cleanup-temp-branches.mjs [pattern] [--switch-first]
 */

import { execSync } from 'child_process';

const pattern = process.argv.find(arg => !arg.startsWith('--')) && process.argv.find(arg => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]) || 'temp-*';
const switchFirst = process.argv.includes('--switch-first');

console.log(`Cleaning up branches matching pattern: ${pattern}`);

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

// Get current branch
const currentBranch = git('rev-parse --abbrev-ref HEAD');

if (!currentBranch) {
    console.error('❌ Could not determine current branch');
    process.exit(1);
}

// Get list of branches matching pattern
const branchList = git(`branch --list "${pattern}"`);

if (!branchList) {
    console.log('No temporary branches found to clean up.');
    process.exit(0);
}

const allMatches = branchList
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .map(line => line.replace(/^\*?\s*/, ''));

const branches = allMatches.filter(branch => branch !== currentBranch);
const currentBranchMatches = allMatches.includes(currentBranch);

if (allMatches.length === 0) {
    console.log('No temporary branches found to clean up.');
    process.exit(0);
}

console.log(`Found ${allMatches.length} branch(es) matching pattern:`);
allMatches.forEach(branch => {
    if (branch === currentBranch) {
        console.log(`  - ${branch} (current branch - will ${switchFirst ? 'switch away and delete' : 'skip'})`);
    } else {
        console.log(`  - ${branch}`);
    }
});

// Handle current branch if it matches
if (currentBranchMatches && switchFirst) {
    console.log(`\n🔄 Switching away from current temp branch: ${currentBranch}`);
    
    // Try to switch to operators, write-imports, or main
    const targetBranches = ['operators', 'write-imports', 'main', 'master'];
    let switched = false;
    
    for (const target of targetBranches) {
        if (git(`show-ref --verify --quiet refs/heads/${target}`) !== undefined) {
            try {
                execSync(`git checkout ${target}`, { stdio: 'pipe' });
                console.log(`✅ Switched to: ${target}`);
                switched = true;
                // Add current branch to deletion list
                branches.push(currentBranch);
                break;
            } catch {
                continue;
            }
        }
    }
    
    if (!switched) {
        console.log('❌ Could not find a safe branch to switch to');
        console.log('Available options: operators, write-imports, main, master');
        process.exit(1);
    }
}

if (branches.length === 0) {
    if (currentBranchMatches && !switchFirst) {
        console.log('\n⚠️  Current branch matches pattern but --switch-first not specified');
        console.log('Re-run with --switch-first to automatically switch and delete');
    } else {
        console.log('No branches to delete.');
    }
    process.exit(0);
}

console.log(`\n🗑️  Deleting ${branches.length} branch(es)...`);

// Delete each branch
let deletedCount = 0;
for (const branch of branches) {
    try {
        execSync(`git branch -D ${branch}`, { stdio: 'pipe' });
        console.log(`✅ Deleted: ${branch}`);
        deletedCount++;
    } catch {
        console.log(`❌ Failed to delete: ${branch}`);
    }
}

console.log(`\n🎉 Deleted ${deletedCount} of ${branches.length} branches.`);