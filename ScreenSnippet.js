'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const execFile = require('child_process').execFile;

// Setup Node Adapter
const { connect } = require('node-adapter');

//get the OpenFin port as a argument.
// const port = process.argv[process.argv.indexOf('--port') + 1];
//incoming message topic.
const toServiceTopic = 'to-service-topic';
//Outgoing message topic.
const toWebTopic = 'to-web-topic';
//The identity of the Web Application.
const webAppIdentity = {
    uuid: 'OpenFin-Symphony-udbrf2z9sehilik9'
};
//conection options
const connectionOptions = {
    // IS THIS ALWAYS 9696? How to tell port
    address: `ws://localhost:9696`,
    uuid: 'nodeScreenSnippet',
    nonPersistant: true // ?
};
let fin;

function sendIABMessage(data) {
    console.log('sending IAB')
    fin.InterApplicationBus.send(webAppIdentity, 'snippet', data);
}

function onConnected(f) {
    fin = f;
    //use the inter application bus.
    console.log('in oncon, fin', fin);


    screenSnippet().then(data => {
        sendIABMessage(data)
        console.log(data)
    })
    
}

//connect to the OpenFin runtime.
connect(connectionOptions).then(onConnected).catch(err => console.log(err));

let child;

const screenSnippet = () => {
    return new Promise ((resolve, reject) => {

        let tmpFilename = 'symphonyImage-' + Date.now() + '.jpg';
        let tmpDir = os.tmpdir();
        let outputFileName = path.join(tmpDir, tmpFilename);
        let snippetToolFilePath = path.join(__dirname, 'bin', 'Release', 'ScreenSnippet.exe')


        if (child) {
            child.kill();
        }

        child = execFile(snippetToolFilePath, [outputFileName], err => {  
            console.log(err)
            // will be called when child process exits.
            if (err && err.killed) {
                // process was killed, just resolve with no data.
                resolve();
            } else {
                readResult(outputFileName, resolve, reject, err);
            }
        })
    })
}

function readResult(outputFileName, resolve, reject, childProcessErr) {
    fs.readFile(outputFileName, (readErr, data) => {
        if (readErr) {
            let returnErr;
            if (readErr.code === 'ENOENT') {
                // no such file exists, user likely aborted
                // creating snippet. also include any error when
                // creating child process.
                returnErr = createWarn('file does not exist ' +
                    childProcessErr);
            } else {
                returnErr = createError(readErr + ',' +
                    childProcessErr);
            }

            reject(returnErr);
            return;
        }

        if (!data) {
            reject(createWarn('no file data provided'));
            return;
        }

        try {
            // convert binary data to base64 encoded string
            let output = Buffer(data).toString('base64');
            resolve({
                type: 'image/jpg;base64',
                data: output
            });
        } catch (error) {
            reject(createError(error));
        } finally {
            // remove tmp file (async)
            fs.unlink(outputFileName, function(err) {
                // note: node complains if calling async
                // func without callback.
                if (err) {
                    console.log('ScreenSnippet: error removing temp snippet file: ' +
                        outputFileName + ', err:' + err);
                }
            });
        }
    });
}

function createError(msg) {
    let err = new Error(msg);
    err.type = 'ERROR';
    return err;
}

function createWarn(msg) {
    let err = new Error(msg);
    err.type = 'WARN';
    return err;
}
