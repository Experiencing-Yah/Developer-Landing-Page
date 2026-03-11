// Mobile Navigation Toggle
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
});

// Close mobile menu when clicking on a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    });
});

// Smooth Scroll Navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            const navHeight = document.querySelector('.navbar').offsetHeight;
            const targetPosition = targetElement.offsetTop - navHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Active Section Highlighting in Navigation
const sections = document.querySelectorAll('.section, .hero');
const navLinksArray = Array.from(document.querySelectorAll('.nav-link'));

function updateActiveNav() {
    const scrollPosition = window.scrollY + 100; // Offset for navbar
    
    sections.forEach((section, index) => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            navLinksArray.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
    
    // Handle hero section (when at top of page)
    if (window.scrollY < 100) {
        navLinksArray.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#hero') {
                link.classList.add('active');
            }
        });
    }
}

// Update active nav on scroll
window.addEventListener('scroll', updateActiveNav);
updateActiveNav(); // Initial call

// Form Submission Handling - reCAPTCHA v3 uses button data-sitekey and callback
const contactForm = document.getElementById('contact-form');
const formMessage = document.getElementById('form-message');

function submitFormWithToken(token) {
    if (!contactForm) return;

    const honeypot = contactForm.querySelector('#website');
    if (honeypot && honeypot.value) return;

    const submitBtn = contactForm.querySelector('.submit-btn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    formMessage.style.display = 'none';
    formMessage.classList.remove('success', 'error');

    const formData = new FormData(contactForm);
    formData.delete('website');
    formData.set('g-recaptcha-response', token);

    fetch(contactForm.action, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
    })
        .then(async (response) => {
            if (response.ok) {
                formMessage.textContent = 'Thank you! Your message has been sent successfully. We\'ll get back to you soon.';
                formMessage.classList.add('success');
                formMessage.style.display = 'block';
                contactForm.reset();
                formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                const data = await response.json();
                formMessage.textContent = 'There was an error sending your message. Please try again.';
                formMessage.classList.add('error');
                formMessage.style.display = 'block';
            }
        })
        .catch(() => {
            formMessage.textContent = 'There was an error sending your message. Please check your connection and try again.';
            formMessage.classList.add('error');
            formMessage.style.display = 'block';
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        });
}

window.onRecaptchaSuccess = submitFormWithToken;

const RECAPTCHA_SITE_KEY = '6LdFP4UsAAAAABXbpxRwm4AwPR3BA6vIPWKt4wnu';

if (contactForm) {
    const submitBtn = contactForm.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            if (typeof grecaptcha === 'undefined' || !grecaptcha.ready) return;
            grecaptcha.ready(function() {
                grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' })
                    .then(submitFormWithToken)
                    .catch(function() {
                        formMessage.textContent = 'Security check failed. Please refresh and try again.';
                        formMessage.classList.add('error');
                        formMessage.style.display = 'block';
                    });
            });
        });
    }
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const honeypot = contactForm.querySelector('#website');
        if (honeypot && honeypot.value) return;
        // Enter key or other submit: get token programmatically then submit
        if (typeof grecaptcha === 'undefined' || !grecaptcha.ready) {
            formMessage.textContent = 'Security check is loading. Please wait a moment and try again.';
            formMessage.classList.add('error');
            formMessage.style.display = 'block';
            return;
        }
        grecaptcha.ready(function() {
            grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' })
                .then(submitFormWithToken)
                .catch(function() {
                    formMessage.textContent = 'Security check failed. Please refresh and try again.';
                    formMessage.classList.add('error');
                    formMessage.style.display = 'block';
                });
        });
    });
}

// Navbar background on scroll
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    
    if (currentScroll > 50) {
        navbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    } else {
        navbar.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)';
    }
    
    lastScroll = currentScroll;
});

