require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mysql = require('mysql2');
const axios = require('axios');

class TelegramTrelloBot {
    constructor() {

        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.trelloBoardId = process.env.TRELLO_BOARD_ID;
        this.boardLink = process.env.TRELLO_BOARD_LINK;

        this.admintrelloApiKey = process.env.TRELLO_ADMIN_API_KEY;
        this.admintrelloToken = process.env.TRELLO_ADMIN_TOKEN;

        this.webhookDomain = process.env.WEBHOOK_DOMAIN;

        this.bot = new TelegramBot(this.token);
        this.app = express();
        this.app.use(express.json());

        this.start();
    }

    async start() {
        this.initializeDatabase();
        this.setupBotCommands();
        this.setupEndpoint();
        this.startServer();
        await this.registerTelegramWebhook();
    }

    initializeDatabase() {
        this.connection = mysql.createConnection({
            host: 'localhost',
            user: 'root',   
            password: 'root',
            database: 'test',
            port: 3306        
        });

        this.connection.connect((err) => {
            if (err) {
                console.error('Error connecting to MySQL: ', err);
                return;
            }
            console.log('Connected to MySQL');
            this.createUsersTable();
            this.initializeTrelloLists();
        });
    }

    createUsersTable() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                telegramId VARCHAR(255) NOT NULL,
                firstName VARCHAR(255) NOT NULL,
                lastName VARCHAR(255),
                username VARCHAR(255),
                trelloApiKey VARCHAR(255),
                trelloToken VARCHAR(255)
            )
        `;
        this.connection.query(createTableQuery, (err) => {
            if (err) {
                console.error('Error creating table: ', err);
                return;
            }
            console.log('Table `users` is ready');
        });
    }

    async getAllUsers() {
        const getUsersQuery = 'SELECT * FROM users';
        const [results] = await this.connection.promise().query(getUsersQuery);
        return results;
    }

    async initializeTrelloLists() {
        const existingLists = await this.getTrelloLists();
        const listsToCreate = [
            { name: 'In Progress' },
            { name: 'Done' }
        ].filter(list => !existingLists.some(l => l.name === list.name));
    
        for (const list of listsToCreate) {
            try {
                const response = await axios.post(`https://api.trello.com/1/boards/${this.trelloBoardId}/lists`, {
                    name: list.name,
                    key: this.admintrelloApiKey,
                    token: this.admintrelloToken
                });
                console.log(`List created: ${response.data.name}`);
            } catch (error) {
                console.error('Error creating list:', error);
            }
        }
    }
    
    getTrelloLists = async () => {
        try {
            const response = await axios.get(`https://api.trello.com/1/boards/${this.trelloBoardId}/lists?key=${this.admintrelloApiKey}&token=${this.admintrelloToken}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching Trello lists:', error);
            return [];
        }
    }

    handleGetBoardLink(msg, chatid) {
        const chatId = msg.chat.id || chatid;
        this.bot.sendMessage(chatId, `Board link: ${this.boardLink}`);
    }

    setupBotCommands() {
        this.bot.onText(/\/start/, this.handleStart.bind(this));
        this.bot.onText(/\/connect_trello/, this.handleConnectTrello.bind(this));
        this.bot.onText(/\/get_board_link/, this.handleGetBoardLink.bind(this));
    }

    async handleStart(msg) {
        const chatId = msg.chat.id;
        const firstName = msg.from.first_name;
        const lastName = msg.from.last_name || '';
        const username = msg.from.username || '';

        const user = await this.getUserByTelegramId(chatId);
        if (!user) {
            await this.addNewUser(chatId, firstName, lastName, username);
            this.bot.sendMessage(chatId, `Hi, ${firstName}! You saved in database.`);
        } else {
            this.bot.sendMessage(chatId, `Hello again, ${firstName}!`);
        }
    }

    async handleConnectTrello(msg) {
        const chatId = msg.chat.id;
    
        // Ask for Trello API Key
        const askForApiKey = () => {
            return new Promise((resolve, reject) => {
                this.bot.sendMessage(chatId, 'Please reply with your Trello API Key:').then(() => {
                    this.bot.once('message', (apiKeyMsg) => {
                        const trelloApiKey = apiKeyMsg.text.trim();
                        if (trelloApiKey) {
                            resolve(trelloApiKey);
                        } else {
                            reject(new Error('Invalid Trello API Key'));
                        }
                    });
                });
            });
        };
    
        // Ask for Trello Token
        const askForToken = () => {
            return new Promise((resolve, reject) => {
                this.bot.sendMessage(chatId, 'Now, reply with your Trello Secret Token:').then(() => {
                    this.bot.once('message', (tokenMsg) => {
                        const trelloToken = tokenMsg.text.trim();
                        if (trelloToken) {
                            resolve(trelloToken);
                        } else {
                            reject(new Error('Invalid Trello Token'));
                        }
                    });
                });
            });
        };
    
        try {
            const trelloApiKey = await askForApiKey();
            const trelloToken = await askForToken();
    
            await this.saveUserTrelloCredentials(chatId, trelloApiKey, trelloToken);
    
            this.bot.sendMessage(chatId, `Board link: ${this.boardLink}`);
            this.bot.sendMessage(chatId, 'Trello credentials saved!');
        } catch (error) {
            this.bot.sendMessage(chatId, `Error: ${error.message}`);
        }
    }
    

    async saveUserTrelloCredentials(chatId, trelloApiKey, trelloToken) {
        const user = await this.getUserByTelegramId(chatId);
        if (user) {
            const updateUserQuery = 'UPDATE users SET trelloApiKey = ?, trelloToken = ? WHERE telegramId = ?';
            await this.connection.promise().query(updateUserQuery, [trelloApiKey, trelloToken, chatId]);
            this.registerTrelloWebhook(trelloToken, trelloApiKey, chatId);
        } else {
            this.bot.sendMessage(chatId, 'User not exist, reinit bot with /start command.');
        }
    }
    
    async getUserByTelegramId(telegramId) {
        const findUserQuery = 'SELECT * FROM users WHERE telegramId = ?';
        const [results] = await this.connection.promise().query(findUserQuery, [telegramId]);
        return results.length > 0 ? results[0] : null;
    }

    async addNewUser(telegramId, firstName, lastName, username) {
        const insertUserQuery = 'INSERT INTO users (telegramId, firstName, lastName, username) VALUES (?, ?, ?, ?)';
        await this.connection.promise().query(insertUserQuery, [telegramId, firstName, lastName, username]);
    }

    async handleCardMoved(card, list, chatId) {
        const users = await this.getAllUsers();
        for (const user of users) {
            const chatId = user.telegramId;
            this.bot.sendMessage(chatId, `The card "${card.name}" has been moved to the "${list.name}" list on Trello.`);
        }
    }

    processWebhookEvent(event, chatId) {
        if (event.action.type === 'updateCard' && event.action.data.listAfter) {
            this.handleCardMoved(event.action.data.card, event.action.data.listAfter, chatId);
        }
    }

    async registerTelegramWebhook() {
        const webhookUrl = `${this.webhookDomain}/telegram-webhook`;
    
        try {
            const response = await this.bot.setWebHook(webhookUrl);
            console.log('Telegram webhook registered:', response);
        } catch (error) {
            console.error('Error registering Telegram webhook:', error);
        }
    }

    async registerTrelloWebhook(token, apiKey, chatId) {
        const webhookUrl = `${this.webhookDomain}/webhook?chatid=${chatId}`;

        try {
            const existingWebhooks = await this.getTrelloWebhooks(token, apiKey);
            const existingWebhook = existingWebhooks.find(webhook => webhook.callbackURL === webhookUrl);
            if (existingWebhook) {
                console.log('Webhook already registered:', existingWebhook.id);
                return;
            }

            const response = await axios.post(`https://api.trello.com/1/tokens/${token}/webhooks?key=${apiKey}`, {
                description: 'Telegram Bot Webhook',
                callbackURL: webhookUrl,
                idModel: this.trelloBoardId
            });

            console.log('Webhook registered:', response.data.id);
        } catch (error) {
            console.error('Error registering Trello webhook:', error);
        }
    }

    async getTrelloWebhooks(token = this.trelloToken, apiKey = trelloApiKey) {
        try {
            const response = await axios.get(`https://api.trello.com/1/tokens/${token}/webhooks?key=${apiKey}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching Trello webhooks:', error);
            return [];
        }
    }

    setupEndpoint() {
        this.app.post('/webhook', async (req, res) => {
            const chatId = req.query.chatid || null;
            if (chatId) {
                this.processWebhookEvent(req.body, chatId);
            }
            res.sendStatus(200);
        });

        this.app.post('/telegram-webhook', async (req, res) => {
            console.log(`Telegram webhook receive ${req.body}`);
            this.bot.processUpdate(req.body);
            res.sendStatus(200);
        });

        this.app.get('/webhook', (req, res) => {
            res.sendStatus(200);
        });

        this.app.get('/test', (req, res) => {
            res.send('Server working correctly!');
        });

        this.app.get('/', (req, res) => {
            res.send('Hello World!');
        });
    }

    startServer() {
        this.app.listen(3000, () => {
            console.log('Node server started at 3000 port');
        });
    }
}


new TelegramTrelloBot();