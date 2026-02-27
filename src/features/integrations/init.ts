// Imports Providers
import { integrationRegistry } from "./integration.registry";
import { googleCalendarProvider } from "./providers/google/google.calendar.provider";
import { googleGmailProvider } from "./providers/google/google.gmail.provider";

// Register Providers
integrationRegistry.register(googleCalendarProvider);
integrationRegistry.register(googleGmailProvider);

// Import Tools
import { CreateCalendarEventTool, GetCalendarEventsTool } from "./tools/calendar.tool";
import { GetRecentEmailsTool, SendEmailTool } from "./tools/gmail.tool";
import { toolRegistry } from "./tools/tool.registry";

// Register Tools
toolRegistry.register(new GetCalendarEventsTool());
toolRegistry.register(new CreateCalendarEventTool());
toolRegistry.register(new GetRecentEmailsTool());
toolRegistry.register(new SendEmailTool());

export { integrationRegistry, toolRegistry };
