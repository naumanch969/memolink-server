
const mongoose = require('mongoose');
const { Entry } = require('./dist/features/entry/entry.model');
const { enrichmentWorkflow } = require('./dist/features/agent/workflows/enrichment.workflow');
const { AgentTask } = require('./dist/features/agent/agent.model');
require('dotenv').config();

async function fakeEnrichment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const userId = '68d27424986236a792e79d8b'; // naumanch969@gmail.com
    
    // Create a NEW entry with inputMethod: 'whatsapp'
    const entry = await Entry.create({
      userId,
      content: 'Testing WhatsApp notification trigger',
      type: 'text',
      inputMethod: 'whatsapp',
      status: 'processing',
      metadata: { source: 'whatsapp' }
    });
    
    console.log('Created fake WhatsApp entry:', entry._id);
    
    // Create a dummy task
    const task = await AgentTask.create({
      userId,
      type: 'ENTRY_ENRICHMENT',
      status: 'RUNNING',
      inputData: { entryId: entry._id.toString(), text: entry.content }
    });
    
    console.log('Triggering EnrichmentWorkflow for task:', task._id);
    
    // NOTE: This will run the tagging and embedding workflows too.
    // We want to see if it calls notificationDispatcher.dispatch at the end.
    await enrichmentWorkflow.execute(task);
    
    console.log('Enrichment finished.');
    
    // Check if a new notification was created
    const { Notification } = require('./dist/features/notification/notification.model');
    const notif = await Notification.findOne({ userId, referenceId: entry._id }).sort({ createdAt: -1 });
    if (notif) {
      console.log('Notification found!', notif._id);
      console.log('WhatsApp status:', notif.whatsappStatus);
    } else {
      console.log('No notification created.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fakeEnrichment();
