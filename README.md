# Telegram Trello Bot

This project implements a Telegram bot that integrates with Trello, allowing users to interact with their Trello boards through Telegram.

## Features

- Connect Telegram users to their Trello accounts
- Get Trello board link
- Receive notifications when cards are moved between lists
- Automatic creation of "In Progress" and "Done" lists on the Trello board

## Prerequisites

- Node.js
- MySQL database
- Telegram Bot Token
- Trello API Key and Token
- A domain for webhook callbacks

## Environment Variables

The following environment variables need to be set:

- `TELEGRAM_BOT_TOKEN`: Your Telegram Bot Token
- `TRELLO_BOARD_ID`: ID of the Trello board to interact with
- `TRELLO_BOARD_LINK`: Link to the Trello board
- `TRELLO_ADMIN_API_KEY`: Trello API Key for admin operations
- `TRELLO_ADMIN_TOKEN`: Trello Token for admin operations
- `WEBHOOK_DOMAIN`: Domain for webhook callbacks
- `MYSQL_HOST`: MySQL database host
- `MYSQL_USER`: MySQL database user
- `MYSQL_PASSWORD`: MySQL database password
- `MYSQL_DATABASE`: MySQL database name
- `MYSQL_PORT`: MySQL database port
- `PORT`: (Optional) Port for the Express server (defaults to 3000)

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up the environment variables (use a `.env` file or set them in your environment)
4. Run the bot:
   ```
   node bot.js
   ```

## Usage

1. Start a conversation with the bot on Telegram
2. Use `/start` to initialize your account
3. Use `/connect_trello` to link your Trello account
4. Use `/get_board_link` to get the Trello board link

## Bot Commands

- `/start`: Initialize user in the database
- `/connect_trello`: Connect Trello account to the bot
- `/get_board_link`: Get the Trello board link

## Database Schema

The bot uses a MySQL database with a `users` table:

```sql
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegramId VARCHAR(255) NOT NULL,
    firstName VARCHAR(255) NOT NULL,
    lastName VARCHAR(255),
    username VARCHAR(255),
    trelloApiKey VARCHAR(255),
    trelloToken VARCHAR(255)
)
```

## Webhooks

The bot sets up webhooks for both Telegram and Trello to receive real-time updates:

- Telegram webhook: `{WEBHOOK_DOMAIN}/telegram-webhook`
- Trello webhook: `{WEBHOOK_DOMAIN}/trello-webhook`

## Dependencies

- `dotenv`: For loading environment variables
- `node-telegram-bot-api`: For interacting with the Telegram Bot API
- `express`: Web server framework
- `mysql2`: MySQL database driver
- `axios`: HTTP client for making API requests

## Note

Ensure that your webhook domain is accessible from the internet and properly configured to receive webhook events from both Telegram and Trello.
