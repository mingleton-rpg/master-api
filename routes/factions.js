/** 
 * Handles all endpoints & functions for faction management
 */

// MODULES -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();



// FUNCTIONS ---------------------------------------------------------------------------
/** Gets a faction by the ID (if supplied), or searches by name 
 * @param {Client} client Postgres-registered client object
 * @param {String} id Server-issued faction identifier
 * @param {String} name User-created faction name
*/
async function getFaction(client, id, name) { 

    let faction = null;
    if (id) { 

        // Find and return the faction
        var query = 'SELECT * FROM factions WHERE id = $1;';
        var params = [ id ];
        var err, result = await client.query(query, params);
        if (err || result.rows.length === 0) { return [ false, 'This faction does not exist' ]; }

        faction = result.rows[0];

    } else if (name) { 

        console.log(name);

        // Find and return the faction
        var query = 'SELECT * FROM factions WHERE name = $1;';
        var params = [ name ];
        var err, result = await client.query(query, params);
        if (err || result.rows.length === 0) { return [ false, 'This faction does not exist' ]; }

        faction = result.rows[0];

    } else { 
        return [ false, 'No ID or name supplied' ];
    }

    // Get all users in that faction
    var query = 'SELECT * FROM accounts WHERE faction_id = $1;';
    var params = [ faction.id ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    let factionMembers = [];
    for (account of result.rows) {
        factionMembers.push({
            id: account.id,
            dollars: account.dollars,
            hp: account.hp
        });
    }

    // Normalise values 
    return [ true, {
        id: faction.id,
        name: faction.name,
        emojiName: faction.emoji_name,
        members: factionMembers
    }]
}



// ENDPOINTS --------------------------------------------------------------------------
router.get('/id/:id/', async function (req, res) {                      // Get a faction by ID

    const client = req.client;

    const factionID = req.params.id;
    if (!factionID) { res.status(400).send('FactionID parameter not supplied.'); return; }

    // Get that faction
    const factionInfo  = await getFaction(client, factionID, null);
    if (factionInfo[0] === false) { res.status(404).send('A faction with that ID does not exist'); return; }

    res.status(200).send(JSON.stringify(factionInfo[1]));
});

router.get('/name/:name/', async function (req, res) {                  // Get a faction by name

    const client = req.client;

    const factionName = req.params.name;
    if (!factionName) { res.status(400).send('factionName parameter not supplied.'); return; }

    // Get that faction
    const factionInfo  = await getFaction(client, null, factionName);
    if (factionInfo[0] === false) { res.status(404).send('A faction with that name does not exist'); return; }

    res.status(200).send(JSON.stringify(factionInfo[1]));
});

router.post('/create/:name/:emojiName/', async function (req, res) {    // Creates a new faction

    const client = req.client;

    const name = req.params.name;
    const emojiName = req.params.emojiName;

    if (!name || !emojiName) { res.status(400).send('Name and/or emojiName parameters not supplied.'); return; }

    // Check if a faction with this name already exists
    var query = 'SELECT * FROM factions WHERE name = $1;';
    var params = [ name ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    if (result.rows.length !== 0) { res.status(403).send('A faction with that name already exists'); return; }

    // Create the faction
    var query = 'INSERT INTO factions (name, emoji_name) VALUES ($1, $2) RETURNING id;';
    var params = [ name, emojiName ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }
    const factionID = result.rows[0].id;

    // Send to caller
    res.status(200).send(JSON.stringify({ factionID: factionID }));
});

router.post('/:id/join/:userID/', async function (req, res) {           // Join a faction

    const client = req.client;
    
    const factionID = req.params.id;
    const userID = req.params.userID;

    if (!factionID || !userID) { res.status(400).send('factionID and/or userID parameters not supplied.'); return; }

    // Check if this faction exists
    var query = 'SELECT * FROM factions WHERE id = $1;';
    var params = [ factionID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }
    if (result.rows.length === 0) { res.status(404).send('A faction with that ID does not exist'); return; }
    const factionInfo = result.rows[0];

    // Check if this account exists
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }
    if (result.rows.length === 0) { res.status(404).send('An user with that ID does not exist'); return; }
    const userInfo = result.rows[0];

    // Check if this user is already in a faction
    if (userInfo.faction_id !== null) { res.status(403).send('This user is already in a faction'); return; }

    // Join this faction
    var query = 'UPDATE accounts SET faction_id = $1 WHERE id = $2;';
    var params = [ factionID, userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    // Send to caller
    res.status(200).send('Joined faction successfully!');
});

router.post('/:id/leave/:userID/', async function (req, res) {          // Leave a faction

    const client = req.client;

    const factionID = req.params.id;
    const userID = req.params.userID;

    if (!factionID || !userID) { res.status(400).send('factionID and/or userID parameters not supplied.'); return; }

    // Check if this faction exists
    var query = 'SELECT * FROM factions WHERE id = $1;';
    var params = [ factionID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }
    if (result.rows.length === 0) { res.status(404).send('A faction with that ID does not exist'); return; }
    const factionInfo = result.rows[0];

    // Check if this account exists
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }
    if (result.rows.length === 0) { res.status(404).send('An user with that ID does not exist'); return; }
    const userInfo = result.rows[0];

    // Leave this faction
    var query = 'UPDATE accounts SET faction_id = null WHERE id = $1;';
    var params = [ userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    // Check if there are any other members in this faction
    var query = 'SELECT * FROM accounts WHERE faction_id = $1;';
    var params = [ factionID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    if (result.rows.length === 0) { 
        // Remove this faction
        var query = 'DELETE FROM factions WHERE id = $1;';
        var params = [ factionID ];
        var err, result = await client.query(query, params); 
        if (err) { res.status(500).send('Internal server error'); return; }

        // Send to caller
        res.status(201).send('Left faction successfully!');
    } else {
        // Send to caller
        res.status(200).send('Left faction successfully!');
    }
});



// EXPORT ------------------------------------------------------------------------------
module.exports = { 
    router: router,
    getFaction: getFaction
}