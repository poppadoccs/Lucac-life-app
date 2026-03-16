// src/aiAgent.js — The Lucac Life AI Agent Engine
// Replaces ALL regex-based parsing with Groq native function calling

// ═══ TOOL DEFINITIONS (Groq function calling schema) ═══
const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new calendar event. Use when user wants to add, schedule, or plan something.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in 12h format like '4:00 PM'" },
          duration: { type: "number", description: "Duration in minutes, default 60" },
          person: { type: "string", description: "Family member this is for, or empty for everyone" },
          repeat: { type: "string", enum: ["none","daily","weekly","biweekly","monthly"], description: "Recurrence pattern" },
          isPrivate: { type: "boolean", description: "Whether event is private (admin only)" },
          alert: { type: "string", enum: ["none","0","5","15","30","60","1440"], description: "Alert minutes before event" }
        },
        required: ["title", "date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_event",
      description: "Delete a calendar event. Use when user wants to remove, cancel, or delete something from the calendar.",
      parameters: {
        type: "object",
        properties: {
          searchTerm: { type: "string", description: "What to search for in event titles" }
        },
        required: ["searchTerm"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_events_bulk",
      description: "Delete multiple events at once. Use when user wants to delete ALL events, clear the calendar, or remove everything on a specific date.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Delete all events on this date (YYYY-MM-DD). Omit to delete from entire calendar." },
          deleteAll: { type: "boolean", description: "If true, delete ALL events from the entire calendar" },
          searchTerm: { type: "string", description: "Optional keyword filter — only delete events matching this" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_event",
      description: "Edit an existing calendar event. Use when user wants to change, update, move, or reschedule something.",
      parameters: {
        type: "object",
        properties: {
          searchTerm: { type: "string", description: "Current event to find" },
          newTitle: { type: "string", description: "New title (if changing)" },
          newDate: { type: "string", description: "New date YYYY-MM-DD (if moving)" },
          newTime: { type: "string", description: "New time in 12h format (if changing)" }
        },
        required: ["searchTerm"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description: "Look up what's on the calendar. Use when user asks about schedule, upcoming events, or what's happening.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD" },
          endDate: { type: "string", description: "End date YYYY-MM-DD" },
          person: { type: "string", description: "Filter by family member name" }
        },
        required: ["startDate"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_budget_summary",
      description: "Get spending information. Use when user asks about money, expenses, budget, or spending.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today","this_week","this_month","last_month"] },
          category: { type: "string", description: "Specific spending category to filter by" }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_expense",
      description: "Log a new expense. Use when user mentions spending money, buying something, or paying for something.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Dollar amount" },
          description: { type: "string", description: "What was purchased" },
          category: { type: "string", description: "Category like Groceries, Kids, Transport, Bills, Eating Out" }
        },
        required: ["amount", "description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_shopping_item",
      description: "Add item to shopping list. Use when user wants to add something to buy, grocery list, or shopping list.",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string", description: "Item to add" }
        },
        required: ["item"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_kids_status",
      description: "Get information about the kids — stars, tasks, chores, game progress.",
      parameters: {
        type: "object",
        properties: {
          kidName: { type: "string", description: "Which kid (Yana, Luca, or 'both')" }
        },
        required: ["kidName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_task_for_kid",
      description: "Assign a task or chore to a kid.",
      parameters: {
        type: "object",
        properties: {
          kidName: { type: "string", description: "Which kid" },
          task: { type: "string", description: "The task description" },
          emoji: { type: "string", description: "Emoji icon for the task" },
          stars: { type: "number", description: "Star reward value, default 5" }
        },
        required: ["kidName", "task"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "emotional_support",
      description: "Provide emotional support, encouragement, or help with feelings. Use when the user expresses emotions like sadness, anger, frustration, excitement, happiness, anxiety, or asks for motivation, comfort, or someone to talk to.",
      parameters: {
        type: "object",
        properties: {
          emotion: { type: "string", description: "The emotion detected: sad, angry, frustrated, happy, excited, anxious, overwhelmed, lonely, proud, scared" },
          context: { type: "string", description: "What the user said or what's going on" },
          isChild: { type: "boolean", description: "True if a kid profile is active (simpler language, more warmth)" }
        },
        required: ["emotion", "context"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_daily_briefing",
      description: "Generate a summary of today's schedule, tasks, and important items for the family.",
      parameters: {
        type: "object",
        properties: {
          forPerson: { type: "string", description: "Generate briefing for specific person or 'family'" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information. Use for weather, news, recipes, general questions about the world.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ask_clarification",
      description: "Ask the user a clarifying question when the request is ambiguous.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The clarifying question" },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Suggested options as tappable choices"
          }
        },
        required: ["question"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_daily_spotlight",
      description: "Change what the Daily Spotlight widget shows. User can request facts, news, quotes, or any topic.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "What the user wants to see" },
          useWebSearch: { type: "boolean", description: "Whether to search the web for current info" }
        },
        required: ["topic"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_food",
      description: "Log a food item to the nutrition tracker.",
      parameters: {
        type: "object",
        properties: {
          food: { type: "string", description: "Food item name" },
          meal: { type: "string", enum: ["Breakfast","Lunch","Dinner","Snacks"], description: "Which meal" },
          quantity: { type: "string", description: "Amount like '1 cup' or '2 slices'" }
        },
        required: ["food"]
      }
    }
  }
];

// ═══ WRITE vs READ classification ═══
const WRITE_ACTIONS = new Set([
  'create_calendar_event', 'delete_event', 'delete_events_bulk', 'edit_event',
  'add_expense', 'add_shopping_item', 'add_task_for_kid', 'log_food'
]);

// ═══ SYSTEM PROMPT BUILDER ═══
function buildSystemPrompt(appState) {
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

  return `You are "bby sonnet Jr.", the AI assistant for the Lucac Life family app.
You help a co-parenting family manage their calendar, tasks, budget, nutrition, and daily life.

## Today
- Date: ${dateStr} (${dayName})
- Current user: ${appState.userName} (${appState.userRole})
- Family members: ${appState.familyMembers.join(', ')}
- Tomorrow: ${tomorrow}
- Next week starts: ${nextWeek}

## Your Personality
- Warm, helpful, slightly playful but focused on getting things done
- Keep responses SHORT — this is a phone app, not a desktop
- Use emoji sparingly but effectively
- If you make a mistake, own it: "My bad! Let me fix that."

## Rules
1. ALWAYS use tools to read or write app data. Never guess or fabricate information.
2. For WRITE actions (create, delete, edit, add expense, add shopping item, add task, log food): call the tool. The app will show a preview for user confirmation.
3. For READ actions (get calendar, get budget, get kids status): call the tool and summarize results naturally.
4. If ambiguous, use ask_clarification with tappable option suggestions.
5. Convert relative dates: "tomorrow" = ${tomorrow}, "next week" starts ${nextWeek}. TODAY = ${dateStr}.
6. For emotional support: use emotional_support tool. Be warm and real. Never dismiss feelings.
7. If you can't do something: say what you CAN do. Never silently fail.
8. For web searches: use web_search tool. Summarize results in 2-3 sentences.`;
}

// ═══ GROQ API CALL WITH RETRY ═══
async function callGroqWithRetry(apiKey, messages, tools, options = {}) {
  const { maxRetries = 2, temperature = 0.3 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const body = {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature,
        max_tokens: 1024
      };
      if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
          console.log('[aiAgent] Groq response:', data.choices?.[0]?.message?.tool_calls ? 'TOOL_CALLS' : 'TEXT', data.choices?.[0]?.finish_reason);
        }
        return data;
      }

      const errorBody = await response.text().catch(() => '');
      console.error(`[aiAgent] Groq API error ${response.status}:`, errorBody.slice(0, 300));

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }

      throw new Error(`Groq API error: ${response.status} — ${errorBody.slice(0, 100)}`);
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === maxRetries) throw error;
      if (error.name === 'AbortError' && attempt < maxRetries) {
        continue;
      }
      throw error;
    }
  }
}

