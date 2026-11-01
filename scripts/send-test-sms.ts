import crypto from 'crypto';
import { env } from '../src/config/env';
import { smsService } from '../src/services/sms.service';

const TEST_PHONE = '9003233881';

function credentialsArePlaceholders(): boolean {
  const key = env.SMS_API_KEY;
  const sender = env.SMS_SENDER_ID;
  return (
    !key ||
    key.includes('XXXX') ||
    key.includes('your_2factor') ||
    !sender ||
    sender === 'HEADER' ||
    sender === 'CHANGE_ME'
  );
}

async function main() {
  if (credentialsArePlaceholders()) {
    console.error(
      'SMS credentials are still placeholders. Set a real SMS_API_KEY and SMS_SENDER_ID in .env, then run this script again.'
    );
    process.exitCode = 1;
    return;
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const result = await smsService.sendOtp(TEST_PHONE, code);
  console.log(JSON.stringify(result));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'SMS send failed';
  console.error(message);
  process.exitCode = 1;
});
