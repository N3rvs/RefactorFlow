# **App Name**: DB Refactor Toolkit

## Core Features:

- Connection String Input: A connection string input area that allows the user to set the database connection string.
- Rename Plan Editor: A JSON editor for defining rename operations (tables and columns) with validation based on scope, tableFrom, columnFrom, tableTo and columnTo rules.
- Compatibility Options: Toggle switches for useSynonyms and useViews, for rename operations.
- SQL Preview: Preview the SQL rename scripts. It consumes the rename plan, and simulate the changes against the database.
- SQL Execution: Execute rename and compat SQL scripts against the database.
- Cleanup execution: Remove backward compatibility objects such as synonyms and views.
- AI Refactor: Generative AI that accepts a plan, then acts as a tool, to either generate rename sql, create compatibility objects such as synonyms or views, and perform a code fix.

## Style Guidelines:

- Primary color: Blue (#4DA3FF), to signal trust and efficiency, traits aligned to database administration tasks.
- Background color: Dark navy (#0B0F14), providing an elegant contrast that is suitable to data-rich applications.
- Accent color: Teal (#33D9B2), to give visual interest without disrupting the serious tone.
- Font pairing: 'Inter' (sans-serif) for both headlines and body text, providing a clean, modern, and highly readable interface. Note: currently only Google Fonts are supported.
- Lucide icons for a clean and consistent visual language.
- Cards with rounded corners and soft shadows, generous padding.
- Subtle transitions and animations to enhance user experience during state changes and data loading.