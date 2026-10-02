# Dynamic Bot Brain Store

Each autonomous bot gets a UUID and an isolated runtime brain at:

registry/bots/<bot-uuid>/brain.json

The committed index.json is the lightweight registry manifest. The backend creates bot directories and brain files on demand, while the browser mirrors safe bot metadata and memory state in LocalStorage/SessionStorage under ai-agent-multi-bot.bot-brains.

## Brain lifecycle

- Create -> UUID + profile + empty memory.
- Load -> category/role matching selects the least-busy compatible bot.
- Execute -> private system prompt + recent memory are supplied to the specialist.
- Remember -> task/result entries are appended to that bot's brain.
- Reset -> memory is cleared without deleting the profile.
- Delete -> profile and isolated brain directory are removed.

The platform keeps registry/bot_registry.json as the existing task/event registry for backward compatibility; registry/bots/ is the autonomous bot profile/brain store.
