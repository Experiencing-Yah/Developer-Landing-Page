# Experiencing Yah Landing Page

A modern, minimalistic single-page website for Experiencing Yah, featuring smooth-scroll navigation, Material Design blue theme with layering effects, and a contact form.

## Features

- **Single-page design** with smooth-scroll navigation
- **Material Design blue theme** with cell-shading and layering effects
- **Responsive design** that works on mobile, tablet, and desktop
- **Contact form** integrated with Formspree (no exposed email addresses)
- **Email capture form** integrated with ConvertKit (free ebook delivery)
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

### Formspree Setup (Contact Form)

The contact form uses Formspree to send emails without exposing your email address.

1. **Create a Formspree Account**
   - Go to [https://formspree.io](https://formspree.io)
   - Sign up for an account

2. **Create a New Form**
   - After logging in, click **New Form**
   - Copy the form endpoint URL (it will look like `https://formspree.io/f/YOUR_FORM_ID`)

3. **Update the Form Endpoint**
   - Open `index.html`
   - Find the contact form with `id="contact-form"`
   - Replace the `action` value with your actual Formspree form URL

4. **Test the Form**
   - Submit a message and confirm it appears in Formspree / sends an email

### ConvertKit Setup (Free Ebook Email Capture)

The book page uses ConvertKit to collect email subscribers and deliver a free ebook (via ConvertKit’s incentive/automation).

1. **Create a ConvertKit form**
   - Create a form for the ebook signup (example: “Book Free Ebook”)
   - Attach your free ebook as the incentive / lead magnet (ConvertKit flow)

2. **Get your ConvertKit public API key**
   - ConvertKit: **Settings → Advanced → API**
   - Copy your **Public API Key**

3. **Get your ConvertKit Form ID**
   - Find the **Form ID** for your ebook form

4. **Paste the values into `book.html`**
   - Open `book.html`
   - Find the form with `id="ebook-form"`
   - Set:
     - `data-convertkit-form-id="YOUR_FORM_ID"`
     - `data-convertkit-public-api-key="YOUR_PUBLIC_API_KEY"`

5. **Test**
   - Submit your email on the book page
   - Confirm the subscriber appears in ConvertKit and the ebook is delivered

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

© 2026 Experiencing Yah. All rights reserved.




