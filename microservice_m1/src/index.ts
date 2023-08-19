import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';
import * as amqp from 'amqplib';
import pino from 'pino';

const server: FastifyInstance = Fastify({});

const opts: RouteShorthandOptions = {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {}
      }
    }
  }
};

const logger = pino({ level: 'info' });

// Создаем подключение к RabbitMQ
async function createRabbitMQConnection() {
  const connection = await amqp.connect('amqp://rabbitmq');

  const channel = await connection.createChannel();
  const queue = 'orders';

  await channel.assertQueue(queue);

  channel.consume(queue, (message: amqp.ConsumeMessage | null) => {
    if (message !== null) {
      const orderData = JSON.parse(message.content.toString());

      // Обработка полученных данных из RabbitMQ
      // В данном примере просто выводим информацию в консоль
      // server.log.info('Received order from RabbitMQ:', orderData);
      logger.info(`Received order from RabbitMQ:: ${orderData}`);

      channel.ack(message);
    }
  });
}

// Вызываем функцию создания подключения к RabbitMQ
createRabbitMQConnection().catch((error) => {
  console.error('Error creating RabbitMQ connection:', error);
});

// Остальной код остается без изменений

server.post('/create-order', opts, async (request, reply) => {

  try {
    const orderData = request.body;

    // Отправка данных заказа в RabbitMQ
    const connection = await amqp.connect('amqp://rabbitmq');


    
    const channel = await connection.createChannel();
    const queue = 'orders';

    await channel.assertQueue(queue, { durable: false });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(orderData)));

    reply.send({ message: 'Order created and sent for processing' });
  } catch (error) {
    // server.log.error("Error create order", error);
    logger.error("Error create order: ",error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
});

const start = async () => {
  try {
    await server.listen({ port: 3001 });

    const address = server.server.address();
    const port = typeof address === 'string' ? address : address?.port;
    console.log(`Server listening on port ${port}`);
  } catch (error) {
    // server.log.error(error);
    logger.error(error);
    
    process.exit(1);
  }
};

start();
