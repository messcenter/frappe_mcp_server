#!/usr/bin/env node

/**
 * Debug script to test filter behavior
 */

import { formatFilters } from './build/frappe-helpers.js';

console.log('Testing formatFilters function...\n');

// Test case 1: Simple equality
const test1 = { "first_name": "Aaron" };
console.log('Test 1 - Simple equality:');
console.log('Input:', JSON.stringify(test1));
console.log('Output:', JSON.stringify(formatFilters(test1)));
console.log();

// Test case 2: Operator format
const test2 = { "first_name": ["=", "Aaron"] };
console.log('Test 2 - Operator format:');
console.log('Input:', JSON.stringify(test2));
console.log('Output:', JSON.stringify(formatFilters(test2)));
console.log();

// Test case 3: Like operator
const test3 = { "first_name": ["like", "%George%"] };
console.log('Test 3 - Like operator:');
console.log('Input:', JSON.stringify(test3));
console.log('Output:', JSON.stringify(formatFilters(test3)));
console.log();

// Test case 4: Multiple filters
const test4 = { 
  "first_name": ["=", "Aaron"],
  "status": "Open"
};
console.log('Test 4 - Multiple filters:');
console.log('Input:', JSON.stringify(test4));
console.log('Output:', JSON.stringify(formatFilters(test4)));
console.log();

// Test case 5: Array format (should pass through)
const test5 = [["first_name", "=", "Aaron"]];
console.log('Test 5 - Array format (should pass through):');
console.log('Input:', JSON.stringify(test5));
console.log('Output:', JSON.stringify(formatFilters(test5)));