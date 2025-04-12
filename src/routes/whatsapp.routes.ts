import express from 'express';

const router = express.Router();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// GET /webhook - For verification
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST /webhook - For receiving messages
router.post('/', (req, res) => {
  const receievemessageDto = req.body;

  // You can replace this with your own message handling logic
  console.log('Received message:', JSON.stringify(receievemessageDto, null, 2));

  // Simulate calling a service function
  receiveMessage(receievemessageDto);

  res.sendStatus(200);
});

// Simulated service method
function receiveMessage(messageDto: any) {
  // Your logic here
  console.log('Processing message:', messageDto);
}

// Start server
export default router;