// ═══ READ TOOL EXECUTOR (runs immediately, no confirmation) ═══
async function executeReadTool(funcName, args, appState, apiKey) {
  switch (funcName) {
    case 'get_calendar_events': {
      const events = appState.getEventsInRange(args.startDate, args.endDate || args.startDate, args.person);
      if (!events || events.length === 0) return "No events found for that date range.";
      return events.map(e => `• ${e.title} — ${e.date} at ${e.time || 'all day'}${e.who ? ' (' + e.who + ')' : ''}`).join('\n');
    }
    case 'get_budget_summary': {
      return appState.getBudgetSummary(args.period, args.category);
    }
    case 'get_kids_status': {
      return appState.getKidsStatus(args.kidName);
    }
    case 'web_search': {
      try {
        const tavilyKey = import.meta.env.VITE_TAVILY_KEY;
        if (!tavilyKey) return "Web search is not configured (missing API key).";
        const resp = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: tavilyKey, query: args.query, max_results: 3, search_depth: 'basic' })
        });
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
          return data.results.map(r => `${r.title}: ${r.content?.slice(0, 200)}`).join('\n\n');
        }
        return "No results found.";
      } catch {
        return "Web search temporarily unavailable.";
      }
    }
    case 'ask_clarification': {
      return JSON.stringify({ type: 'clarification', question: args.question, options: args.options || [] });
    }
    case 'emotional_support': {
      const isKid = args.isChild || false;
      const kidPrompt = isKid
        ? "You are a kind, warm friend talking to a child (age 6-8). Use simple words. Be encouraging and gentle. Use emoji. Make them feel safe and heard. Never dismiss their feelings. Keep it to 2-3 short sentences."
        : "You are a supportive friend. Be warm, real, and honest — not fake-positive. Acknowledge what they're feeling first, then help them see a path forward. If they're happy, celebrate with them. If they're sad, sit with them in it before offering hope. Keep it to 3-4 sentences. Be conversational, not clinical.";
      const supportResp = await callGroqWithRetry(apiKey, [
        { role: 'system', content: kidPrompt },
        { role: 'user', content: `I'm feeling ${args.emotion}. ${args.context}` }
      ], null, { temperature: 0.8 });
      return supportResp.choices?.[0]?.message?.content || "I'm here for you. Tell me more about what's going on.";
    }
    case 'generate_daily_briefing': {
      return appState.getDailyBriefingData(args.forPerson);
    }
    case 'update_daily_spotlight': {
      if (args.useWebSearch) {
        const searchResult = await executeReadTool('web_search', { query: args.topic }, appState, apiKey);
        return `SPOTLIGHT_UPDATE:${args.topic}|||${searchResult}`;
      }
      return `SPOTLIGHT_UPDATE:${args.topic}|||Generating content about: ${args.topic}`;
    }
    default:
      return `Unknown tool: ${funcName}`;
  }
}

