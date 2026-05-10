import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../lib/errors';

interface ShiprocketToken {
  token: string;
  expiresAt: Date;
}

interface ShiprocketOrderResponse {
  order_id: number;
  shipment_id: number;
  awb_code?: string;
  courier_name?: string;
}

let cachedToken: ShiprocketToken | null = null;

export class ShiprocketService {
  private readonly baseUrl = 'https://apiv2.shiprocket.in/v1/external';
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({ baseURL: this.baseUrl, timeout: 15000 });
  }

  private async getToken(): Promise<string> {
    if (cachedToken !== null && cachedToken.expiresAt > new Date()) {
      return cachedToken.token;
    }

    const response = await axios.post<{ token: string }>(`${this.baseUrl}/auth/login`, {
      email: env.SHIPROCKET_EMAIL,
      password: env.SHIPROCKET_PASSWORD,
    });

    const expiresAt = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000); // 9 days
    cachedToken = { token: response.data.token, expiresAt };
    logger.info('Shiprocket token refreshed');

    return cachedToken.token;
  }

  async createShipment(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        address: true,
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundError('Order');

    const token = await this.getToken();
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const payload = {
      order_id: order.orderNumber,
      order_date: order.createdAt.toISOString().split('T')[0],
      pickup_location: 'Primary',
      billing_customer_name: order.user.firstName,
      billing_last_name: order.user.lastName,
      billing_address: order.address.line1,
      billing_address_2: order.address.line2 ?? '',
      billing_city: order.address.city,
      billing_pincode: order.address.pincode,
      billing_state: order.address.state,
      billing_country: order.address.country,
      billing_email: order.user.email,
      billing_phone: order.address.phone,
      shipping_is_billing: 1,
      order_items: order.items.map((item) => ({
        name: item.snapshotName,
        sku: item.snapshotSku,
        units: item.quantity,
        selling_price: Number(item.unitPrice),
      })),
      payment_method: 'Prepaid',
      sub_total: Number(order.total),
      length: 25,
      breadth: 20,
      height: 5,
      weight: 0.5,
    };

    const response = await this.client.post<ShiprocketOrderResponse>(
      '/orders/create/adhoc',
      payload
    );

    await prisma.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        shiprocketOrderId: String(response.data.order_id),
        shipmentId: String(response.data.shipment_id),
        awbCode: response.data.awb_code,
        courierName: response.data.courier_name,
        status: 'BOOKED',
      },
      update: {
        shiprocketOrderId: String(response.data.order_id),
        shipmentId: String(response.data.shipment_id),
        awbCode: response.data.awb_code,
        courierName: response.data.courier_name,
        status: 'BOOKED',
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
    });

    logger.info('Shipment created via Shiprocket', {
      orderId,
      shipmentId: response.data.shipment_id,
    });
  }

  async trackShipment(awbCode: string) {
    const token = await this.getToken();
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const response = await this.client.get(`/courier/track/awb/${awbCode}`);
    return response.data as unknown;
  }
}

export const shiprocketService = new ShiprocketService();
