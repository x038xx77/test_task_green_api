import * as amqp from 'amqplib';
import pino from 'pino';

const logger = pino({ level: 'info' });

async function processOrders() {
  // Замените параметры подключения на актуальные
  let connection = await amqp.connect('amqp://rabbitmq');

  let channel = await connection.createChannel();
  let queue = 'orders';

  await channel.assertQueue(queue, { durable: false });

  channel.consume(queue, (message) => {
    if (message !== null) {
      const orderData = JSON.parse(message.content.toString());
      const confirmationNumber = generateConfirmationNumber();
      logger.info(`Order processed. Confirmation number: ${confirmationNumber}`);
      channel.ack(message);
    }
  });
}

function generateConfirmationNumber(): string {
  const randomPart = Math.random().toString(36).slice(2, 11); 
  return 'CONF-' + randomPart; 
}

processOrders().catch((error) => {
  logger.error(error);
});
