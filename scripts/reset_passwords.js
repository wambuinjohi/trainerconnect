#!/usr/bin/env node

/**
 * Reset test user passwords script
 * Usage: node scripts/reset_passwords.js <api_url>
 * Example: node scripts/reset_passwords.js https://trainercoachconnect.com/api.php
 */

const apiUrl = process.argv[2] || 'https://trainercoachconnect.com/api.php';

console.log(`🔄 Resetting user passwords via API: ${apiUrl}`);
console.log(`📝 Resetting passwords for test users to: Pass1234\n`);

async function resetPasswords() {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'reset_passwords',
      }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.error('❌ Error: Server returned non-JSON response');
      console.error(`Content-Type: ${contentType}`);
      const text = await response.text();
      console.error(`Response: ${text.substring(0, 500)}`);
      process.exit(1);
    }

    const result = await response.json();

    if (result.status === 'error') {
      console.error(`❌ Error: ${result.message}`);
      process.exit(1);
    }

    console.log(`✅ Success: ${result.message}`);
    if (result.data) {
      console.log(`📊 Updated: ${result.data.updated} users`);
      if (result.data.errors && result.data.errors.length > 0) {
        console.log(`⚠️  Errors:`);
        result.data.errors.forEach((err) => console.log(`   - ${err}`));
      }
    }

    console.log('\n✨ Password reset complete!');
    console.log('Test user credentials:');
    console.log('  - admin@skatryk.co.ke / Pass1234');
    console.log('  - trainer@skatryk.co.ke / Pass1234');
    console.log('  - client@skatryk.co.ke / Pass1234');

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

resetPasswords();
