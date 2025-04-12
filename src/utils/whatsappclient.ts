import axios from "axios";
import ENV from "./../common/env.js";

// Create the axios client for WhatsApp API calls
export const whatsappClient = axios.create({
  baseURL: "https://graph.facebook.com/v21.0/",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ENV.WHATSAPP_API_TOKEN}`,
  },
});

// Function to send OTP using the "auth_verify" template
export async function sendOtp(otp: string, recipientNo: string) {
  recipientNo = recipientNo;
  try {
    const response = await whatsappClient.get(`/${ENV.WHATSAPP_BUISSNESS_ID}/message_templates`);
    // console.log("Templates Retrieved:", JSON.stringify(response.data, null, 2));
    const components = [
      {
        type: "body",
        parameters: [
          {
            type: "text",
            text: otp,
          },
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [
          {
            type: "text",
            text: otp,
          },
        ],
      },
    ];

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientNo,
      type: "template",
      template: {
        name: "auth_verify",
        language: { code: "en" },
        components: components,
      },
    };


    const result = await whatsappClient.post(
      `/${ENV.WHATSAPP_MOBILE_ID}/messages`,
      payload
    );

    console.log("Message Sent:", result.data);
    return result.data;
  } catch (error: any) {

    console.error(" shs" ,error.response)
 
    console.error("Error in sendOtp:", JSON.stringify(error, null, 5));
    
  }
}

// Function to send an "order_processed" template message
export async function orderProcessed(
  name: string,
  item: string,
  regards: string,
  recipientNo: string
) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientNo,
      type: "template",
      template: {
        name: "order_processed",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: name },
              { type: "text", text: item },
              { type: "text", text: regards },
            ],
          },
        ],
      },
    };

    const result = await whatsappClient.post(
      `/${ENV.WHATSAPP_MOBILE_ID}/messages`,
      payload
    );

    console.log("Message Sent:", result.data);
    return result.data;
  } catch (error: any) {
    console.error("Error in orderProcessed:", JSON.stringify(error.response?.data || error, null, 2));
    throw error;
  }
}

export async function orderShipped(
  name: string,
  item: string,
  regards: string,
  tracking_link: string,
  recipientNo: string
) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientNo,
      type: "template",
      template: {
        name: "order_shipped",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: name },
              { type: "text", text: item },
              { type: "text", text: regards },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "text",
                text: `{${tracking_link}}`,
              },
            ],
          
          }
        ],
      },
    };

    const result = await whatsappClient.post(
      `/${ENV.WHATSAPP_MOBILE_ID}/messages`,
      payload
    );

    console.log("Message Sent:", result.data);
    return result.data;
  } catch (error: any) {
    console.error("Error in orderProcessed:", JSON.stringify(error.response?.data || error, null, 2));
    throw error;
  }
}

export async function orderOutforDelivery(
  name: string,
  item: string,
  regards: string,
  tracking_link: string,
  recipientNo: string
) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientNo,
      type: "template",
      template: {
        name: "order_out_for_delivery",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: name },
              { type: "text", text: item },
              { type: "text", text: regards },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "text",
                text: `{${tracking_link}}`,
              },
            ],
          
          }
        ],
      },
    };

    const result = await whatsappClient.post(
      `/${ENV.WHATSAPP_MOBILE_ID}/messages`,
      payload
    );

    console.log("Message Sent:", result.data);
    return result.data;
  } catch (error: any) {
    console.error("Error in orderProcessed:", JSON.stringify(error.response?.data || error, null, 2));
    throw error;
  }
}

export async function orderDeliverd(
  name: string,
  item: string,
  regards: string,
  recipientNo: string
) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientNo,
      type: "template",
      template: {
        name: "order_delivered",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: name },
              { type: "text", text: item },
              { type: "text", text: regards },
            ],
          },
        ],
      },
    };

    const result = await whatsappClient.post(
      `/${ENV.WHATSAPP_MOBILE_ID}/messages`,
      payload
    );

    console.log("Message Sent:", result.data);
    return result.data;
  } catch (error: any) {
    console.error("Error in orderProcessed:", JSON.stringify(error.response?.data || error, null, 2));
    throw error;
  }
}






