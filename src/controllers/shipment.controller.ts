import { FastifyRequest, FastifyReply } from 'fastify';
import { shiprocketService } from '../services/shiprocket.service';
import { prisma } from '../config/prisma';
import { sendSuccess } from '../lib/response';
import { NotFoundError } from '../lib/errors';

export class ShipmentController {
  async create(
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    await shiprocketService.createShipment(request.params.orderId);
    sendSuccess(reply, null, 'Shipment created successfully');
  }

  async getByOrder(
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId: request.params.orderId },
    });
    if (!shipment) throw new NotFoundError('Shipment');
    sendSuccess(reply, shipment, 'Shipment fetched');
  }

  async track(
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId: request.params.orderId },
    });

    if (!shipment?.awbCode) {
      throw new NotFoundError('Shipment or tracking number (AWB)');
    }

    const tracking = await shiprocketService.trackShipment(shipment.awbCode);
    sendSuccess(reply, tracking, 'Tracking info fetched');
  }
}

export const shipmentController = new ShipmentController();
