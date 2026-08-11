const axios = require('axios');

let tokenCache = null;

const getEskizToken = async () => {
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;

  if (!email || !password || email === 'info@example.com' || password === 'your_eskiz_password') {
    return null;
  }

  if (tokenCache) return tokenCache;

  try {
    const response = await axios.post('https://notify.eskiz.uz/api/auth/login', {
      email,
      password,
    });
    tokenCache = response.data.data.token;
    return tokenCache;
  } catch (error) {
    console.error('Failed to log in to Eskiz.uz:', error.response?.data || error.message);
    return null;
  }
};

const smsService = {
  async sendSMS(phoneNumber, message) {
    // Format phone number to Eskiz format (998XXXXXXXXX, no '+')
    const formattedPhone = phoneNumber.replace('+', '').trim();

    console.log(`[SMS Service] Preparing SMS to ${phoneNumber}: "${message}"`);

    // Fetch JWT token
    const token = await getEskizToken();

    // Fallback to mock if credentials are not configured or login failed
    if (!token) {
      console.log(`[SMS Service] [MOCK SEND] To: ${formattedPhone} | Message: "${message}"`);
      return { success: true, mock: true };
    }

    try {
      const response = await axios.post(
        'https://notify.eskiz.uz/api/message/sms/send',
        {
          mobile_phone: formattedPhone,
          message: message,
          from: '4546', // Default test signature on Eskiz
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(`[SMS Service] SMS successfully sent to ${phoneNumber}. Response:`, response.data);
      return { success: true, data: response.data };
    } catch (error) {
      if (error.response?.status === 401) {
        tokenCache = null; // Clear token cache if expired
      }
      console.error(`[SMS Service] Failed to send SMS to ${phoneNumber}:`, error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  },
};

module.exports = smsService;
