document.addEventListener('DOMContentLoaded', () => {
    const { states, documentCategories, documentTypes } = data;
    console.log('Available states:', states);

    const stateSelect = document.getElementById('state');
    const documentCategorySelect = document.getElementById('documentCategory');
    const documentTypeSelect = document.getElementById('documentType');
    const createBtn = document.getElementById('createBtn');
    const questionsContainer = document.getElementById('questionsContainer');
    const answerBtn = document.getElementById('answerBtn');
    const documentContainer = document.getElementById('documentContainer');
  
    // Populate states dropdown
    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        stateSelect.appendChild(option);
    });
  
    // Populate document categories
    documentCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.value;
        option.textContent = category.label;
        documentCategorySelect.appendChild(option);
    });
  
    // Update document types when category changes
    documentCategorySelect.addEventListener('change', () => {
        const category = documentCategorySelect.value;
        documentTypeSelect.innerHTML = '<option value="">-- Select Document Type --</option>';
        
        if (category && documentTypes[category]) {
            documentTypes[category].forEach(docType => {
                const option = document.createElement('option');
                option.value = docType;
                option.textContent = docType;
                documentTypeSelect.appendChild(option);
            });
        }
    });
  
    // 2. Click "Create" -> Ask GPT for clarifying questions
    createBtn.addEventListener('click', async () => {
      // Clear previous Qs/document
      questionsContainer.innerHTML = '';
      documentContainer.innerHTML = '';
      answerBtn.style.display = 'none';
  
      const state = stateSelect.value;
      const county = document.getElementById('county').value.trim();
      const selectedDocType = documentTypeSelect.value;
  
      if (!state) {
        alert('Please select a state');
        return;
      }
      if (!selectedDocType) {
        alert('Please select a document type');
        return;
      }
  
      // Call backend
      try {
        const response = await fetch('http://localhost:3001/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            state, 
            county, 
            documentType: selectedDocType 
          }),
        });
        const data = await response.json();
        if (data.error) {
          alert(data.error);
          return;
        }
  
        // Parse questions with titles and content
        const lines = data.questions.split('\n');
        const questions = [];
        let currentQuestion = null;

        lines.forEach(line => {
            // Match lines that start with a number followed by. **title**:
            const titleMatch = line.match(/^(\d+)\.\s*\*\*(.*?)\*\*:\s*(.*)/);
            if (titleMatch) {
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }
                currentQuestion = {
                    number: titleMatch[1],
                    title: titleMatch[2],
                    content: titleMatch[3]
                };
            } else if (currentQuestion && line.trim()) {
                // Append non-empty lines to the current question's content
                currentQuestion.content += ' ' + line.trim();
            }
        });
        
        // Don't forget to push the last question
        if (currentQuestion) {
            questions.push(currentQuestion);
        }

        // If no structured questions found, fallback to entire text
        if (questions.length === 0) {
            questions.push({
                number: '1',
                title: 'Question',
                content: data.questions
            });
        }

        // Display clarifying questions with formatted titles and larger text areas
        questions.forEach((q, idx) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question-container';

            // Create title
            const titleDiv = document.createElement('div');
            titleDiv.className = 'question-title';
            titleDiv.innerHTML = `${q.number}. ${q.title}`;
            questionDiv.appendChild(titleDiv);

            // Create content
            const contentDiv = document.createElement('div');
            contentDiv.className = 'question-content';
            contentDiv.textContent = q.content;
            questionDiv.appendChild(contentDiv);

            // Create textarea
            const textarea = document.createElement('textarea');
            textarea.id = `answerInput${idx}`;
            textarea.rows = 4;
            textarea.className = 'answer-textarea empty';
            textarea.placeholder = 'Enter your answer here...';

            // Add event listeners for highlighting empty fields
            textarea.addEventListener('input', () => {
                if (textarea.value.trim()) {
                    textarea.classList.remove('empty');
                } else {
                    textarea.classList.add('empty');
                }
            });

            questionDiv.appendChild(textarea);
            questionsContainer.appendChild(questionDiv);
            questionsContainer.appendChild(document.createElement('br'));
        });

        // Show "Go" button
        answerBtn.style.display = 'inline-block';
        // Store questions array with the new structure
        answerBtn.dataset.questions = JSON.stringify(questions.map(q => `${q.number}. ${q.title}: ${q.content}`));
  
      } catch (error) {
        console.error(error);
        alert('Error fetching clarifying questions');
      }
    });
  
    // 3. After user fills answers, click "Go" -> send follow-up
    answerBtn.addEventListener('click', async () => {
      // Clear previous doc
      documentContainer.innerHTML = '';
  
      const questions = JSON.parse(answerBtn.dataset.questions);
      const clarifyingAnswers = [];
  
      // Loop over the input fields to get user answers
      questions.forEach((q, idx) => {
        const answerVal = document.getElementById(`answerInput${idx}`).value;
        clarifyingAnswers.push(answerVal);
      });
  
      try {
        const response = await fetch('http://localhost:3001/api/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            clarifyingQuestions: questions, 
            clarifyingAnswers 
          }),
        });
        const data = await response.json();
        if (data.error) {
          alert(data.error);
          return;
        }
  
        // data.document is the final doc
        documentContainer.textContent = data.document;
  
      } catch (error) {
        console.error(error);
        alert('Error generating final document');
      }
    });
  });