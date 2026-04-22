
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5001';
const USER_NUMBER = '921234567890'; // New number
const APP_PHONE_NUMBER_ID = '1102556439599358';

const payload = {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "1318618643534194",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "923296913696",
              "phone_number_id": APP_PHONE_NUMBER_ID
            },
            "contacts": [
              {
                "profile": { "name": "Tester" },
                "wa_id": USER_NUMBER
              }
            ],
            "messages": [
              {
                "from": USER_NUMBER,
                "id": "wamid.LINKING_TEST_" + Date.now(),
                "timestamp": Math.floor(Date.now() / 1000).toString(),
                "text": { "body": "Verify 123456" },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
};

async function simulate() {
  try {
    console.log('Simulating WhatsApp Linking Webhook...');
    const response = await axios.post(`${BACKEND_URL}/api/integrations/whatsapp/webhook`, payload);
    console.log('Server response:', response.status, response.data);
  } catch (error) {
    if (error.response) {
        console.log('Server error status:', error.response.status);
        console.log('Server error body:', JSON.stringify(error.response.data, null, 2));
    } else {
        console.log('Error message:', error.message);
    }
  }
}

simulate();
