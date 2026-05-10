import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class SmsService {
  private readonly baseUrl = 'https://2factor.in/API/V1';

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
