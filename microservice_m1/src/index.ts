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
  return { server_test: 'it worked!' }
})

const logger = pino({ level: 'info' });

// Создаем подключение к RabbitMQ
async function createRabbitMQConnection() {
  const connection = await amqp.connect('amqp://localhost:5672');

  const channel = await connection.createChannel();
  const queue = 'orders';

  await channel.assertQueue(queue, { durable: false }); 

  channel.consume(queue, (message: amqp.ConsumeMessage | null) => {
    if (message !== null) {
      const orderData = JSON.parse(message.content.toString());

      // Обработка полученных данных из RabbitMQ
      // В данном примере просто выводим информацию в консоль
      // server.log.info('Received order from RabbitMQ:', orderData);
      logger.info(`Received order from RabbitMQ: ${JSON.stringify(orderData)}`);
      channel.ack(message);
    }
  });
}

// Вызываем функцию создания подключения к RabbitMQ
createRabbitMQConnection().catch((error) => {
  console.error('Error creating RabbitMQ connection:', error);
});

const confirmationQueue = 'confirmations';

server.post('/create-order', async (request, reply) => {
  try {
    const orderData = request.body;

    // Отправка данных заказа в RabbitMQ
    const connection = await amqp.connect('amqp://localhost:5672');
    const channel = await connection.createChannel();
    
    const queue = 'orders';
    const confirmationQueue = 'confirmations'; // Новая очередь для подтверждений
    
    await channel.assertQueue(queue, { durable: false });
    await channel.assertQueue(confirmationQueue, { durable: false }); // Объявляем новую очередь

    // Отправляем заказ
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(orderData)));

    // Принимаем подтверждение от M2
    channel.consume(confirmationQueue, (message) => {
      if (message !== null) {
        const confirmationMessage = message.content.toString();
        logger.info(`Received confirmation from M2: ${confirmationMessage}`);
        channel.ack(message);
        
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
    await server.listen({ port: 3001  });

    const address = server.server.address();
    const port = typeof address === 'string' ? address : address?.port;
    console.log(`Server listening on port http://localhost:${port}`);
  } catch (error) {
    // server.log.error(error);
    logger.error(error);
    
    process.exit(1);
  }
};

start();
