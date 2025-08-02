#!/usr/bin/env node

/**
 * Debug script to test listDocuments with filters
 */

import { FrappeApp } from "frappe-js-sdk";
import { formatFilters } from './build/frappe-helpers.js';

// Load environment variables
const FRAPPE_URL = process.env.FRAPPE_URL || "https://epinomy.com";
const FRAPPE_API_KEY = process.env.FRAPPE_API_KEY;
const FRAPPE_API_SECRET = process.env.FRAPPE_API_SECRET;

if (!FRAPPE_API_KEY || !FRAPPE_API_SECRET) {
  console.error('Missing FRAPPE_API_KEY or FRAPPE_API_SECRET environment variables');
  process.exit(1);
}

async function testFiltering() {
  console.log('Initializing Frappe client...');
  
  const frappe = new FrappeApp(FRAPPE_URL, {
    useToken: true,
    token: () => `${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}`,
    type: "token",
  });

  // Test 1: No filters (should work)
  console.log('\n=== Test 1: No filters ===');
  try {
    const result1 = await frappe.db().getDocList("Contact", {
      fields: ["name", "first_name", "email_id"],
      limit: 3
    });
    console.log('Success - No filters:', result1.length, 'documents');
    console.log('Sample:', result1[0]);
  } catch (error) {
    console.error('Error - No filters:', error.message);
  }

  // Test 2: Simple object filter (should be converted by formatFilters)
  console.log('\n=== Test 2: Object filters ===');
  const objectFilters = { "first_name": "Aaron" };
  const formattedFilters = formatFilters(objectFilters);
  console.log('Original filters:', JSON.stringify(objectFilters));
  console.log('Formatted filters:', JSON.stringify(formattedFilters));
  
  try {
    const result2 = await frappe.db().getDocList("Contact", {
      fields: ["name", "first_name", "email_id"],
      filters: formattedFilters,
      limit: 5
    });
    console.log('Success - Object filters:', result2.length, 'documents');
    if (result2.length > 0) {
      console.log('Sample:', result2[0]);
    }
  } catch (error) {
    console.error('Error - Object filters:', error.message);
    console.error('Full error:', error);
  }

  // Test 3: Direct array filters
  console.log('\n=== Test 3: Array filters ===');
  const arrayFilters = [["first_name", "=", "Aaron"]];
  console.log('Array filters:', JSON.stringify(arrayFilters));
  
  try {
    const result3 = await frappe.db().getDocList("Contact", {
      fields: ["name", "first_name", "email_id"],
      filters: arrayFilters,
      limit: 5
    });
    console.log('Success - Array filters:', result3.length, 'documents');
    if (result3.length > 0) {
      console.log('Sample:', result3[0]);
    }
  } catch (error) {
    console.error('Error - Array filters:', error.message);
    console.error('Full error:', error);
  }

  // Test 4: LIKE operator
  console.log('\n=== Test 4: LIKE operator ===');
  const likeFilters = [["first_name", "like", "%George%"]];
  console.log('LIKE filters:', JSON.stringify(likeFilters));
  
  try {
    const result4 = await frappe.db().getDocList("Contact", {
      fields: ["name", "first_name", "email_id"],
      filters: likeFilters,
      limit: 5
    });
    console.log('Success - LIKE filters:', result4.length, 'documents');
    if (result4.length > 0) {
      console.log('Sample:', result4[0]);
    }
  } catch (error) {
    console.error('Error - LIKE filters:', error.message);
    console.error('Full error:', error);
  }
}

testFiltering().catch(console.error);