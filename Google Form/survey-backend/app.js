// server.js
const express = require('express');
const bodyParser = require('body-parser');
const csv = require('csv-writer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Create results directory if it doesn't exist
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

// Path to the result CSV file for all students
const resultFile = path.join(resultsDir, 'result.csv');

// Path to the marks CSV file
const marksFile = path.join(resultsDir, 'marks.csv');

// Initialize the CSV files with headers if they don't exist
function initializeFiles() {
  // Initialize result.csv
  if (!fs.existsSync(resultFile)) {
    fs.writeFileSync(resultFile, 'ID,Sample Number,Predicted Label,Actual Label\n', 'utf8');
    console.log('Initialized result.csv file');
  }
  
  // Initialize marks.csv
  if (!fs.existsSync(marksFile)) {
    fs.writeFileSync(marksFile, 'StudentID,Marks\n', 'utf8');
    console.log('Initialized marks.csv file');
  }
}


// Helper function to append records to CSV without extra newlines
function appendToCsv(filePath, records, headers) {
  // Check if file exists and has content (beyond just headers)
  const fileExists = fs.existsSync(filePath);
  const headerString = headers.map(h => h.title).join(',');
  const isEmpty = !fileExists || fs.readFileSync(filePath, 'utf8').trim() === headerString;
  
  // Convert records to CSV format
  const csvString = records.map(record => {
    return headers.map(header => {
      // Get the value
      const value = record[header.id] || '';
      
      // For marks file, don't add quotes
      if (filePath === marksFile) {
        return value.toString();
      }
      
      // For result file, escape quotes and wrap in quotes if needed
      return `"${value.toString().replace(/"/g, '""')}"`;
    }).join(',');
  }).join('\n');
  
  // Prepare the content to append
  let contentToAppend = '';
  if (!isEmpty) {
    // Add a newline before appending if file already has content
    contentToAppend = '\n';
  }
  contentToAppend += csvString;
  
  // Append to file
  fs.appendFileSync(filePath, contentToAppend, 'utf8');
}

// Route to handle survey submission
app.post('/api/submit', async (req, res) => {
  try {
    // Ensure the result files exist
    initializeFiles();

    const { studentId, responses } = req.body;
    
    if (!studentId || !responses || !Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'Invalid submission data' });
    }

    // Calculate marks (number of correct predictions)
    let correctCount = 0;
    const records = responses.map(response => {
      const isCorrect = response.predicted.toLowerCase() === response.actual.toLowerCase();
      if (isCorrect) correctCount++;
      
      return {
        id: studentId,
        sampleNumber: response.rowNum,
        predictedLabel: response.predicted,
        actualLabel: response.actual
      };
    });
    
    // Append to the result.csv file
    const resultHeaders = [
      { id: 'id', title: 'ID' },
      { id: 'sampleNumber', title: 'Sample Number' },
      { id: 'predictedLabel', title: 'Predicted Label' },
      { id: 'actualLabel', title: 'Actual Label' }
    ];
    
    appendToCsv(resultFile, records, resultHeaders);
    console.log(`Responses appended to result.csv for student ${studentId}`);
    
    // Prepare marks record
    const marksRecord = {
      studentID: studentId,
      marks: correctCount
    };
    
    // Append to the marks.csv file
    const marksHeaders = [
      { id: 'studentID', title: 'StudentID' },
      { id: 'marks', title: 'Marks' }
    ];
    
    appendToCsv(marksFile, [marksRecord], marksHeaders);
    console.log(`Marks recorded for student ${studentId}: ${correctCount}/10`);
    
    res.status(200).json({ 
      message: 'Responses submitted successfully',
      marks: correctCount
    });
    
  } catch (error) {
    console.error('Error processing submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get all responses (for admin purposes)
app.get('/api/responses', (req, res) => {
  try {
    if (!fs.existsSync(resultFile)) {
      return res.status(404).json({ error: 'No responses found' });
    }
    
    const fileContent = fs.readFileSync(resultFile, 'utf8');
    res.status(200).send(fileContent);
  } catch (error) {
    console.error('Error reading responses:', error);
    res.status(500).json({ error: 'Failed to retrieve responses' });
  }
});

// Route to get all marks (for admin purposes)
app.get('/api/marks', (req, res) => {
  try {
    if (!fs.existsSync(marksFile)) {
      return res.status(404).json({ error: 'No marks found' });
    }
    
    const fileContent = fs.readFileSync(marksFile, 'utf8');
    res.status(200).send(fileContent);
  } catch (error) {
    console.error('Error reading marks:', error);
    res.status(500).json({ error: 'Failed to retrieve marks' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initializeFiles();
});