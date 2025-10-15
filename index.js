const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const visitorsRouter = require('./api/visitors');
const scheduleRouter = require('./api/schedule');
const audioRouter = require('./api/audio');

const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Define route handlers for HTML files
const htmlDir = path.join(__dirname, 'public/html');

app.get('/', (req, res) => {
    const filePath = path.join(htmlDir, 'planner.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading the planner.html file');
            return;
        }
        res.send(data);
    });
});

app.get('/planner', (req, res) => {
    const filePath = path.join(htmlDir, 'planner.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading the planner.html file');
            return;
        }
        res.send(data);
    });
});

app.get('/index', (req, res) => {
    const filePath = path.join(htmlDir, 'planner.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading the planner.html file');
            return;
        }
        res.send(data);
    });
});

app.get('/tracker', (req, res) => {
    const filePath = path.join(htmlDir, 'tracker.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading the tracker.html file');
            return;
        }
        res.send(data);
    });
});

app.get('/home', (req, res) => {
    const filePath = path.join(htmlDir, 'tracker.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading the tracker.html file');
            return;
        }
        res.send(data);
    });
});

app.get('/insights', (req, res) => {
    const filePath = path.join(htmlDir, 'insights.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading the insights.html file');
            return;
        }
        res.send(data);
    });
});

app.get('/completions', (req, res) => {
    const filePath = path.join(htmlDir, 'insights.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading the insights.html file');
            return;
        }
        res.send(data);
    });
});

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Use the API routes
app.use('/api', visitorsRouter);
app.use('/api', scheduleRouter);
app.use('/api', audioRouter);
// Start the server and listen on port 3000
const port = 3001;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
