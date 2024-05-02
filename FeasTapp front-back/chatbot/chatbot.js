document.getElementById('chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const userText = document.getElementById('user-input').value;
    
    // Create user message element
    const userMsg = document.createElement('li');
    userMsg.textContent = userText;
    userMsg.classList.add('user-message');
    document.getElementById('chatbox').appendChild(userMsg);

    // Here you would typically send the userText to a backend service or AI
    // to process the message and generate a response. For now, we'll just log it.
    console.log('Message sent to chatbot:', userText);

    // Clear input
    document.getElementById('user-input').value = '';
});
