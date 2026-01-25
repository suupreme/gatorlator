// Create floating particles on page load
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.width = Math.random() * 5 + 2 + 'px';
        particle.style.height = particle.style.width;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Simulate start button interaction
function simulateStart(button) {
    const select = document.getElementById('languageSelect');
    const selectedLang = select.options[select.selectedIndex].text;
    
    if (button.textContent.includes('Start')) {
        button.textContent = '⏸️ Stop Translation';
        button.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
        
        // Update status
        const statusText = document.querySelector('.status-indicator span:last-child');
        statusText.textContent = `Translating to ${selectedLang}...`;
        statusText.style.color = '#28a745';
        
        // Show notification
        showNotification(`Translation started to ${selectedLang}!`);
    } else {
        button.textContent = '🎙️ Start Translation';
        button.style.background = 'linear-gradient(135deg, #0021A5, #00843D)';
        
        // Update status
        const statusText = document.querySelector('.status-indicator span:last-child');
        statusText.textContent = 'Ready to Translate';
        statusText.style.color = '#0021A5';
        
        showNotification('Translation stopped');
    }
}

// Show notification
function showNotification(message) {
    // Remove existing notification if any
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #0021A5, #00843D);
        color: white;
        padding: 1rem 2rem;
        border-radius: 10px;
        font-weight: 600;
        box-shadow: 0 10px 30px rgba(0,33,165,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize particles when page loads
window.addEventListener('DOMContentLoaded', () => {
    createParticles();
    
    // Add click event to start button
    const startButton = document.getElementById('startButton');
    startButton.addEventListener('click', function() {
        simulateStart(this);
    });
});

// Add smooth scroll for anchor links (if any)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});