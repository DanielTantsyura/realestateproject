document.addEventListener('DOMContentLoaded', () => {
    const { states, documentCategories, documentTypes } = data;
    console.log('Available states:', states);

    const stateSelect = document.getElementById('state');
    const documentCategorySelect = document.getElementById('documentCategory');
    const documentTypeSelect = document.getElementById('documentType');
    const createBtn = document.getElementById('createBtn');
    const questionsContainer = document.getElementById('questionsContainer');
    const answerBtn = document.getElementById('answerBtn');
    answerBtn.classList.add('hidden');  // Ensure button is hidden on page load
    const documentContainer = document.getElementById('documentContainer');
    const followupChanges = document.getElementById('followupChanges');
    const updateBtn = document.getElementById('updateBtn');
    const templateInput = document.getElementById('templateDoc');
    const templatePreview = document.querySelector('.template-preview');
    let uploadedTemplate = null;
  
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
  
    // Add these helper functions at the top of your script
    function setButtonLoading(button, originalText) {
        button.textContent = 'Loading...';
        button.disabled = true;
        button.classList.remove('success');
        return originalText;
    }

    function setButtonSuccess(button) {
        button.textContent = 'Success!';
        button.disabled = false;
        button.classList.add('success');
    }

    function resetButtonComplete(button, originalText) {
        button.textContent = originalText;
        button.disabled = false;
        button.classList.remove('success');
    }
  
    // Add validation function after your DOM element declarations
    function validateForm() {
        let isValid = true;
        const requiredFields = [
            { element: stateSelect, name: 'state' },
            { element: documentCategorySelect, name: 'document category' },
            { element: documentTypeSelect, name: 'document type' }
        ];

        const errorDiv = document.getElementById('validationError');
        
        requiredFields.forEach(field => {
            if (!field.element.value) {
                field.element.classList.add('error');
                isValid = false;
            } else {
                field.element.classList.remove('error');
            }
        });

        if (!isValid) {
            errorDiv.textContent = 'Please select all required fields';
            errorDiv.style.display = 'block';
        } else {
            errorDiv.style.display = 'none';
        }

        return isValid;
    }

    // Add input handlers to remove error state when user selects a value
    stateSelect.addEventListener('change', () => {
        if (stateSelect.value) {
            stateSelect.classList.remove('error');
            if (documentCategorySelect.value && documentTypeSelect.value) {
                document.getElementById('validationError').style.display = 'none';
            }
        }
        resetButtonComplete(createBtn, 'Begin Document Creation');
    });

    documentCategorySelect.addEventListener('change', () => {
        if (documentCategorySelect.value) {
            documentCategorySelect.classList.remove('error');
            if (stateSelect.value && documentTypeSelect.value) {
                document.getElementById('validationError').style.display = 'none';
            }
        }
        resetButtonComplete(createBtn, 'Begin Document Creation');
    });

    documentTypeSelect.addEventListener('change', () => {
        if (documentTypeSelect.value) {
            documentTypeSelect.classList.remove('error');
            if (stateSelect.value && documentCategorySelect.value) {
                document.getElementById('validationError').style.display = 'none';
            }
        }
        resetButtonComplete(createBtn, 'Begin Document Creation');
    });
  
    // Add this function after your helper functions
    function handleFileUpload(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedTemplate = e.target.result;
                // Show preview of first 200 characters
                templatePreview.textContent = `Template loaded: ${uploadedTemplate.substring(0, 200)}...`;
                templatePreview.style.display = 'block';
                resolve(uploadedTemplate);
            };
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }

    // Add this event listener after your other initialization code
    templateInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            try {
                await handleFileUpload(e.target.files[0]);
                // Reset states when new template is uploaded
                questionsContainer.innerHTML = '';
                documentContainer.innerHTML = '';
                answerBtn.classList.add('hidden');
                document.querySelector('.followup-container').style.display = 'none';
            } catch (error) {
                console.error('Error uploading file:', error);
                alert('Error uploading file');
            }
        }
    });
  
    // 2. Click "Create" -> Ask GPT for clarifying questions
    createBtn.addEventListener('click', async () => {
        if (!validateForm()) {
            return;
        }

        const originalText = setButtonLoading(createBtn, createBtn.textContent);
        
        // Clear previous content and reset states
        questionsContainer.innerHTML = '';
        documentContainer.innerHTML = '';
        answerBtn.classList.add('hidden');
        document.querySelector('.followup-container').style.display = 'none';
        
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
          // Choose endpoint based on whether template exists
          const endpoint = uploadedTemplate ? '/api/ask-with-template' : '/api/ask';
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              state, 
              county, 
              documentType: selectedDocType,
              template: uploadedTemplate 
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
          answerBtn.classList.remove('hidden');
          // Store questions array with the new structure
          answerBtn.dataset.questions = JSON.stringify(questions.map(q => `${q.number}. ${q.title}: ${q.content}`));
  
          setButtonSuccess(createBtn);
          setupAnswerTextareaListeners();
  
        } catch (error) {
          console.error(error);
          alert('Error fetching clarifying questions');
          resetButtonComplete(createBtn, 'Begin Document Creation');
        }
    });
  
    // Add this helper function at the top of your script
    function adjustTextareaHeight(textarea) {
        // Store the current scroll position
        const scrollPos = window.scrollY;
        
        // Reset height to auto to get proper scrollHeight
        textarea.style.height = 'auto';
        
        // Calculate the bottom margin needed for the update section
        const bottomMargin = 20; // margin from bottom of screen
        const followupContainer = document.querySelector('.followup-container');
        const followupHeight = followupContainer.offsetHeight;
        
        // Calculate maximum available height
        const maxHeight = window.innerHeight - textarea.offsetTop - followupHeight - bottomMargin;
        
        // Get the content height
        const contentHeight = textarea.scrollHeight;
        
        // Set minimum height (current default)
        const minHeight = 200;
        
        // Use the appropriate height: content height bounded by min and max
        const newHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
        textarea.style.height = newHeight + 'px';
        
        // Add scrolling if content exceeds max height
        textarea.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
        
        // Restore the scroll position
        window.scrollTo(0, scrollPos);
    }

    // Add window resize handler to readjust height
    window.addEventListener('resize', () => {
        const documentTextarea = document.getElementById('documentText');
        if (documentTextarea) {
            adjustTextareaHeight(documentTextarea);
        }
    });
  
    // 3. After user fills answers, click "Go" -> send follow-up
    answerBtn.addEventListener('click', async () => {
        const originalText = setButtonLoading(answerBtn, answerBtn.textContent);
        
        // Clear previous doc and hide followup section
        documentContainer.innerHTML = '';
        document.querySelector('.followup-container').style.display = 'none';
        resetButtonComplete(updateBtn, 'Update Document');  // Reset update button state

        const questions = JSON.parse(answerBtn.dataset.questions);
        const clarifyingAnswers = [];
  
        // Loop over the input fields to get user answers
        questions.forEach((q, idx) => {
            const answerVal = document.getElementById(`answerInput${idx}`).value;
            clarifyingAnswers.push(answerVal);
        });
  
        try {
            const response = await fetch('/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    clarifyingQuestions: questions, 
                    clarifyingAnswers,
                    template: uploadedTemplate 
                }),
            });
            const data = await response.json();
            if (data.error) {
                alert(data.error);
                return;
            }
  
            // data.document is the final doc
            documentContainer.innerHTML = ''; // Clear previous content

            const documentTextarea = document.createElement('textarea');
            documentTextarea.id = 'documentText';
            documentTextarea.className = 'document-textarea';
            documentTextarea.value = data.document;
            documentContainer.appendChild(documentTextarea);
            
            // Add this line after appending the textarea
            adjustTextareaHeight(documentTextarea);
            
            // Show the followup section
            document.querySelector('.followup-container').style.display = 'block';

            setButtonSuccess(answerBtn);
  
        } catch (error) {
            console.error(error);
            alert('Error generating final document');
            resetButtonComplete(answerBtn, 'Create Document');
        }
    });
  
    // Update the updateBtn click handler to validate input
    updateBtn.addEventListener('click', async () => {
        const changes = followupChanges.value.trim();
        if (!changes) {
            // Add error styling to the textarea
            followupChanges.classList.add('error');
            return;
        }
        followupChanges.classList.remove('error');

        const originalText = setButtonLoading(updateBtn, updateBtn.textContent);
        
        const currentDocument = document.getElementById('documentText').value;

        try {
            const response = await fetch('/api/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentDocument,
                    requestedChanges: changes
                }),
            });
            const data = await response.json();
            
            if (data.error) {
                alert(data.error);
                return;
            }

            // Update the document and clear the changes input
            document.getElementById('documentText').value = data.document;
            adjustTextareaHeight(document.getElementById('documentText'));
            followupChanges.value = '';
            followupChanges.classList.remove('error');

            setButtonSuccess(updateBtn);

        } catch (error) {
            console.error(error);
            alert('Error updating document');
            resetButtonComplete(updateBtn, 'Update Document');
        }
    });

    // Add input handler to remove error styling when user starts typing
    followupChanges.addEventListener('input', () => {
        if (followupChanges.value.trim()) {
            followupChanges.classList.remove('error');
        }
        resetButtonComplete(updateBtn, 'Update Document');
    });

    // Add listener for answer textareas
    function setupAnswerTextareaListeners() {
        document.querySelectorAll('.answer-textarea').forEach(textarea => {
            textarea.addEventListener('input', () => {
                resetButtonComplete(answerBtn, 'Create Document');
            });
        });
    }
  });