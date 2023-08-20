import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';
import * as amqp from 'amqplib';
import pino from 'pino';

const server: FastifyInstance = Fastify({});

const opts: RouteShorthandOptions = {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          server_test: {
            type: 'string'
          }
        }
      }
    }
  }
};

server.get('/test', opts, async (request, reply) => {
  return { server_test: 'it worked!' };
});

const logger = pino({ level: 'info' });

async function createChannelAndQueue(queueName: string) {
  const connection = await amqp.connect('amqp://localhost:5672', { timeout: 5000 });
  const channel = await connection.createChannel();

  await channel.assertQueue(queueName, { durable: false });

  return channel;
}

const confirmationQueue = 'confirmations';

server.post('/create-order', async (request, reply) => {
  try {
    const orderData = request.body;

    const orderQueueName = 'orders';

    const orderChannel = await createChannelAndQueue(orderQueueName);
    const confirmationChannel = await createChannelAndQueue(confirmationQueue);

    // Отправляем заказ
    orderChannel.sendToQueue(orderQueueName, Buffer.from(JSON.stringify(orderData)));

    // Принимаем подтверждение от M2
    confirmationChannel.consume(confirmationQueue, (message) => {
      if (message !== null) {
        const confirmationMessage = message.content.toString();
        logger.info(`Received confirmation from M2: ${confirmationMessage}`);
        confirmationChannel.ack(message);
      }
    });

    reply.send({ message: 'Order created and sent for processing' });
  } catch (error) {
    logger.error("Error create order:", error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
});

const start = async () => {
  try {
    await server.listen({ port: 3001 });

    const address = server.server.address();
    const port = typeof address === 'string' ? address : address?.port;
    console.log(`Server listening on port http://localhost:${port}`);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
};

start();
