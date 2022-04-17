// MODULES ----------------------------------------------------------------------------
/** Postgres */
const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
client.connect();

/** Express */
const express = require('express');
const cors = require('cors');
const app = express();
const corsOptions = { origin: '*' }
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

/** Custom Routes */
const { router: itemRouter } = require('./routes/items');
const { router: attributesRouter } = require('./routes/attributes');
const { router: accountsRouter } = require('./routes/accounts');



// FILES ------------------------------------------------------------------------------
const config = require('./json/config.json')



// MIDDLEWARE -------------------------------------------------------------------------
/** CORS */
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'accept, authorization, content-type, x-requested-with');
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
});

/** AUTH */
app.use(async function authenticateUser (req, res, next) { 

    console.log('Request received: ', req.query, req.body, req.originalUrl)

    // Check for valid passkey
    const passKey = req.query.passKey || req.body.passKey;
    if (!passKey) { res.status(401).send('Authentication failed: no passKey param supplied'); return; }
    if (passKey !== config.apiServer.authPassKey) { res.status(401).send('Authentication failed: passKey is not valid'); return; }

    // Attach variables to the req
    req.client = client;        // Postgres client

    next();
});



// TEST ENDPOINT ----------------------------------------------------------------------
app.get('/test', cors(corsOptions), async function (req, res) { 
    res.send('Hello World!');
});



// ROUTES -----------------------------------------------------------------------------
app.use('/items', cors(corsOptions), itemRouter);
app.use('/attributes', cors(corsOptions), attributesRouter);
app.use('/accounts', cors(corsOptions), accountsRouter);



// RUN SERVER -------------------------------------------------------------------------
const port = process.env.PORT || config.apiServer.port;
app.listen(port, () => console.log('API server running on port', port));