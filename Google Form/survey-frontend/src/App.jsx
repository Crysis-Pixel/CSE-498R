// src/App.jsx
import { useState, useEffect } from "react";
import Papa from "papaparse";
import "./App.css";

function App() {
  const [samples, setSamples] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [responses, setResponses] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);

  useEffect(() => {
    // Fetch and parse CSV file
    fetch("/balanced_1500_dataset.csv")
      .then((response) => response.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            const data = result.data;
            const categories = {};
            
            // Add row number to each item
            const dataWithRowNum = data.map((item, index) => ({
              ...item,
              rowNum: index + 1  // Row numbers start from 1
            }));
            
            dataWithRowNum.forEach((item) => {
              // Check if the item has text and category
              if (item.text && item.category) {
                if (!categories[item.category]) {
                  categories[item.category] = [];
                }
                categories[item.category].push({
                  text: item.text,
                  category: item.category,
                  label: item.label,
                  rowNum: item.rowNum
                });
              }
            });

            // Ensure exactly 2 samples per category for the 4 categories
            const expectedCategories = ["essay", "novel", "poem", "story"];
            let selectedSamples = [];
            let selectedKeys = new Set(); // To track selected samples by rowNum

            // Check if each category has at least 2 samples
            const categoriesWithInsufficientSamples = expectedCategories.filter(category => 
              !categories[category] || categories[category].length < 2
            );

            if (categoriesWithInsufficientSamples.length > 0) {
              console.error(`The following categories do not have at least 2 samples in the dataset: ${categoriesWithInsufficientSamples.join(', ')}`);
              // Fallback: select 10 random samples from all available
              const allSamples = [];
              for (let category in categories) {
                allSamples.push(...categories[category]);
              }
              allSamples.sort(() => Math.random() - 0.5);
              setSamples(allSamples.slice(0, 10));
              return;
            }

            // Select exactly 2 samples from each category
            expectedCategories.forEach((category) => {
              // Shuffle the category samples
              const shuffledCategorySamples = [...categories[category]].sort(() => Math.random() - 0.5);
              
              // Select exactly 2 samples from this category
              let count = 0;
              for (let i = 0; i < shuffledCategorySamples.length && count < 2; i++) {
                const sample = shuffledCategorySamples[i];
                
                // If we haven't selected this sample before
                if (!selectedKeys.has(sample.rowNum)) {
                  selectedSamples.push(sample);
                  selectedKeys.add(sample.rowNum);
                  count++;
                }
              }
            });

            // Collect all remaining samples that haven't been selected yet
            const allRemaining = [];
            for (let category in categories) {
              categories[category].forEach(sample => {
                if (!selectedKeys.has(sample.rowNum)) {
                  allRemaining.push(sample);
                }
              });
            }

            // Shuffle the remaining samples
            allRemaining.sort(() => Math.random() - 0.5);

            // Add 2 more random samples from any category
            let additionalCount = 0;
            for (let i = 0; i < allRemaining.length && additionalCount < 2; i++) {
              const sample = allRemaining[i];
              selectedSamples.push(sample);
              additionalCount++;
            }

            setSamples(selectedSamples);
          },
          error: (error) => console.error("Error parsing CSV:", error),
        });
      })
      .catch((error) => console.error("Error loading CSV:", error));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prepare responses for backend
    const backendResponses = samples.map((sample, index) => ({
      rowNum: sample.rowNum,
      predicted: responses[index] || "",
      actual: sample.label
    }));
    
    const submissionData = {
      studentId,
      responses: backendResponses
    };
    
    try {
      const response = await fetch('http://localhost:5000/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Submission successful:', result);
        setScore(result.marks);
        setSubmitted(true);
      } else {
        const error = await response.json();
        console.error('Submission failed:', error);
        alert(`Failed to submit responses: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting responses:', error);
      alert('An error occurred while submitting your responses. Please try again.');
    }
  };

  const handleResponseChange = (questionIndex, value) => {
    setResponses((prev) => ({ ...prev, [questionIndex]: value }));
  };

  return (
    <div className="App">
      <h1>AI vs Human Text Classification</h1>
      <p className="instructions">
        Read each text sample carefully and predict whether it was written by an AI or a human.
        Select your answer for each question before submitting your responses.
      </p>
      
      {submitted && score !== null ? (
        <div className="score-display">
          <h2>Thank you for your submission!</h2>
          <p>Your score:</p>
          <span className="score">{score}/10</span>
          <p className="warning-message">Please refrain from 2nd attempt</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="quiz-form">
          <div className="student-info">
            <label htmlFor="studentId">Student ID</label>
            <input
              type="text"
              id="studentId"
              name="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
              className="student-id"
              placeholder="Enter your student ID"
            />
          </div>
          
          <div className="questions-container">
            {samples.map((sample, index) => (
              <div key={index} className="question">
                <h3>Question {index + 1}</h3>
                <div className="text-sample">
                  {sample.text.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                
                <div className="response-options">
                  <h4>Is this text written by AI or Human?</h4>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`q${index}`}
                        value="AI"
                        checked={responses[index] === "AI"}
                        onChange={() => handleResponseChange(index, "AI")}
                        required
                      />
                      <span className="radio-label">AI</span>
                    </label>
                    
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`q${index}`}
                        value="Human"
                        checked={responses[index] === "Human"}
                        onChange={() => handleResponseChange(index, "Human")}
                      />
                      <span className="radio-label">Human</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="submit-container">
            <button type="submit" className="submit-button">
              Submit Responses
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default App;