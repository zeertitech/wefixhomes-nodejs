import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';

const OTP_TEMPLATE = '#VAR1# is the OTP to verify your mobile number with Shanandra. Valid for 5 mins.';

export function indianMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new Error('Invalid Indian mobile number');
  }
  return local;
}

export function otpSmsText(code: string): string {
  return OTP_TEMPLATE.replace('#VAR1#', code);
}

export class SmsService {
  private readonly baseUrl = 'https://2factor.in/API/V1';
  private readonly otpUrl = 'https://2factor.in/API/R1/';

  async sendOtp(phone: string, code: string): Promise<unknown> {
    const local = indianMobile(phone);
    const body = new URLSearchParams({
      module: 'TRANS_SMS',
      apikey: env.SMS_API_KEY,
      to: `91${local}`,
      from: env.SMS_SENDER_ID,
      msg: otpSmsText(code),
    });

    try {
      const response = await axios.post(this.otpUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });

      const data = response.data as { Status?: string };
      if (String(data?.Status ?? '').toLowerCase() !== 'success') {
        logger.error('2Factor OTP SMS rejected', { phone: local, status: data?.Status ?? 'unknown' });
        throw new Error('Could not send the verification SMS');
      }

      logger.info('OTP SMS sent', { phone: local });
      return data;
    } catch (err) {
      if (err instanceof Error && err.message === 'Could not send the verification SMS') throw err;
      logger.error('Failed to send OTP SMS', { phone: local });
      throw new Error('Could not send the verification SMS');
    }
  }

  async sendOrderConfirmation(phone: string, orderNumber: string): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/${env.SMS_API_KEY}/ADDON_SERVICES/SEND/TSMS`, {
        params: {
          From: env.SMS_TEMPLATE_NAME,
          To: phone,
          Msg: `Your order ${orderNumber} has been placed successfully. Thank you for shopping with us!`,
        },
        timeout: 5000,
      });
      logger.info('Order confirmation SMS sent', { phone, orderNumber });
    } catch (err) {
      logger.error('Failed to send order confirmation SMS', { phone, orderNumber, err });
    }
  }

  async sendAbandonedCartReminder(phone: string): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/${env.SMS_API_KEY}/ADDON_SERVICES/SEND/TSMS`, {
        params: {
          From: env.SMS_TEMPLATE_NAME,
          To: phone,
          Msg: `You have items waiting in your cart! Complete your purchase before they sell out.`,
        },
        timeout: 5000,
      });
      logger.info('Abandoned cart SMS sent', { phone });
    } catch (err) {
      logger.error('Failed to send abandoned cart SMS', { phone, err });
    }
  }

  async sendShipmentUpdate(phone: string, orderNumber: string, awbCode: string): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/${env.SMS_API_KEY}/ADDON_SERVICES/SEND/TSMS`, {
        params: {
          From: env.SMS_TEMPLATE_NAME,
          To: phone,
          Msg: `Order ${orderNumber} has been shipped! Track with AWB: ${awbCode}`,
        },
        timeout: 5000,
      });
      logger.info('Shipment update SMS sent', { phone, orderNumber });
    } catch (err) {
      logger.error('Failed to send shipment SMS', { phone, orderNumber, err });
    }
  }
}

export const smsService = new SmsService();
