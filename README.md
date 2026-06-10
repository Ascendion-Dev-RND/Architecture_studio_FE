# Architecture Studio - Angular

An AI-powered architecture design platform built with Angular 19, following best practices and modern development standards.

## Overview

Architecture Studio helps teams explore, design, and validate scalable architectures through an intelligent workspace powered by AI. This Angular implementation maintains the exact design, styling, and functionality of the original React application.

## Features

- **Architecture Generator**: Turn ideas and requirements into comprehensive architectures instantly
- **Architecture Assessment**: Review, validate, and assess architecture for risks, NFRs, TOGAF and best-practices
- **E2E System Design**: Convert requirements into complete end-to-end system solutions

## Tech Stack

- **Framework**: Angular 19 (Standalone Components)
- **Styling**: TailwindCSS 3.4+
- **Icons**: Lucide Angular
- **Language**: TypeScript 5.6+
- **Font**: DM Sans (Google Fonts)

## Project Structure

```
architecture-studio-angular/
├── src/
│   ├── app/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── navbar/
│   │   │   ├── hero-section/
│   │   │   ├── features-section/
│   │   │   ├── feature-card/
│   │   │   └── projects-section/
│   │   ├── pages/            # Route components
│   │   │   ├── home/
│   │   │   ├── architecture-generator/
│   │   │   ├── architecture-workspace/
│   │   │   ├── architecture-assessment/
│   │   │   ├── assessment-options/
│   │   │   ├── architecture-assessment-report/
│   │   │   ├── e2e-system-design/
│   │   │   └── e2e-system-design-output/
│   │   ├── models/           # TypeScript interfaces
│   │   ├── services/         # Business logic services
│   │   ├── app.component.ts  # Root component
│   │   ├── app.config.ts     # App configuration
│   │   └── app.routes.ts     # Route definitions
│   ├── styles.css            # Global styles & design tokens
│   └── index.html
├── tailwind.config.js        # TailwindCSS configuration
├── angular.json              # Angular workspace configuration
└── package.json
```

## Design System

The application uses a custom design system with:

- **Colors**: Lavender-based palette with coral/salmon accents
- **Typography**: DM Sans font family
- **Spacing**: Consistent padding and margins
- **Components**: Card shadows, gradients, and animations
- **Dark Mode**: Full dark mode support (class-based)

### Color Palette

- **Primary**: Coral (#E8647C) - CTAs and highlights
- **Secondary**: Soft Lavender - Subtle backgrounds
- **Accent**: Blue (#4573E8) - Links and icons
- **Background**: Soft lavender (#FAF8FE)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Angular CLI (optional)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open your browser and navigate to `http://localhost:4200`

### Build

```bash
# Production build
npm run build

# Development build
npm run build -- --configuration development
```

## Angular Best Practices Applied

### Standalone Components
- All components use the standalone pattern (no NgModules)
- Improved tree-shaking and lazy loading
- Simpler component architecture

### Lazy Loading
- Pages are lazy-loaded using route-level code splitting
- Reduces initial bundle size
- Improves application performance

### TypeScript Strict Mode
- Full TypeScript strict mode enabled
- Type safety across the application
- Better IDE support and error catching

### Component Architecture
- Smart/Container components for pages
- Presentational components for UI elements
- Clear separation of concerns

### Reactive Patterns
- RxJS for async operations
- Observable-based data flow
- Proper subscription management

### Performance
- OnPush change detection strategy where applicable
- Lazy loading for routes
- Optimized bundle sizes

## Routing

The application uses Angular Router with lazy-loaded routes:

- `/` - Landing page
- `/architecture-generator` - Architecture generation input
- `/architecture-workspace` - Interactive workspace
- `/architecture-assessment` - Assessment input
- `/assessment-options` - Assessment configuration
- `/architecture-assessment-report` - Assessment results
- `/e2e-system-design` - E2E design input
- `/e2e-system-design-output` - E2E design output

## Styling Guidelines

- **TailwindCSS**: Utility-first CSS framework
- **Custom Utilities**: Custom gradient and shadow classes
- **CSS Variables**: Design tokens defined in styles.css
- **Responsive**: Mobile-first responsive design
- **Animations**: Fade-in, scale-in animations for smooth UX

## Code Standards

- ESLint for code quality
- Consistent naming conventions (kebab-case for files)
- Component documentation with JSDoc comments
- Type-safe code throughout
- Meaningful variable and function names

## License

Private - Architecture Studio

## Credits

Based on the React implementation with the same design system and user experience.
