# Experiencing Yah Landing Page

A modern, minimalistic single-page website for Experiencing Yah, featuring smooth-scroll navigation, Material Design blue theme with layering effects, and a contact form.

## Features

- **Single-page design** with smooth-scroll navigation
- **Material Design blue theme** with cell-shading and layering effects
- **Responsive design** that works on mobile, tablet, and desktop
- **Contact form** integrated with Formspree (no exposed email addresses)
- **Modern UI** with minimalistic design and smooth animations

## Setup Instructions

### GitHub Pages Hosting

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Initial landing page"
   git push origin master
   ```

2. **Enable GitHub Pages**
   - Go to your repository on GitHub
   - Click on **Settings**
   - Scroll down to **Pages** section
   - Under **Source**, select the branch (usually `master` or `main`)
   - Select the folder (usually `/ (root)`)
   - Click **Save**
   - Your site will be available at `https://[username].github.io/[repository-name]`

3. **Custom Domain (Optional)**
   - In the same Pages settings, you can add a custom domain
   - Follow GitHub's instructions for DNS configuration

### Formspree Setup

The contact form uses Formspree to send emails without exposing your email address.

1. **Create a Formspree Account**
   - Go to [https://formspree.io](https://formspree.io)
   - Sign up for a free account (free tier includes 50 submissions/month)

2. **Create a New Form**
   - After logging in, click **New Form**
   - Give your form a name (e.g., "Experiencing Yah Contact")
   - Copy the form endpoint URL (it will look like `https://formspree.io/f/YOUR_FORM_ID`)

3. **Update the Form Endpoint**
   - Open `index.html`
   - Find the contact form (around line 80)
   - Replace `YOUR_FORM_ID` in the form action with your actual Formspree form ID:
     ```html
     <form class="contact-form" id="contact-form" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
     ```
   - Replace `YOUR_FORM_ID` with the ID from your Formspree form URL

4. **Configure Formspree Settings (Optional)**
   - In your Formspree dashboard, you can:
     - Set up email notifications
     - Add custom redirect URLs
     - Configure spam protection
     - Set up webhooks

5. **Test the Form**
   - After updating the form endpoint, test it by submitting a message
   - Check your email (or Formspree dashboard) to confirm you received it

## File Structure

```
Developer-Landing-Page/
├── index.html      # Main HTML file
├── styles.css      # All styling
├── script.js       # JavaScript for navigation and form handling
└── README.md       # This file
```

## Customization

### Colors
The site uses Material Design blue colors defined in `styles.css`. You can modify the color palette by changing the CSS variables in the `:root` selector.

### Content
Edit `index.html` to update:
- Organization name and tagline
- About section content
- Apps section content
- Books section content
- Footer text

### Styling
Modify `styles.css` to adjust:
- Font sizes and typography
- Spacing and padding
- Shadow depths
- Border styles
- Animation speeds

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

This is a temporary landing page. Future plans include:
- Full WordPress site migration
- Blog functionality
- E-commerce capabilities
- More interactive features

## License

© 2024 Experiencing Yah. All rights reserved.

