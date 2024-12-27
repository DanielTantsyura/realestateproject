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
    let uploadedTemplate = null;
    const removeTemplateBtn = document.getElementById('removeTemplate');
  
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
        const errorDiv = document.getElementById('validationError');
        
        // Check if using reference document (dropdowns are disabled)
        if (stateSelect.disabled) {
            // Verify that a document is uploaded
            if (!uploadedTemplate) {
                errorDiv.textContent = 'Please upload a reference document';
                errorDiv.style.display = 'block';
                return false;
            }
            errorDiv.style.display = 'none';
            return true;
        }

        // Otherwise validate all fields for generic template
        let isValid = true;
        const requiredFields = [
            { element: stateSelect, name: 'state' },
            { element: documentCategorySelect, name: 'document category' },
            { element: documentTypeSelect, name: 'document type' }
        ];
        
        requiredFields.forEach(field => {
            if (!field.element.value) {
                field.element.classList.add('error');
                isValid = false;
            } else {
                field.element.classList.remove('error');
            }
        });

        if (!isValid) {
            errorDiv.textContent = 'When using a generic template, please select all required fields';
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
        resetButtonComplete(createBtn, 'Next Step');
        checkDropdownsComplete();
    });

    documentCategorySelect.addEventListener('change', () => {
        if (documentCategorySelect.value) {
            documentCategorySelect.classList.remove('error');
            if (stateSelect.value && documentTypeSelect.value) {
                document.getElementById('validationError').style.display = 'none';
            }
        }
        resetButtonComplete(createBtn, 'Next Step');
        checkDropdownsComplete();
    });

    documentTypeSelect.addEventListener('change', () => {
        if (documentTypeSelect.value) {
            documentTypeSelect.classList.remove('error');
            if (stateSelect.value && documentCategorySelect.value) {
                document.getElementById('validationError').style.display = 'none';
            }
        }
        resetButtonComplete(createBtn, 'Next Step');
        checkDropdownsComplete();
    });
  
    // Add this function after your helper functions
    function handleFileUpload(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedTemplate = e.target.result;
                removeTemplateBtn.classList.remove('hidden');
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
                document.querySelector('.placeholder-text').style.display = 'block';
                answerBtn.classList.add('hidden');
                
                // Clear and disable the dropdowns
                [stateSelect, documentCategorySelect, documentTypeSelect].forEach(select => {
                    select.value = '';
                    select.disabled = true;
                });
                
                // Reset the Next Step button
                resetButtonComplete(createBtn, 'Next Step');
                
                createBtn.classList.add('ready');
            } catch (error) {
                console.error('Error uploading file:', error);
                alert('Error uploading file');
                createBtn.classList.remove('ready');
            }
        } else {
            // Re-enable dropdowns if no file is selected
            [stateSelect, documentCategorySelect, documentTypeSelect].forEach(select => {
                select.disabled = false;
            });
            createBtn.classList.remove('ready');
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
        document.querySelector('.placeholder-text').style.display = 'none';
        answerBtn.classList.add('hidden');
        
        // Hide the entire right panel content
        document.getElementById('documentText').value = '';
        document.getElementById('documentText').style.display = 'none';
        document.querySelector('.followup-container').style.display = 'none';

        // Get values based on whether we're using a template or not
        const state = stateSelect.disabled ? 'Template' : stateSelect.value;
        const selectedDocType = documentTypeSelect.disabled ? 'Reference Document' : documentTypeSelect.value;

        // Call backend
        try {
            const endpoint = uploadedTemplate ? '/api/ask-with-template' : '/api/ask';
            console.log(`Calling API: ${endpoint}`);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    state, 
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

            // If only one question is returned, retry by triggering button click again
            if (questions.length <= 1) {
                console.log('Only one or 0 question returned, retrying...');
                createBtn.click();
                return;
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
            resetButtonComplete(createBtn, 'Next Step');
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
        
        // Show the document editor and followup section
        document.getElementById('documentText').style.display = 'block';
        document.querySelector('.followup-container').style.display = 'block';
        
        const questions = JSON.parse(answerBtn.dataset.questions);
        const clarifyingAnswers = [];

        // Loop over the input fields to get user answers
        questions.forEach((q, idx) => {
            const answerVal = document.getElementById(`answerInput${idx}`).value;
            clarifyingAnswers.push(answerVal);
        });

        try {
            console.log('Calling API: /api/create');
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

            // Update the existing textarea with the new document
            const documentTextarea = document.getElementById('documentText');
            documentTextarea.value = data.document;
            adjustTextareaHeight(documentTextarea);

            setButtonSuccess(answerBtn);

        } catch (error) {
            console.error(error);
            alert('Error generating final document');
            resetButtonComplete(answerBtn, 'Generate Document');
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
            console.log('Calling API: /api/update');
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
        checkUpdateText();
    });

    // Add listener for answer textareas
    function setupAnswerTextareaListeners() {
        document.querySelectorAll('.answer-textarea').forEach(textarea => {
            textarea.addEventListener('input', () => {
                resetButtonComplete(answerBtn, 'Generate Document');
                checkAnswersComplete();
            });
        });
    }

    // Add event listener for the document textarea to adjust height on input
    const documentTextarea = document.getElementById('documentText');
    documentTextarea.addEventListener('input', () => {
        adjustTextareaHeight(documentTextarea);
    });

    // Also adjust height on paste events
    documentTextarea.addEventListener('paste', () => {
        // Use setTimeout to let the paste complete before adjusting
        setTimeout(() => {
            adjustTextareaHeight(documentTextarea);
        }, 0);
    });

    // Add remove template handler
    removeTemplateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        uploadedTemplate = null;
        templateInput.value = '';
        removeTemplateBtn.classList.add('hidden');
        
        // Re-enable dropdowns
        [stateSelect, documentCategorySelect, documentTypeSelect].forEach(select => {
            select.disabled = false;
        });

        // Reset the Next Step button
        resetButtonComplete(createBtn, 'Next Step');
        createBtn.classList.remove('ready');
    });

    // Add this function to check if all dropdowns are filled
    function checkDropdownsComplete() {
        const allFilled = stateSelect.value && 
                         documentCategorySelect.value && 
                         documentTypeSelect.value;
        if (allFilled) {
            createBtn.classList.add('ready');
        } else {
            createBtn.classList.remove('ready');
        }
    }

    // Add this function to check if all questions are answered
    function checkAnswersComplete() {
        const allAnswered = Array.from(document.querySelectorAll('.answer-textarea'))
            .every(textarea => textarea.value.trim() !== '');
        if (allAnswered) {
            answerBtn.classList.add('ready');
        } else {
            answerBtn.classList.remove('ready');
        }
    }

    // Add this function to check if update text is entered
    function checkUpdateText() {
        if (followupChanges.value.trim()) {
            updateBtn.classList.add('ready');
        } else {
            updateBtn.classList.remove('ready');
        }
    }

    // Remove emphasis when buttons are clicked
    createBtn.addEventListener('click', () => {
        createBtn.classList.remove('ready');
        // ... rest of click handler
    });

    answerBtn.addEventListener('click', () => {
        answerBtn.classList.remove('ready');
        // ... rest of click handler
    });

    updateBtn.addEventListener('click', () => {
        updateBtn.classList.remove('ready');
        // ... rest of click handler
    });
  });