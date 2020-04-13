var http = require('http');
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);


        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // add any session init logic here
}

/**
 * Called when the user invokes the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId
        + ", sessionId=" + session.sessionId);

    var cardTitle = "Hello, World!";
    var speechOutput = "Welcome to Pill Pal! What would you like to do or know about?";
    callback(session.attributes,
        buildSpeechletResponse(cardTitle, speechOutput, "", false));
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId
        + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // dispatch custom intents to handlers here
    switch(intentName)
    {
        case 'getName':
            giveName(intent, session, callback);
            break;
        case 'getPills':
            giveCurrentPills(intent, session, callback);
            break;
        case 'addPill':
            addPill(intent, session, callback);
            break;
        case 'removeOnePill':
            removeOnePill(intent, session, callback);
            break;
        case 'removeAllPills':
            removeAllPills(intent, session, callback);
            break;
        default:
            throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // Add any cleanup logic here
}

function giveName(intent, session, callback) {
    http.get({
        host: 'pillpal-app.de',
        path: '/User/0',
    }, function(res) {
        res.setEncoding('utf8');
        // Continuously update stream with data
        var body = '';
        res.on('data', function(d) {
            body += d;
        });
        res.on('end', function() {

            try {
                // console.log(body);
                var parsed = JSON.parse(body);
                // callback(parsed.MRData);
                
                callback(session.attributes,
                    buildSpeechletResponseWithoutCard("You are currently managing the account that belongs to " + parsed[0].First_Name + " " + parsed[0].Last_Name + ".", "", "true"));
                
                //return parsed.MRData;
            } catch (err) {
                console.error('Unable to parse response as JSON', err);
                throw(err);
            }
        });
    }).on('error', function(err) {
        // handle errors with the request itself
        console.error('Error with the request:', err.message);
        throw(err);
    });
}

function giveCurrentPills(intent, session, callback) {
    http.get({
        host: 'pillpal-app.de',
        path: '/Takes/0',
    }, function(res) {
        res.setEncoding('utf8');
        // Continuously update stream with data
        var body = '';
        res.on('data', function(d) {
            body += d;
        });
        res.on('end', function() {

            try {
                // console.log(body);
                var parsed = JSON.parse(body);
                // callback(parsed.MRData);
                if (parsed.length > 0)
                {
                    let listOfMeds = "";
                    for (let i = 0; i < parsed.length; i++)
                    {
                        if (i == 0)
                        {
                             listOfMeds += parsed[i].Display_Name;   
                        }
                        else
                        {
                            listOfMeds += " and " + parsed[i].Display_Name;  
                        }
                    }
                    callback(session.attributes,
                    buildSpeechletResponseWithoutCard("You are currently taking " + listOfMeds + ".", "", "true"));
                }
                else
                {
                    callback(session.attributes,
                    buildSpeechletResponseWithoutCard("You are not currently taking any medication.", "", "true"));
                }
                
                //return parsed.MRData;
            } catch (err) {
                console.error('Unable to parse response as JSON', err);
                throw(err);
            }
        });
    }).on('error', function(err) {
        // handle errors with the request itself
        console.error('Error with the request:', err.message);
        throw(err);
    });
}

function addPill(intent, session, callback) {
    const request = require('request');
    
    var postData = {
      'User_ID' : '0',
      'Medication_ID': 'error',
      'Amount_Prescribed': intent.slots.Amount_Prescribed.value,
      'Refills': intent.slots.Refills.value,
      'Display_Name': intent.slots.Pill.value
    };
    
    request.post('https://pillpal-app.de/Takes', {json: postData}, (error, response, body) => {
        console.log('ERROR: ' + error);
        console.log('BODY: ' + JSON.stringify(body.message));
        console.log('RESPONSE: ' + JSON.stringify(response));
        if (JSON.stringify(body.message).includes('ER_DUP_ENTRY'))
        {
            callback(session.attributes, buildSpeechletResponseWithoutCard('You already have ' + postData.Display_Name + ' as a current pill.', "", "true"));
        }
        else if (JSON.stringify(body.message).includes('ER_NO_REFERENCED_ROW_2'))
        {
            callback(session.attributes, buildSpeechletResponseWithoutCard('Sorry, ' + postData.Display_Name + ' is not currently registered with PillPal as an available medication. Go to the Help page in Settings on the PillPal app for more information or to report a problem.', "", "true"));
        }
        else
        {
            callback(session.attributes, buildSpeechletResponseWithoutCard('Okay, I\'ve added ' + postData.Display_Name + ' as a current pill. You need to take ' + postData.Amount_Prescribed + ' each day and you have ' + postData.Refills + ' refills remaining.', "", "true"));   
        }
    });
}

function removeOnePill(intent, session, callback) {
    const request = require('request');
    
    var postData = {
      'User_ID' : '0',
      'Display_Name': intent.slots.Pill.value
    };
    
    request.delete('https://pillpal-app.de/Takes/0/' + postData.Display_Name, (error, response, body) => {
        console.log('ERROR: ' + error);
        console.log('BODY: ' + JSON.stringify(body));
        console.log('RESPONSE: ' + JSON.stringify(response));
        if (JSON.stringify(response.statusCode) == 404)
        {
            callback(session.attributes,
                buildSpeechletResponseWithoutCard(postData.Display_Name + ' is not one of your current pills.', "", "true"));
        }
        else
        {
            callback(session.attributes,
                buildSpeechletResponseWithoutCard('Okay, I\'ve deleted ' + postData.Display_Name + ' from your current pills.', "", "true"));   
        }
    });
}

function removeAllPills(intent, session, callback) {
    const request = require('request');
    
    request.delete('https://pillpal-app.de/Takes/0', (error, response, body) => {
        console.log('ERROR: ' + error);
        console.log('BODY: ' + JSON.stringify(body));
        console.log('RESPONSE: ' + JSON.stringify(response));
        if(JSON.stringify(response.statusCode) == 404)
        {
            callback(session.attributes,
                buildSpeechletResponseWithoutCard('You are not currently taking any medication.', "", "true"));   
        }
        else
        {
            callback(session.attributes,
                buildSpeechletResponseWithoutCard('Okay, all of your pills have been removed.', "", "true"));
        }
    });
}

// ------- Helper functions to build responses -------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: title,
            content: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildSpeechletResponseWithoutCard(output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}
