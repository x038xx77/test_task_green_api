import * as amqp from 'amqplib';
import pino from 'pino';

const logger = pino({ level: 'info' });

async function processOrders() {
  const connection = await amqp.connect('amqp://localhost:5672');
  const channel = await connection.createChannel();
  
  const queue = 'orders';
  const confirmationQueue = 'confirmations'; // Новая очередь для подтверждений
  
  await channel.assertQueue(queue, { durable: false });
  await channel.assertQueue(confirmationQueue, { durable: false }); // Объявляем новую очередь

  channel.consume(queue, (message) => {
    if (message !== null) {
      const orderData = JSON.parse(message.content.toString());
      const confirmationNumber = generateConfirmationNumber();
      
      // Отправляем подтверждение в M1
      channel.sendToQueue(confirmationQueue, Buffer.from(confirmationNumber));
      logger.info(`Order processed. Confirmation number: ${confirmationNumber} for order Data M1 ${JSON.stringify(orderData)}`);
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
