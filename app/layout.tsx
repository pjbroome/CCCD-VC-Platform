import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Virtual Consultation | Charlotte Center for Cosmetic Dentistry',
  description: 'Get a free virtual consultation with Dr. Patrick Broome in Charlotte NC. Upload two smile photos, tell us your goals, and receive a personalized video reply within 24 hours.',
  generator: 'v0.app',
  authors: [{ name: 'Charlotte Center for Cosmetic Dentistry' }],
  keywords: ['virtual consultation', 'cosmetic dentistry', 'smile makeover', 'Dr. Patrick Broome', 'Charlotte NC', 'veneers', 'dental implants', 'teeth whitening'],
  openGraph: {
    title: 'Virtual Consultation | Charlotte Center for Cosmetic Dentistry',
    description: 'Upload two smile photos and get a personalized video reply from Dr. Patrick Broome within 24 hours. 100% free, takes 2-3 minutes.',
    url: 'https://www.charlottecentercosmeticdentistry.com/virtual-consult',
    siteName: 'Charlotte Center for Cosmetic Dentistry',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Virtual Consultation | Charlotte Center for Cosmetic Dentistry',
    description: 'Upload two smile photos and get a personalized video reply from Dr. Patrick Broome within 24 hours.',
  },
  alternates: {
    canonical: 'https://www.charlottecentercosmeticdentistry.com/virtual-consult',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="geo.region" content="US-NC" />
        <meta name="geo.placename" content="Charlotte" />
        <meta name="geo.position" content="35.2271;-80.8431" />
        <meta name="ICBM" content="35.2271, -80.8431" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Dentist",
                  "@id": "https://www.charlottecentercosmeticdentistry.com/#dentist",
                  "name": "Charlotte Center for Cosmetic Dentistry",
                  "url": "https://www.charlottecentercosmeticdentistry.com",
                  "telephone": "+1-704-364-4711",
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "6849 Fairview Rd Suite 200",
                    "addressLocality": "Charlotte",
                    "addressRegion": "NC",
                    "postalCode": "28210",
                    "addressCountry": "US"
                  },
                  "geo": {
                    "@type": "GeoCoordinates",
                    "latitude": 35.2271,
                    "longitude": -80.8431
                  },
                  "founder": {
                    "@type": "Person",
                    "name": "Dr. Patrick Broome",
                    "jobTitle": "Cosmetic Dentist",
                    "description": "Dr. Patrick Broome is a cosmetic dentist with over 30 years of experience in smile transformations, veneers, and dental implants in Charlotte, NC."
                  },
                  "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": "4.9",
                    "reviewCount": "500",
                    "bestRating": "5"
                  }
                },
                {
                  "@type": "WebPage",
                  "@id": "https://www.charlottecentercosmeticdentistry.com/virtual-consult/#webpage",
                  "url": "https://www.charlottecentercosmeticdentistry.com/virtual-consult",
                  "name": "Virtual Consultation | Charlotte Center for Cosmetic Dentistry",
                  "description": "Get a free virtual consultation with Dr. Patrick Broome. Upload two smile photos, share your goals, and receive a personalized video reply within 24 hours.",
                  "isPartOf": { "@id": "https://www.charlottecentercosmeticdentistry.com/#website" },
                  "about": { "@id": "https://www.charlottecentercosmeticdentistry.com/#dentist" }
                },
                {
                  "@type": "FAQPage",
                  "@id": "https://www.charlottecentercosmeticdentistry.com/virtual-consult/#faq",
                  "mainEntity": [
                    {
                      "@type": "Question",
                      "name": "How does the CCCD virtual consultation work?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Upload a full-face smiling selfie and a close-up smile photo, tell Dr. Broome what matters most to you, and submit. Within 24 hours you receive a personalized video reply with treatment suggestions matched to similar cases from our smile library."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Is the virtual consultation free?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. The CCCD virtual consultation is 100% free with no obligation. It takes 2-3 minutes to complete and you receive a personalized video reply from Dr. Patrick Broome within 24 hours."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "What photos do I need for a virtual smile consultation?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "You need two photos: a full-face smiling selfie showing your entire face, and a close-up photo of your smile showing your teeth clearly. Our AI agent screens both photos to ensure they are suitable for evaluation."
                      }
                    }
                  ]
                },
                {
                  "@type": "BreadcrumbList",
                  "@id": "https://www.charlottecentercosmeticdentistry.com/virtual-consult/#breadcrumb",
                  "itemListElement": [
                    {
                      "@type": "ListItem",
                      "position": 1,
                      "name": "Home",
                      "item": "https://www.charlottecentercosmeticdentistry.com"
                    },
                    {
                      "@type": "ListItem",
                      "position": 2,
                      "name": "Virtual Consultation",
                      "item": "https://www.charlottecentercosmeticdentistry.com/virtual-consult"
                    }
                  ]
                }
              ]
            })
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
