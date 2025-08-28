"use strict";
module.exports = {
  async up(q) {
    const rows = [
      ["scheduled_messages","Scheduled Messages","Create one-off and recurring schedules"],
      ["bulk_send","Bulk Send","Send to many recipients with pacing"],
      ["media_attachments","Media Attachments","Send images, docs, voice"],
      ["analytics","Analytics","Delivery stats and charts"],
      ["api_access","API Access","Use REST endpoints & tokens"],
      ["webhooks","Webhooks","Receive delivery/receipt events"],
      ["multi_user","Multi-user","Multiple logins per business"],
      ["ai_chatbot","AI Chatbot","Bot replies and flows"]
    ].map(([code,name,description]) => ({ code, name, description, createdAt:new Date(), updatedAt:new Date() }));
    await q.bulkInsert("Features", rows);
  },
  async down(q){ await q.bulkDelete("Features", null, {}); }
};
