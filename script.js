// Mobile Navigation Toggle
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
}

// Close mobile menu when clicking on a link
if (navMenu && navToggle && navLinks?.length) {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });
}

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
    if (!sections?.length || !navLinksArray?.length) return;
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
if (sections?.length && navLinksArray?.length) {
    window.addEventListener('scroll', updateActiveNav);
    updateActiveNav(); // Initial call
}

// Forms
const contactForm = document.getElementById('contact-form');
const formMessage = document.getElementById('form-message');

function setFormMessage(target, type, text) {
    if (!target) return;
    target.textContent = text;
    target.classList.remove('success', 'error');
    target.classList.add(type);
    target.style.display = 'block';
}

// Contact Form (Formspree + reCAPTCHA v3)
function submitContactFormWithToken(token) {
    if (!contactForm) return;

    const honeypot = contactForm.querySelector('#website');
    if (honeypot && honeypot.value) return;

    const submitBtn = contactForm.querySelector('.submit-btn');
    const originalBtnText = submitBtn?.textContent || 'Send Message';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
    }
    if (formMessage) {
        formMessage.style.display = 'none';
        formMessage.classList.remove('success', 'error');
    }

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
                setFormMessage(
                    formMessage,
                    'success',
                    'Thank you! Your message has been sent successfully. We\'ll get back to you soon.'
                );
                contactForm.reset();
                formMessage?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                let message = 'There was an error sending your message. Please try again.';
                try {
                    const data = await response.json();
                    if (data?.message) message = data.message;
                } catch (_) {
                    // ignore
                }
                setFormMessage(formMessage, 'error', message);
            }
        })
        .catch(() => {
            setFormMessage(formMessage, 'error', 'There was an error sending your message. Please check your connection and try again.');
        })
        .finally(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
}

window.onRecaptchaSuccess = submitContactFormWithToken;

const RECAPTCHA_SITE_KEY = '6LdFP4UsAAAAABXbpxRwm4AwPR3BA6vIPWKt4wnu';

if (contactForm) {
    const submitBtn = contactForm.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', function () {
            if (typeof grecaptcha === 'undefined' || !grecaptcha.ready) return;
            grecaptcha.ready(function () {
                grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' })
                    .then(submitContactFormWithToken)
                    .catch(function () {
                        setFormMessage(formMessage, 'error', 'Security check failed. Please refresh and try again.');
                    });
            });
        });
    }

    contactForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const honeypot = contactForm.querySelector('#website');
        if (honeypot && honeypot.value) return;

        if (typeof grecaptcha === 'undefined' || !grecaptcha.ready) {
            setFormMessage(formMessage, 'error', 'Security check is loading. Please wait a moment and try again.');
            return;
        }
        grecaptcha.ready(function () {
            grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' })
                .then(submitContactFormWithToken)
                .catch(function () {
                    setFormMessage(formMessage, 'error', 'Security check failed. Please refresh and try again.');
                });
        });
    });
}

// Ebook Signup (ConvertKit)
const ebookForm = document.getElementById('ebook-form');
const ebookFormMessage = document.getElementById('ebook-form-message');

if (ebookForm) {
    ebookForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const honeypot = ebookForm.querySelector('#ebook-website');
        if (honeypot && honeypot.value) return;

        const formId = (ebookForm.dataset.convertkitFormId || '').trim();
        const publicApiKey = (ebookForm.dataset.convertkitPublicApiKey || '').trim();

        if (!formId || !publicApiKey) {
            setFormMessage(
                ebookFormMessage,
                'error',
                'Signup isn’t configured yet. Please add your ConvertKit form ID and public API key.'
            );
            return;
        }

        const submitBtn = ebookForm.querySelector('.submit-btn');
        const originalBtnText = submitBtn?.textContent || 'Get the free ebook';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        if (ebookFormMessage) {
            ebookFormMessage.style.display = 'none';
            ebookFormMessage.classList.remove('success', 'error');
        }

        const email = String(ebookForm.querySelector('#ebook-email')?.value || '').trim();
        const first_name = String(ebookForm.querySelector('#ebook-first-name')?.value || '').trim();

        try {
            const response = await fetch(`https://api.convertkit.com/v3/forms/${encodeURIComponent(formId)}/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    api_key: publicApiKey,
                    email,
                    first_name: first_name || undefined
                })
            });

            if (!response.ok) {
                let message = 'There was an error subscribing. Please try again.';
                try {
                    const data = await response.json();
                    if (data?.message) message = data.message;
                } catch (_) {
                    // ignore
                }
                throw new Error(message);
            }

            setFormMessage(
                ebookFormMessage,
                'success',
                'Thanks! Please check your inbox to confirm and get the free ebook.'
            );
            ebookForm.reset();
            ebookFormMessage?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) {
            setFormMessage(
                ebookFormMessage,
                'error',
                err?.message || 'There was an error subscribing. Please try again.'
            );
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
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

