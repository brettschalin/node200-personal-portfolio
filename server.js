const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const app = express();
const google = require('googleapis');
const key = require('./privatekey.json');


//This is adapted from http://isd-soft.com/tech_blog/accessing-google-apis-using-service-account-node-js/
//Somehow they documented Google code better than Google
const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/spreadsheets'
    ]);
//authenticate request
jwtClient.authorize(function (err, tokens) {
    if (err) {
        console.log(err);
        return;
    }
});

//Get the current row so we don't accidentally overwrite anything
var currentRow = 2; //google.sheets is 1-based and the first row has headers
google.sheets('v4').spreadsheets.values.get({
    auth: jwtClient,
    spreadsheetId: "11lnUN4nB94zpf8PEoG3I99KXY-LAIXnv7WQlfaJNO2U",
    range: "Sheet1!A2:E"
}, (err, res) => {
    if (err) {
        console.log("Failed to load contact data:" + err);
        return;
    }
    if (res.values) {
        currentRow += res.values.length;
    }
});

app.use(express.static('public'));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('views', './public/views');
app.set('view engine', 'ejs');
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/thanks', (req, res) => {
    //calls to google sheets api
    //to log shits and stuff
    logResponse(req.body)
        .then((response) => {
            console.log("Logging was successful");
            currentRow++;
            res.render('thanks', { contact: req.body, err: null })

        })
        .catch((err) => {
            console.log("Logging failed: " + err);
            res.render('thanks', { contact: req.body, err: err })

        });
});


const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
});




function logResponse(res) {

    //The sheet is set up so each new entry is on its own row
    //lines are formatted like: [[firstName] [lastName] [email] [message] [date]]


    //this guy (https://stackoverflow.com/a/39160664) had to look through
    //the source code to figure out how calls are actually made.
    //I'll be honest. I have no idea why this works, but it does, so I'm not changing anything
    return new Promise((resolve, reject) => {
        let range = `Sheet1!A${currentRow}:E${currentRow}`;
        let now = (new Date()).toString();
        google.sheets('v4').spreadsheets.values.update({
            auth: jwtClient,
            spreadsheetId: "11lnUN4nB94zpf8PEoG3I99KXY-LAIXnv7WQlfaJNO2U",
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: [Object.values(res).concat(now)]
            }
        }, (err, resp) => {

            if (err) {
                console.log('Data Error :', err)
                reject(err);
            }

            resolve(resp);

        });

    });
}