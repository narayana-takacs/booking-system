#!/usr/bin/env node

/**
 * Generate secure random credentials for production deployment
 * Run with: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

function generatePassword(length = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }

  return password;
}

console.log('='.repeat(80));
console.log('PRODUCTION CREDENTIALS GENERATOR');
console.log('='.repeat(80));
console.log('\nIMPORTANT: Store these securely! They will only be shown once.\n');
console.log('Copy these values into your production infra/.env file:\n');

console.log('# n8n Encryption Key (32 characters minimum)');
console.log(`N8N_ENCRYPTION_KEY=${generateSecret(32)}`);
console.log('');

console.log('# n8n Basic Auth Password (keep username as "admin" or change both)');
console.log(`N8N_BASIC_AUTH_PASSWORD=${generatePassword(24)}`);
console.log('');

console.log('# PostgreSQL Password');
console.log(`POSTGRES_PASSWORD=${generatePassword(24)}`);
console.log('');

console.log('# Optional: API Key for webhook security (add this to workflow validation)');
console.log(`WEBHOOK_API_KEY=${generateSecret(40)}`);
console.log('');

console.log('='.repeat(80));
console.log('\nNOTE: Save these to a password manager before closing this window!');
console.log('='.repeat(80));
