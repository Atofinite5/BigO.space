import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/Hero'
import { Features } from '@/components/Features'
import { HowItWorks } from '@/components/HowItWorks'
import { FinalCTA } from '@/components/FinalCTA'
import { Footer } from '@/components/Footer'

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-surface overflow-x-hidden pt-16">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <FinalCTA />
      <Footer />
    </main>
  )
}