// ═══ THE AGENT LOOP — the entire brain ═══
async function runAgentLoop(apiKey, userMessage, appState, conversationHistory = []) {
  const systemPrompt = buildSystemPrompt(appState);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-20),
    { role: 'user', content: userMessage }
  ];

  const MAX_ITERATIONS = 5;
  let iterations = 0;
  const actions = [];

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await callGroqWithRetry(apiKey, messages, TOOLS, {
      temperature: actions.length > 0 ? 0.2 : 0.4
    });

    const assistantMessage = response.choices?.[0]?.message;
    if (!assistantMessage) {
      return { type: 'text', content: "I didn't get a response. Try again?", actions: [], conversationHistory: messages.slice(1) };
    }

    messages.push(assistantMessage);

    // No tool calls = final text response
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        type: 'text',
        content: assistantMessage.content || "",
        actions,
        conversationHistory: messages.slice(1)
      };
    }

    // Process each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const funcName = toolCall.function.name;
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.warn(`aiAgent: failed to parse args for ${funcName}:`, e.message);
        args = {};
      }

      if (WRITE_ACTIONS.has(funcName)) {
        // WRITE actions: queue for preview, don't execute
        actions.push({ id: toolCall.id, function: funcName, args });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `Action queued for user confirmation: ${funcName}(${JSON.stringify(args)})`
        });
      } else {
        // READ actions: execute immediately
        const result = await executeReadTool(funcName, args, appState, apiKey);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }
    }
  }

  return {
    type: 'text',
    content: "I got a bit confused processing that. Could you try rephrasing?",
    actions: [],
    conversationHistory: messages.slice(1)
  };
}

// ═══ ACTION PREVIEW LABEL GENERATORS ═══
function getActionPreviewLabel(action) {
  const { function: fn, args } = action;
  switch (fn) {
    case 'create_calendar_event':
      return `📅 Add: "${args.title}" on ${args.date}${args.time ? ' at ' + args.time : ''}${args.person ? ' for ' + args.person : ''}`;
    case 'delete_event':
      return `🗑️ Delete: events matching "${args.searchTerm}"`;
    case 'delete_events_bulk':
      return args.deleteAll ? `🗑️ Delete ALL events from calendar` : `🗑️ Delete all events on ${args.date}${args.searchTerm ? ' matching "' + args.searchTerm + '"' : ''}`;
    case 'edit_event':
      return `✏️ Edit: "${args.searchTerm}"${args.newTitle ? ' → "' + args.newTitle + '"' : ''}${args.newTime ? ' → ' + args.newTime : ''}${args.newDate ? ' → ' + args.newDate : ''}`;
    case 'add_expense':
      return `💰 Log expense: $${args.amount} — ${args.description}${args.category ? ' (' + args.category + ')' : ''}`;
    case 'add_shopping_item':
      return `🛒 Add to shopping list: "${args.item}"`;
    case 'add_task_for_kid':
      return `⭐ Assign to ${args.kidName}: "${args.task}" (${args.stars || 5} stars)`;
    case 'log_food':
      return `🍽️ Log: ${args.quantity || ''} ${args.food}${args.meal ? ' (' + args.meal + ')' : ''}`;
    case 'emotional_support':
      return `💛 Talking about: ${args.emotion}`;
    default:
      return `${fn}: ${JSON.stringify(args)}`;
  }
}

export { runAgentLoop, getActionPreviewLabel };
